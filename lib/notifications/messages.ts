// Notification wording — Member B. Repo path: lib/notifications/messages.ts
// Plain functions, safe in client code. Used by the email job AND by C's notification bell,
// so the email and the in-app message always say the same thing.
//
// A's database creates the notification rows (public.notifications: type + payload).
// This file covers every type A's labpass_schema.sql creates.
// `href` is the page to open. C: change the paths in LINKS to match your routes.

export type NotificationPayload = Record<string, unknown>;

export type NotificationMessage = {
  title: string;
  body: string;
  href: string | null;
};

// C: the pages each notification opens. Change a path here and every notification and email follows.
// The same list is in API.md ("Notification links").
export const LINKS = {
  booking: (id: unknown) => (id ? `/bookings/${id}` : "/bookings"),
  managerRequest: (id: unknown) => (id ? `/manage/requests/${id}` : "/manage/requests"),
  certificateReview: (id: unknown) => (id ? `/manage/certificates/${id}` : "/manage/certificates"),
  supervisorApplications: () => "/manage/supervisors",
  incident: (id: unknown) => (id ? `/incidents/${id}` : "/incidents"),
  adminIncident: (id: unknown) => (id ? `/admin/incidents/${id}` : "/admin/incidents"),
  adminFlags: () => "/admin/flags",
  passport: () => "/passport",
  supervising: () => "/supervising",
};

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));

// "Thu 29 Oct, 2:00 pm" in the institution's time zone.
export function formatWhen(value: unknown, timeZone = "Asia/Kolkata"): string {
  const d = new Date(str(value));
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

function withReason(text: string, reason: unknown): string {
  const r = str(reason).trim();
  if (!r) return text;
  return `${text} Reason: ${r}${/[.!?]$/.test(r) ? "" : "."}`;
}

const DECISIONS: Record<string, string> = {
  no_action: "no action needed",
  warning: "a warning",
  credit_penalty: "a credit penalty",
  temporary_block: "a temporary booking block",
};

// Which notifications also go out by email. PRD FR-22 lists: approval, rejection, waitlist offer,
// reminder, overdue and incident decision. Everything else is in-app only. This also keeps us
// inside Resend's free plan (100 emails a day).
const EMAILED_BOOKING_STATUSES = new Set(["approved", "rejected", "waitlisted", "overdue"]);
const EMAILED_TYPES = new Set(["waitlist_offer", "reminder", "incident_decision"]);

export function shouldEmail(type: string, payload: NotificationPayload): boolean {
  if (type === "booking_status") return EMAILED_BOOKING_STATUSES.has(str(payload?.status));
  return EMAILED_TYPES.has(type);
}

export function describeNotification(
  type: string,
  payload: NotificationPayload,
  timeZone = "Asia/Kolkata",
): NotificationMessage {
  const p = payload ?? {};
  const resource = str(p.resource) || "the resource";
  const when = formatWhen(p.start, timeZone);
  const at = when ? ` on ${when}` : "";

  switch (type) {
    // ---- Bookings: sent to the student on every status change ----
    case "booking_status": {
      const href = LINKS.booking(p.booking_id);
      switch (str(p.status)) {
        case "requested":
          return { title: "Request sent", body: `Your request for ${resource}${at} is waiting for the manager.`, href };
        case "approved":
          return { title: "Booking approved", body: `Your booking for ${resource}${at} is approved.`, href };
        case "rejected":
          return { title: "Booking not approved", body: withReason(`Your request for ${resource}${at} was not approved.`, p.reason), href };
        case "waitlisted":
          return { title: "You're on the waitlist", body: withReason(`Your request for ${resource}${at} is on the waitlist. You'll be told if the slot frees up.`, p.reason), href };
        case "cancelled":
          return { title: "Booking cancelled", body: withReason(`Your booking for ${resource}${at} was cancelled.`, p.reason), href };
        case "checked_in":
          return { title: "Checked in", body: `You're checked in to ${resource}. Remember to return it on time.`, href };
        case "overdue":
          return { title: "Booking overdue", body: `Your time with ${resource} has ended. Please return it now.`, href };
        case "returned":
          return { title: "Return recorded", body: `Your return of ${resource} is waiting for the manager to confirm.`, href };
        case "completed":
          return { title: "Return confirmed", body: `The manager confirmed your return of ${resource}. Thanks!`, href };
        case "no_show":
          return { title: "Marked as no-show", body: `You didn't check in to ${resource}${at}, so the booking was marked as a no-show.`, href };
        default:
          return { title: "Booking updated", body: `Your booking for ${resource} was updated.`, href };
      }
    }
    case "booking_request":
      return { title: "New booking request", body: `New request for ${resource}${at}.`, href: LINKS.managerRequest(p.booking_id) };
    case "booking_returned":
      return { title: "Return to confirm", body: `${resource} was returned. Please check it and confirm the return.`, href: LINKS.managerRequest(p.booking_id) };
    case "booking_overdue":
      return { title: "Booking overdue", body: `${resource} hasn't been returned on time.`, href: LINKS.managerRequest(p.booking_id) };
    case "booking_no_show":
      return { title: "No-show", body: `The student didn't check in to ${resource}${at}.`, href: LINKS.managerRequest(p.booking_id) };
    case "reminder":
      return { title: "Starting soon", body: `Your session with ${resource} starts${at}. Check in at the resource by scanning its QR code.`, href: LINKS.booking(p.booking_id) };
    case "waitlist_offer": {
      const until = formatWhen(p.expires_at, timeZone);
      return {
        title: "A slot opened up for you",
        body: until ? `A slot you waitlisted for is free. Accept it by ${until} or it goes to the next person.` : "A slot you waitlisted for is free. Accept it soon or it goes to the next person.",
        href: LINKS.booking(p.booking_id),
      };
    }

    // ---- Supervision ----
    case "supervision_assigned":
      return { title: "You're supervising", body: `You're the supervisor for a session on ${resource}${at}.`, href: LINKS.supervising() };
    case "supervision_cancelled":
      return { title: "Supervision cancelled", body: `The session on ${resource}${at} you were supervising was cancelled.`, href: LINKS.supervising() };
    case "supervisor_application":
      return { title: "New supervisor application", body: `A student applied to be a peer supervisor for ${resource}.`, href: LINKS.supervisorApplications() };
    case "supervisor_approved":
      return { title: "Supervisor application approved", body: "You can now publish supervision hours and co-sign sessions.", href: LINKS.supervising() };
    case "supervisor_rejected":
      return { title: "Supervisor application not approved", body: withReason("Your peer supervisor application was not approved.", p.reason), href: LINKS.passport() };
    case "supervisor_suspended":
      return { title: "Supervisor role suspended", body: withReason("Your peer supervisor role was suspended.", p.reason), href: LINKS.passport() };

    // ---- Badges ----
    case "certificate_review":
      return { title: "Certificate to review", body: `A student submitted a certificate for ${resource}.`, href: LINKS.certificateReview(p.user_badge_id) };
    case "certificate_approved":
      return { title: "Certificate approved", body: `Your certificate was approved. You now hold the "${str(p.badge)}" badge.`, href: LINKS.passport() };
    case "certificate_rejected":
      return { title: "Certificate not approved", body: withReason(`Your certificate for "${str(p.badge)}" was not approved.`, p.reason), href: LINKS.passport() };
    case "graduated":
      return { title: "You graduated", body: `You can now use ${resource} without a supervisor.`, href: LINKS.passport() };

    // ---- Incidents ----
    case "incident_opened":
      return { title: "Incident reported", body: `An incident was reported for a booking of ${resource}.`, href: LINKS.incident(p.incident_id) };
    case "incident_decision": {
      const decision = DECISIONS[str(p.decision)] ?? "a decision";
      let body = `The manager's decision on your incident: ${decision}.`;
      if (Number(p.penalty_credits) > 0) body += ` ${Number(p.penalty_credits)} credits were deducted.`;
      const blocked = formatWhen(p.block_until, timeZone);
      if (blocked) body += ` Booking is blocked until ${blocked}.`;
      return { title: "Incident decision", body: withReason(body, p.reason) + " You can respond or dispute it.", href: LINKS.incident(p.incident_id) };
    }
    case "incident_dispute":
      return { title: "Incident disputed", body: "A student disputed an incident decision. Please review it.", href: LINKS.adminIncident(p.incident_id) };
    case "incident_dispute_resolved": {
      const overturned = str(p.outcome) === "overturned";
      return {
        title: overturned ? "Decision overturned" : "Decision stands",
        body: withReason(
          overturned
            ? "An admin reviewed your dispute and overturned the decision. Any penalty or block from it has been reversed."
            : "An admin reviewed your dispute and kept the original decision.",
          p.reason,
        ),
        href: LINKS.incident(p.incident_id),
      };
    }

    // ---- Account ----
    case "account_restricted": {
      const until = formatWhen(p.until, timeZone);
      return { title: "Booking restricted", body: withReason(until ? `You can't make new bookings until ${until}.` : "You can't make new bookings for now.", p.reason), href: LINKS.passport() };
    }
    case "account_unrestricted":
      return { title: "Booking restriction lifted", body: withReason("You can make bookings again.", p.reason), href: LINKS.passport() };
    case "restriction_review":
      return { title: "Restriction to review", body: `A student has ${Number(p.no_shows) || 3} no-shows in 30 days. Review the proposed block.`, href: LINKS.adminFlags() };
    case "ai_pattern_flag":
      return { title: "Usage pattern flagged", body: "AI suggestion — needs review: an unusual booking pattern was flagged.", href: LINKS.adminFlags() };

    default:
      return { title: "LabPass update", body: "You have a new update in LabPass.", href: null };
  }
}
