"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import type { Booking } from "@/lib/screens/types";
import { useRules } from "@/lib/screens/use-query";

/** Student cancels their own booking. A refunds credits more than free_cancel_hours before the start. */
export function CancelDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  const toast = useToast();
  const rules = useRules();
  const [busy, setBusy] = useState(false);
  if (!booking) return null;
  const freeHours = rules?.free_cancel_hours ?? 2;
  const refundable = booking.status === "approved" && booking.creditsCharged > 0 && new Date(booking.start).getTime() - Date.now() > freeHours * 3_600_000;
  return (
    <Dialog open={!!booking} onClose={onClose} title="Cancel this booking?" description={booking.resource.name}>
      <p className="text-sm">
        {booking.status !== "approved" || booking.creditsCharged === 0
          ? "No credits have been taken yet, so there's nothing to refund."
          : refundable
            ? `It's more than ${freeHours} hours away, so your ${booking.creditsCharged} credits come back.`
            : `It starts within ${freeHours} hours, so the ${booking.creditsCharged} credits are not refunded.`}
      </p>
      {booking.status === "approved" && <p className="mt-2 text-sm text-mute">The next person on the waitlist gets a {rules?.waitlist_offer_minutes ?? 30}-minute offer for this slot.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Keep it
        </Button>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            const r = await api.cancelBooking(booking.id);
            setBusy(false);
            if (!r.ok) toast.error("Couldn't cancel", r.error);
            else toast.success("Booking cancelled", r.data.refundedCredits ? `${r.data.refundedCredits} credits refunded.` : undefined);
            onClose();
          }}
        >
          Cancel booking
        </Button>
      </div>
    </Dialog>
  );
}
