// Check-in code helpers — Member B. Repo path: lib/checkin-code.ts
// Plain functions, safe in client code (C's QR scanner uses parseCheckinCode).
//
// A's schema gives every resource a secret 8-character code (resource_checkin_codes.code,
// upper-case hex like "3FA09C1B"). Students can't read it: they get it only by scanning the QR
// printed at the resource, so nobody can check in from somewhere else.
//
// The QR holds a link: <APP_URL>/check-in?code=3FA09C1B
// - Scanned with the phone camera, it opens C's check-in page with the code filled in.
// - Scanned inside the app (html5-qrcode), parseCheckinCode() pulls the code out.

const CODE = /^[0-9A-F]{8}$/;

export function checkinLink(code: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return base ? `${base}/check-in?code=${encodeURIComponent(code)}` : code;
}

// Accepts what a scanner returns (the link, or a bare code) or what a student typed.
// Returns the code in upper case, or null if it doesn't look like one.
export function parseCheckinCode(scannedOrTyped: string): string | null {
  const raw = scannedOrTyped.trim();
  let code = raw;
  try {
    const url = new URL(raw);
    code = url.searchParams.get("code") ?? "";
  } catch {
    // not a link: treat as typed code
  }
  code = code.replace(/[\s-]/g, "").toUpperCase();
  return CODE.test(code) ? code : null;
}
