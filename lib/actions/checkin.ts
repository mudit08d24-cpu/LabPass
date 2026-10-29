"use server";

// QR codes and check-in — Member B. Repo path: lib/actions/checkin.ts
//
// What A's database already does (labpass_schema.sql):
//   - gives each resource a secret check-in code             (resource_checkin_codes)
//   - shows it only to the resource's manager/owner/admin     (get_checkin_code)
//   - replaces it with a new one                              (rotate_checkin_code)
//   - validates it at check-in, inside the 15-minute window,
//     and requires the check-in condition report first       (check_in_booking)
// What this file adds: the printable QR picture, and finding the student's booking from a scan.
//
// Needs the `qrcode` package: npm install qrcode @types/qrcode

import QRCode from "qrcode";
import { getDb } from "@/lib/actions/db";
import { getRules } from "@/lib/rules";
import { parseRange } from "@/lib/ranges";
import { checkinLink, parseCheckinCode } from "@/lib/checkin-code";
import { type Result, ok, fail, friendlyError, UUID } from "@/lib/actions/errors";

type ResourceQr = {
  resourceId: string;
  resourceName: string;
  code: string; // also printed under the QR, for typing in if the camera fails
  link: string; // what the QR contains
  qrDataUrl: string; // PNG as a data: URL — use as <img src> or a download link
};

async function makeQr(resourceId: string, code: string): Promise<Result<ResourceQr>> {
  const supabase = await getDb();
  const { data: resource } = await supabase.from("resources").select("name").eq("id", resourceId).maybeSingle();
  const link = checkinLink(code);
  const qrDataUrl = await QRCode.toDataURL(link, { width: 512, margin: 2, errorCorrectionLevel: "M" });
  return ok({ resourceId, resourceName: resource?.name ?? "", code, link, qrDataUrl });
}

// Manager, owner or admin: the printable QR for a resource (FR-03).
export async function getResourceQr(resourceId: string): Promise<Result<ResourceQr>> {
  if (!UUID.test(resourceId)) return fail("Unknown resource.");
  const supabase = await getDb();
  const { data, error } = await supabase.rpc("get_checkin_code", { p_resource: resourceId });
  if (error) return fail(friendlyError(error));
  // A's function returns nothing to people who don't manage the resource.
  if (!data) return fail("Only the resource's manager or owner can see its QR code.");
  return makeQr(resourceId, data as string);
}

// Manager, owner or admin: replace the code (e.g. if a photo of the QR is shared).
// The old printed QR stops working, so print the new one.
export async function rotateCheckinCode(resourceId: string): Promise<Result<ResourceQr>> {
  if (!UUID.test(resourceId)) return fail("Unknown resource.");
  const supabase = await getDb();
  const { data, error } = await supabase.rpc("rotate_checkin_code", { p_resource: resourceId });
  if (error) return fail(friendlyError(error));
  return makeQr(resourceId, data as string);
}

// Student checks in with a scanned or typed code (FR-14).
// - bookingId given (student opened check-in from their booking): checks in that booking.
// - bookingId missing (student scanned the QR with the phone camera): finds the student's
//   approved booking whose check-in window is open now. If there are several, the screen
//   should ask which one and call again with bookingId.
// Before this, the student must save the check-in condition report with photos
// (saveConditionReport); A's check_in_booking refuses otherwise and says so.
export async function checkIn(
  scannedOrTyped: string,
  bookingId?: string,
): Promise<Result<{ bookingId: string }>> {
  const code = parseCheckinCode(scannedOrTyped);
  if (!code) return fail("That isn't a valid check-in code. Scan the QR at the resource or type the 8-character code under it.");

  const supabase = await getDb();
  let target = bookingId;

  if (target && !UUID.test(target)) return fail("Unknown booking.");

  if (!target) {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return fail("Please log in first.");
    const rules = await getRules();
    const graceMs = rules.checkin_grace_minutes * 60_000;
    const now = Date.now();

    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id, time_range")
      .eq("user_id", auth.user.id)
      .eq("status", "approved");
    if (error) return fail(friendlyError(error));

    const open = ((rows ?? []) as { id: string; time_range: string }[]).filter((b) => {
      const r = parseRange(b.time_range as string);
      return r !== null && Math.abs(r.start.getTime() - now) <= graceMs;
    });
    if (open.length === 0) {
      return fail(`You have no approved booking starting now. Check-in opens ${rules.checkin_grace_minutes} minutes before your start time.`);
    }
    if (open.length > 1) return fail("You have more than one booking starting now. Open the booking you want and check in from there.");
    target = open[0].id as string;
  }

  const { error } = await supabase.rpc("check_in_booking", { p_booking_id: target, p_code: code });
  if (error) return fail(friendlyError(error));
  return ok({ bookingId: target });
}
