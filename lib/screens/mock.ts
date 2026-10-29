// In-browser stand-in for B's actions and A's database (NEXT_PUBLIC_USE_MOCKS=true).
// It mirrors A's rules closely (check keys and messages, priority breakdown, status changes,
// credits, waitlist offers) so screens behave the same on mock data and on the real backend.
// Demo people and resources match A's seed (seed/seed-demo-setup.sql). All data is fictional.

import { artFor, checksList } from "./format";
import type {
  AppNotification,
  BadgeHeld,
  Booking,
  BookingDetail,
  BookingStatus,
  Breakdown,
  CertificateSubmission,
  ChecklistAnswer,
  ConditionReport,
  ConflictGroup,
  Department,
  Eligibility,
  GraduationProgress,
  Incident,
  IncidentDecision,
  IncidentStatus,
  IncidentType,
  Me,
  OwnerResource,
  RadarHourly,
  RadarRow,
  ReportStage,
  Resource,
  ResourceDraft,
  ResourceType,
  ResourceWithEligibility,
  Result,
  Role,
  Rules,
  ScreensApi,
  Slot,
  SupervisorKind,
  TimelineEntry,
} from "./types";

// ---------------------------------------------------------------------------
// Rules: same values as A's labpass_config()
// ---------------------------------------------------------------------------
const RULES: Rules = {
  timezone: "Asia/Kolkata",
  max_active_bookings: 2,
  default_weekly_hours_per_resource: 6,
  weekly_credit_budget: 10,
  credits_per_hour: 1,
  credits_per_hour_specialised: 2,
  supervisor_reward_per_hour: 1,
  free_cancel_hours: 2,
  checkin_grace_minutes: 15,
  reminder_minutes: 60,
  waitlist_offer_minutes: 30,
  graduation_sessions: 3,
  no_show_flag_count: 3,
  no_show_window_days: 30,
  no_show_block_days: 7,
  photo_retention_days: 30,
  priority_base: 50,
  priority_fresh_bonus: 20,
  priority_fresh_days: 14,
  priority_deadline_bonus: 15,
  priority_per_week_hour: -5,
  priority_per_no_show: -25,
};

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
interface P { id: string; name: string; email: string; rollNo: string | null; departmentId: string | null; roles: Role[]; credits: number; status: "active" | "suspended"; blockedUntil: string | null; blockReason: string | null }
interface D { id: string; name: string; ownerId: string }
interface R { id: string; name: string; type: ResourceType; tier: number; location: string | null; photos: string[]; maxHours: number; weeklyCapHours: number; depositAmount: number; checklist: string[]; status: Resource["status"]; departmentId: string; managerId: string; code: string }
interface S { resourceId: string; weekday: number; start: string; end: string }
interface Bd { id: string; resourceId: string; tier: number; kind: "quiz" | "certificate" | "graduation"; name: string; description: string | null }
interface UB { id: string; userId: string; badgeId: string; status: "pending" | "approved" | "rejected" | "suspended"; path: string | null; ai: Record<string, unknown> | null; reason: string | null; submittedAt: string; grantedAt: string | null }
interface Q { resourceId: string; passMark: number; questions: { id: string; text: string; options: string[]; answer: string }[] }
interface SA { id: string; userId: string; resourceId: string; status: "pending" | "approved" | "rejected" | "suspended"; reason: string | null; createdAt: string }
interface SS { id: string; supervisorId: string; resourceId: string; start: string; end: string }
interface B { id: string; resourceId: string; userId: string; supervisorId: string | null; supervisorKind: SupervisorKind | null; start: string; end: string; purpose: string; status: BookingStatus; priorityScore: number; breakdown: Breakdown; checks: Record<string, Chk>; creditsCharged: number; reason: string | null; deadlineVerified: boolean; createdAt: string; updatedAt: string }
interface Chk { ok: boolean; blocking: boolean; message: string }
interface O { id: string; bookingId: string; offeredAt: string; expiresAt: string; status: "offered" | "accepted" | "expired" | "declined" }
interface CR { id: string; bookingId: string; stage: ReportStage; checklist: ChecklistAnswer[]; photoPaths: string[]; notes: string | null; signedBy: string[]; updatedAt: string }
interface I { id: string; bookingId: string; type: IncidentType; description: string; photoPaths: string[]; openedBy: string | null; aiSummary: string | null; aiPhotoDiff: string[] | null; decision: IncidentDecision | null; reason: string | null; penaltyCredits: number | null; blockUntil: string | null; userResponse: string | null; disputeOutcome: "upheld" | "overturned" | null; resolutionReason: string | null; status: IncidentStatus; createdAt: string }
interface L { userId: string; change: number; reason: string; bookingId: string | null; createdAt: string }
interface N { id: string; userId: string; type: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string }
interface A { id: string; bookingId: string; actorId: string | null; text: string; reason: string | null; at: string }
interface F { id: string; userId: string; source: "no_show_rule" | "ai_pattern"; evidence: Record<string, unknown>; proposedBlockDays: number | null; status: "pending" | "confirmed" | "dismissed"; createdAt: string }

interface Db {
  v: number;
  seededAt: number;
  people: P[]; departments: D[]; resources: R[]; slots: S[]; badges: Bd[]; userBadges: UB[]; quizzes: Q[];
  approvals: SA[]; supSlots: SS[]; bookings: B[]; offers: O[]; reports: CR[]; incidents: I[]; ledger: L[];
  notifications: N[]; activity: A[]; flags: F[];
}

// ---------------------------------------------------------------------------
// Time helpers (IST, fixed +05:30)
// ---------------------------------------------------------------------------
const IST = 330 * 60_000;
const H = 3_600_000;
const now = () => Date.now();
const iso = (t: number) => new Date(t).toISOString();
/** dayOffset days from today (IST), at hh:mm IST */
function at(dayOffset: number, hh: number, mm = 0) {
  const d = new Date(now() + IST);
  const y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate() + dayOffset;
  return iso(Date.UTC(y, m, day, hh, mm) - IST);
}
function soon(minutes: number) {
  const t = now() + minutes * 60_000;
  return iso(Math.ceil(t / (5 * 60_000)) * 5 * 60_000);
}
const istWeekday = (t: string) => (new Date(new Date(t).getTime() + IST).getUTCDay() + 6) % 7;
const istHHMM = (t: string) => new Date(new Date(t).getTime() + IST).toISOString().slice(11, 16);
const istDate = (t: string) => new Date(new Date(t).getTime() + IST).toISOString().slice(0, 10);
const hours = (s: string, e: string) => (new Date(e).getTime() - new Date(s).getTime()) / H;
const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) => new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const CHECKLISTS: Record<string, string[]> = {
  "Seminar room": ["Projector and remote present", "Chairs back in rows", "Whiteboard wiped"],
  "Robotics lab": ["Robot arms parked in home position", "Soldering irons off and cool", "Test track clear"],
  Oscilloscope: ["Four probes in the tray", "Screen has no cracks", "Power cable attached"],
  DSLR: ["Both lenses capped", "Two batteries in the bag", "Memory card in the slot", "No scratches on the sensor"],
  "3D printer": ["Print bed clean and level", "Nozzle clear", "Filament spool loaded", "Failed prints removed"],
  "Laser cutter": ["Extractor fan on", "Lens clean", "Honeycomb bed clear", "Fire blanket in place"],
};

function quizFor(resourceId: string, name: string): Q {
  const qs = [
    { text: `Before you start using the ${name}, what do you do first?`, options: ["Start straight away to save time", "Check its condition and complete the check-in checklist", "Ask a friend to check in for you", "Skip it if the lab is empty"], answer: 1 },
    { text: "You notice a cracked part at check-in. What now?", options: ["Ignore it", "Fix it yourself", "Mark it on the checklist and report an issue before use", "Hand the key back and leave"], answer: 2 },
    { text: "Your slot ends but your work isn't finished. What do you do?", options: ["Keep going until you're done", "Return it on time and book another slot", "Hide it for tomorrow", "Ask the next student to wait"], answer: 1 },
    { text: "Who do you tell first about a burn, shock or fire?", options: ["The staff on duty and the emergency number", "A group chat", "Only the LabPass issue form", "Nobody if it's small"], answer: 0 },
    { text: "Which of these is allowed?", options: ["Lending your booking to a friend", "Eating at the bench", "Using only the equipment you booked", "Taking equipment out of the room"], answer: 2 },
  ];
  return { resourceId, passMark: 80, questions: qs.map((q, i) => ({ id: `q${i + 1}`, text: q.text, options: q.options, answer: q.options[q.answer] })) };
}

function seed(): Db {
  const people: P[] = [
    { id: "u-priya", name: "Priya Sharma", email: "kulezteam+priya@gmail.com", rollNo: "CSE21001", departmentId: "d-cse", roles: ["student"], credits: 8, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-arjun", name: "Arjun Mehta", email: "kulezteam+arjun@gmail.com", rollNo: "CSE21002", departmentId: "d-cse", roles: ["student"], credits: 6, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-kavya", name: "Kavya Iyer", email: "kulezteam+supervisor@gmail.com", rollNo: "ECE20014", departmentId: "d-ece", roles: ["student"], credits: 12, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-rao", name: "Mr Rao", email: "kulezteam+rao@gmail.com", rollNo: null, departmentId: "d-ece", roles: ["manager"], credits: 0, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-menon", name: "Dr Menon", email: "kulezteam+owner@gmail.com", rollNo: null, departmentId: "d-ece", roles: ["manager"], credits: 0, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-admin", name: "LabPass Admin", email: "kulezteam+admin@gmail.com", rollNo: null, departmentId: null, roles: ["admin"], credits: 0, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-meera", name: "Meera Joshi", email: "meera.joshi@northfield.example", rollNo: "DES22009", departmentId: "d-des", roles: ["student"], credits: 7, status: "active", blockedUntil: null, blockReason: null },
    { id: "u-rohit", name: "Rohit Das", email: "rohit.das@northfield.example", rollNo: "CSE23018", departmentId: "d-cse", roles: ["student"], credits: 4, status: "active", blockedUntil: null, blockReason: null },
  ];
  const departments: D[] = [
    { id: "d-ece", name: "Electronics and Communication (ECE)", ownerId: "u-menon" },
    { id: "d-cse", name: "Computer Science (CSE)", ownerId: "u-admin" },
    { id: "d-des", name: "Design and Media", ownerId: "u-admin" },
  ];
  const mk = (id: string, name: string, type: ResourceType, tier: number, dept: string, location: string, maxHours: number, deposit: number, code: string): R => ({
    id, name, type, tier, location, photos: [], maxHours, weeklyCapHours: 6, depositAmount: deposit, checklist: CHECKLISTS[name], status: "active", departmentId: dept, managerId: "u-rao", code,
  });
  const resources: R[] = [
    mk("r-seminar", "Seminar room", "space", 0, "d-cse", "CSE Block, Room 204", 3, 0, "5EM1A204"),
    mk("r-robotics", "Robotics lab", "space", 1, "d-ece", "ECE Block, Lab 3", 3, 0, "40B0C7A3"),
    mk("r-scope", "Oscilloscope", "equipment", 1, "d-ece", "ECE Block, Lab 1, Bench 4", 3, 1000, "05C1110E"),
    mk("r-dslr", "DSLR", "equipment", 1, "d-des", "Media Centre, Equipment desk", 4, 2000, "D51A9C3E"),
    mk("r-printer", "3D printer", "specialised", 2, "d-ece", "ECE Block, Maker Space", 4, 500, "3D9A1F70"),
    mk("r-laser", "Laser cutter", "specialised", 3, "d-ece", "ECE Block, Maker Space", 2, 1000, "1A5E2C07"),
  ];
  const slots: S[] = resources.flatMap((r) => [0, 1, 2, 3, 4, 5].map((weekday) => ({ resourceId: r.id, weekday, start: "08:00", end: "20:00" })));
  const badges: Bd[] = [
    { id: "b-q-robotics", resourceId: "r-robotics", tier: 1, kind: "quiz", name: "Safety quiz — Robotics lab", description: "Passed the 5-question safety quiz." },
    { id: "b-q-scope", resourceId: "r-scope", tier: 1, kind: "quiz", name: "Safety quiz — Oscilloscope", description: "Passed the 5-question safety quiz." },
    { id: "b-q-dslr", resourceId: "r-dslr", tier: 1, kind: "quiz", name: "Safety quiz — DSLR", description: "Passed the 5-question safety quiz." },
    { id: "b-c-printer", resourceId: "r-printer", tier: 2, kind: "certificate", name: "Safety certificate — 3D printer", description: "Upload a 3D printing safety or training certificate; the manager reviews it." },
    { id: "b-c-laser", resourceId: "r-laser", tier: 2, kind: "certificate", name: "Safety certificate — Laser cutter", description: "Upload a laser safety certificate; the manager reviews it. Needed to become a peer supervisor." },
  ];
  const ub = (id: string, userId: string, badgeId: string, status: UB["status"], days: number, extra: Partial<UB> = {}): UB => ({ id, userId, badgeId, status, path: null, ai: null, reason: null, submittedAt: at(-days, 10), grantedAt: status === "approved" ? at(-days, 11) : null, ...extra });
  const userBadges: UB[] = [
    ub("ub1", "u-priya", "b-q-dslr", "approved", 9, { reason: "Passed the safety quiz (5/5)" }),
    ub("ub2", "u-arjun", "b-q-robotics", "approved", 12, { reason: "Passed the safety quiz (4/5)" }),
    ub("ub3", "u-kavya", "b-c-laser", "approved", 30, { reason: "Demo: laser safety certificate checked" }),
    ub("ub4", "u-kavya", "b-q-scope", "approved", 20, { reason: "Passed the safety quiz (5/5)" }),
    ub("ub5", "u-meera", "b-c-printer", "approved", 25, { reason: "FabLab certificate checked" }),
    ub("ub6", "u-priya", "b-c-printer", "pending", 0, {
      path: "u-priya/3d-printing-basics.png",
      ai: { name: "Priya S.", course: "3D Printing Basics (online)", issued: "3 Feb 2025", issuer: "OpenCourse", note: "Name is abbreviated and the certificate is older than 12 months. Check that it covers FDM printer safety." },
    }),
    ub("ub7", "u-rohit", "b-c-laser", "pending", 1, {
      path: "u-rohit/laser-safety-level1.pdf",
      ai: { name: "Rohit Das", course: "Laser Safety Level 1", issued: "12 Aug 2026", issuer: "Northfield FabLab", note: "Name and course match the profile; issued within 12 months. No mismatches found." },
    }),
  ];
  const quizzes = resources.filter((r) => r.tier === 1).map((r) => quizFor(r.id, r.name));
  const approvals: SA[] = [
    { id: "sa1", userId: "u-kavya", resourceId: "r-laser", status: "approved", reason: "Demo: approved peer supervisor", createdAt: at(-28, 10) },
    { id: "sa2", userId: "u-meera", resourceId: "r-printer", status: "pending", reason: null, createdAt: at(-1, 16) },
  ];
  const supSlots: SS[] = [];
  for (let d = 0; d < 14; d++) {
    supSlots.push({ id: `ss-k${d}`, supervisorId: "u-kavya", resourceId: "r-laser", start: at(d, 10), end: at(d, 17) });
    supSlots.push({ id: `ss-r${d}`, supervisorId: "u-rao", resourceId: "r-laser", start: at(d, 9), end: at(d, 13) });
  }

  const bd = (score: number, parts: Partial<Breakdown> = {}): Breakdown => ({ base: 50, fresh_resource: 0, verified_deadline: 0, hours_this_week: 0, hours_penalty: 0, no_shows_30d: 0, no_show_penalty: 0, total: score, ...parts });
  const ok = (msg: string): Chk => ({ ok: true, blocking: true, message: msg });
  const bk = (x: Partial<B> & Pick<B, "id" | "resourceId" | "userId" | "start" | "end" | "purpose" | "status">): B => ({
    supervisorId: null, supervisorKind: null, priorityScore: 70, breakdown: bd(70, { fresh_resource: 20 }), checks: { account: ok("Account in good standing") }, creditsCharged: 0, reason: null, deadlineVerified: false, createdAt: at(-2, 9), updatedAt: at(-2, 9), ...x,
  });
  const dslrStart = soon(10);
  const bookings: B[] = [
    bk({ id: "bk-101", resourceId: "r-dslr", userId: "u-priya", start: dslrStart, end: iso(new Date(dslrStart).getTime() + 2 * H), purpose: "Product photos of our IoT prototype for the project report", status: "approved", creditsCharged: 2, createdAt: at(-1, 18), reason: null }),
    bk({ id: "bk-102", resourceId: "r-seminar", userId: "u-priya", start: at(-6, 14), end: at(-6, 16), purpose: "Mini-project review with the team", status: "completed", creditsCharged: 2, createdAt: at(-8, 10) }),
    bk({ id: "bk-103", resourceId: "r-laser", userId: "u-arjun", supervisorId: "u-kavya", supervisorKind: "peer", start: at(1, 11), end: at(1, 13), purpose: "Acrylic enclosure for the line-follower robot", status: "approved", creditsCharged: 4, priorityScore: 70, breakdown: bd(70, { fresh_resource: 20 }), createdAt: at(-1, 8) }),
    bk({ id: "bk-104", resourceId: "r-laser", userId: "u-priya", supervisorId: "u-kavya", supervisorKind: "peer", start: at(1, 11), end: at(1, 13), purpose: "Cut a sensor housing for the IoT project", status: "waitlisted", priorityScore: 60, breakdown: bd(60, { fresh_resource: 20, hours_this_week: 2, hours_penalty: -10 }), reason: "An overlapping request was approved; you are on the waitlist in priority order", createdAt: at(-1, 9) }),
    bk({ id: "bk-105", resourceId: "r-robotics", userId: "u-arjun", start: at(1, 15), end: at(1, 17), purpose: "Calibration runs on the test track", status: "requested", createdAt: iso(now() - 50 * 60_000) }),
    bk({ id: "bk-106", resourceId: "r-seminar", userId: "u-meera", start: at(2, 10), end: at(2, 12), purpose: "Design jury rehearsal with 6 teammates", status: "requested", priorityScore: 70, breakdown: bd(70, { fresh_resource: 20 }), createdAt: at(0, 8) }),
    bk({ id: "bk-107", resourceId: "r-seminar", userId: "u-rohit", start: at(2, 10), end: at(2, 12), purpose: "Coding club hackathon planning", status: "requested", priorityScore: -5, breakdown: bd(-5, { fresh_resource: 20, no_shows_30d: 3, no_show_penalty: -75 }), createdAt: at(0, 7) }),
    bk({ id: "bk-108", resourceId: "r-scope", userId: "u-kavya", start: iso(now() - 70 * 60_000), end: iso(now() + 50 * 60_000), purpose: "Measuring PWM output of the motor driver", status: "checked_in", creditsCharged: 2, createdAt: at(-2, 12) }),
    bk({ id: "bk-109", resourceId: "r-printer", userId: "u-meera", start: at(-1, 10), end: at(-1, 13), purpose: "Gear housing prints for the drone", status: "returned", creditsCharged: 6, createdAt: at(-3, 12) }),
    bk({ id: "bk-110", resourceId: "r-laser", userId: "u-rohit", supervisorId: "u-kavya", supervisorKind: "peer", start: at(-9, 15), end: at(-9, 17), purpose: "Club badge cutting", status: "completed", creditsCharged: 4, createdAt: at(-11, 9) }),
    bk({ id: "bk-111", resourceId: "r-scope", userId: "u-rohit", start: at(-4, 10), end: at(-4, 12), purpose: "Signals lab practice", status: "no_show", creditsCharged: 2, reason: "No check-in within the grace period", createdAt: at(-6, 9) }),
    bk({ id: "bk-112", resourceId: "r-seminar", userId: "u-rohit", start: at(-12, 10), end: at(-12, 11), purpose: "Club meeting", status: "no_show", creditsCharged: 1, reason: "No check-in within the grace period", createdAt: at(-14, 9) }),
    bk({ id: "bk-113", resourceId: "r-robotics", userId: "u-rohit", start: at(-20, 14), end: at(-20, 16), purpose: "Robot demo prep", status: "no_show", creditsCharged: 2, reason: "No check-in within the grace period", createdAt: at(-22, 9) }),
    // Arjun's three clean supervised laser sessions → ready to graduate
    ...[-40, -33, -26].map((d, i) => bk({ id: `bk-12${i}`, resourceId: "r-laser", userId: "u-arjun", supervisorId: "u-kavya", supervisorKind: "peer", start: at(d, 14), end: at(d, 16), purpose: `Chassis panels v${i + 1}`, status: "completed", creditsCharged: 4, createdAt: at(d - 2, 9) })),
  ];
  const fullOk = (name: string) => CHECKLISTS[name].map((item) => ({ item, ok: true }));
  const rep = (id: string, bookingId: string, stage: ReportStage, name: string, signedBy: string[], t: string, extra: Partial<CR> = {}): CR => ({ id, bookingId, stage, checklist: fullOk(name), photoPaths: [`${bookingId}/${stage}.jpg`], notes: null, signedBy, updatedAt: t, ...extra });
  const reports: CR[] = [
    rep("cr1", "bk-102", "check_in", "Seminar room", ["u-priya"], at(-6, 14, 2)),
    rep("cr2", "bk-102", "return", "Seminar room", ["u-priya"], at(-6, 15, 58), { notes: "All good." }),
    rep("cr3", "bk-108", "check_in", "Oscilloscope", ["u-kavya"], iso(now() - 72 * 60_000)),
    rep("cr4", "bk-109", "check_in", "3D printer", ["u-meera"], at(-1, 10, 3)),
    rep("cr5", "bk-109", "return", "3D printer", ["u-meera"], at(-1, 13, 2), {
      checklist: CHECKLISTS["3D printer"].map((item, i) => ({ item, ok: i !== 0, note: i === 0 ? "Scratch near the front-left corner" : undefined })),
      notes: "Bed has a scratch near the front-left corner; not sure if it was there before.",
    }),
    rep("cr6", "bk-110", "check_in", "Laser cutter", ["u-rohit", "u-kavya"], at(-9, 15, 2)),
    rep("cr7", "bk-110", "return", "Laser cutter", ["u-rohit", "u-kavya"], at(-9, 17, 4), { checklist: CHECKLISTS["Laser cutter"].map((item, i) => ({ item, ok: i !== 1 })) }),
    ...[-40, -33, -26].flatMap((d, i) => [rep(`cr-a${i}`, `bk-12${i}`, "check_in", "Laser cutter", ["u-arjun", "u-kavya"], at(d, 14, 2)), rep(`cr-b${i}`, `bk-12${i}`, "return", "Laser cutter", ["u-arjun", "u-kavya"], at(d, 16, 2))]),
  ];
  const incidents: I[] = [
    {
      id: "in-201", bookingId: "bk-109", type: "damage", description: "Scratch on the print bed near the front-left corner. Not sure if it happened during my session.", photoPaths: ["bk-109/incident-1.jpg"], openedBy: "u-meera",
      aiSummary: "Meera reported a scratch on the print bed at return. The check-in checklist marked the bed clean and level; the return checklist marks it not OK. Her note says one print failed part-way. No other incidents on this printer in 30 days.",
      aiPhotoDiff: ["Possible scratch on the bed surface, front-left corner", "Filament residue on the nozzle that is not visible at check-in"],
      decision: null, reason: null, penaltyCredits: null, blockUntil: null, userResponse: null, disputeOutcome: null, resolutionReason: null, status: "open", createdAt: at(-1, 13, 10),
    },
    {
      id: "in-202", bookingId: "bk-110", type: "damage", description: "The lens had a burn mark after the session; the extractor was found switched off.", photoPaths: ["bk-110/incident-1.jpg"], openedBy: "u-rao",
      aiSummary: "The return checklist marks the lens as not clean. The supervisor co-signed both check-in and return. The extractor item was ticked at check-in.",
      aiPhotoDiff: ["Dark mark on the focus lens", "Extractor indicator light off in the return photo"],
      decision: "warning", reason: "Extractor left off caused smoke residue on the lens. First incident, so a warning only.", penaltyCredits: null, blockUntil: null,
      userResponse: "The extractor was on when I started; it tripped during the cut and I didn't notice. Kavya can confirm.", disputeOutcome: null, resolutionReason: null, status: "disputed", createdAt: at(-9, 17, 20),
    },
  ];
  const ledger: L[] = [
    { userId: "u-priya", change: 10, reason: "Weekly sponsored credit top-up", bookingId: null, createdAt: at(-3, 0, 1) },
    { userId: "u-priya", change: -2, reason: "Booking charge", bookingId: "bk-101", createdAt: at(-1, 19) },
    { userId: "u-arjun", change: 10, reason: "Weekly sponsored credit top-up", bookingId: null, createdAt: at(-3, 0, 1) },
    { userId: "u-arjun", change: -4, reason: "Booking charge", bookingId: "bk-103", createdAt: at(-1, 9) },
    { userId: "u-kavya", change: 2, reason: "Peer supervision reward", bookingId: "bk-110", createdAt: at(-9, 18) },
  ];
  const n = (userId: string, type: string, title: string, body: string, href: string | null, t: string): N => ({ id: uid("n"), userId, type, title, body, href, readAt: null, createdAt: t });
  const notifications: N[] = [
    n("u-priya", "booking_status", "DSLR booking approved", "Mr Rao approved your DSLR booking.", "/bookings/bk-101", at(-1, 19)),
    n("u-priya", "booking_status", "You're on the waitlist", "Laser cutter: an overlapping request was approved. You're in line by priority score.", "/bookings/bk-104", at(-1, 9)),
    n("u-priya", "reminder", "Starts within the hour", "DSLR. Check in within 15 minutes of the start.", "/bookings/bk-101", iso(now() - 5 * 60_000)),
    n("u-rao", "booking_request", "New request: Robotics lab", "Arjun Mehta asked for tomorrow 3–5 pm.", "/manage/requests/bk-105", iso(now() - 50 * 60_000)),
    n("u-rao", "booking_returned", "Return to confirm", "Meera Joshi returned the 3D printer.", "/manage/requests/bk-109", at(-1, 13, 3)),
    n("u-rao", "incident_opened", "Issue reported: 3D printer", "Meera Joshi reported damage.", "/incidents/in-201", at(-1, 13, 10)),
    n("u-rao", "certificate_review", "Certificate to review", "Priya Sharma — 3D printer.", "/manage/certificates/ub6", at(0, 9)),
    n("u-kavya", "supervision_assigned", "You're supervising", "Arjun Mehta · Laser cutter, tomorrow 11 am.", "/supervising", at(-1, 9)),
    n("u-admin", "incident_dispute", "Incident disputed", "Rohit Das disputed a warning on the Laser cutter.", "/admin/incidents/in-202", at(-8, 9)),
    n("u-admin", "restriction_review", "Restriction to review", "Rohit Das has 3 no-shows in 30 days.", "/admin/flags", at(-4, 13)),
  ];
  const a = (bookingId: string, actorId: string | null, text: string, t: string, reason: string | null = null): A => ({ id: uid("a"), bookingId, actorId, text, reason, at: t });
  const activity: A[] = [];
  for (const b of bookings) {
    activity.push(a(b.id, b.userId, "Requested the booking", b.createdAt, b.purpose));
    if (["approved", "checked_in", "returned", "completed", "no_show"].includes(b.status)) activity.push(a(b.id, "u-rao", "Approved the request", iso(new Date(b.createdAt).getTime() + H)));
    if (b.status === "waitlisted") activity.push(a(b.id, "u-rao", "Moved to the waitlist (an overlapping request was approved)", iso(new Date(b.createdAt).getTime() + H), b.reason));
    if (b.status === "no_show") activity.push(a(b.id, null, "Marked as a no-show (check-in window passed)", iso(new Date(b.start).getTime() + 16 * 60_000)));
  }
  for (const r of reports) {
    const b = bookings.find((x) => x.id === r.bookingId)!;
    activity.push(a(r.bookingId, b.userId, r.stage === "check_in" ? "Saved the check-in checklist and photo" : "Saved the return checklist and photo", r.updatedAt, r.notes));
    if (b.supervisorId && r.signedBy.includes(b.supervisorId)) activity.push(a(r.bookingId, b.supervisorId, r.stage === "check_in" ? "Co-signed the check-in report" : "Co-signed the return report", iso(new Date(r.updatedAt).getTime() + 60_000)));
    activity.push(a(r.bookingId, b.userId, r.stage === "check_in" ? "Checked in" : "Returned the resource", iso(new Date(r.updatedAt).getTime() + 2 * 60_000)));
    if (r.stage === "return" && b.status === "completed") activity.push(a(r.bookingId, "u-rao", "Confirmed the return", iso(new Date(r.updatedAt).getTime() + H / 2)));
  }
  activity.push(a("bk-109", "u-meera", "Reported an issue: damage", at(-1, 13, 10)));
  activity.push(a("bk-110", "u-rao", "Reported an issue: damage", at(-9, 17, 20)));
  activity.push(a("bk-110", "u-rao", "Decided the issue: warning", at(-8, 10), "Extractor left off caused smoke residue on the lens."));
  activity.push(a("bk-110", "u-rohit", "Disputed the decision", at(-8, 9), incidents[1].userResponse));
  const flags: F[] = [{ id: "fl-1", userId: "u-rohit", source: "no_show_rule", evidence: { no_shows: 3, window_days: 30 }, proposedBlockDays: 7, status: "pending", createdAt: at(-4, 13) }];

  return { v: 3, seededAt: Date.now(), people, departments, resources, slots, badges, userBadges, quizzes, approvals, supSlots, bookings, offers: [], reports, incidents, ledger, notifications, activity, flags };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const KEY = "labpass-mock-v3";
const SESSION = "labpass-mock-session";
let db: Db | null = null;
const listeners = new Set<() => void>();
const blobs = new Map<string, string>(); // uploaded photo path → object URL (this tab only)

function load(): Db {
  if (db) return db;
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Db;
      // Demo times are relative to "now"; start fresh if the saved demo is more than 6 hours old.
      if (parsed.v === 3 && Date.now() - (parsed.seededAt ?? 0) < 6 * H) return (db = parsed);
    }
  } catch {
    /* storage blocked */
  }
  return (db = seed());
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
  setTimeout(() => listeners.forEach((l) => l()), 0);
}
const wait = (ms = 160) => new Promise((r) => setTimeout(r, ms));
function sessionId(): string | null {
  try {
    return window.localStorage.getItem(SESSION);
  } catch {
    return null;
  }
}
function meRow(): P {
  const id = sessionId();
  const p = load().people.find((x) => x.id === id);
  if (!p) throw new Error("Please sign in again.");
  return p;
}
const person = (id: string | null) => (id ? load().people.find((p) => p.id === id) ?? null : null);
const res = (id: string) => load().resources.find((r) => r.id === id)!;
const dept = (id: string) => load().departments.find((d) => d.id === id);

function fail<T>(error: string, reasons?: string[]): Result<T> {
  return { ok: false, error, reasons };
}
function good<T>(data: T): Result<T> {
  return { ok: true, data };
}

function log(bookingId: string, actorId: string | null, text: string, reason: string | null = null) {
  load().activity.push({ id: uid("a"), bookingId, actorId, text, reason, at: iso(now()) });
}
function notify(userId: string | null, type: string, title: string, body: string, href: string | null) {
  if (!userId) return;
  load().notifications.push({ id: uid("n"), userId, type, title, body, href, readAt: null, createdAt: iso(now()) });
}
function credit(userId: string, change: number, reason: string, bookingId: string | null) {
  const p = person(userId)!;
  if (p.credits + change < 0) throw new Error("Not enough credits for this action");
  p.credits += change;
  load().ledger.push({ userId, change, reason, bookingId, createdAt: iso(now()) });
}

// --- derived permissions (mirror A's private helpers) ---
const hasRole = (p: P, r: Role) => p.status === "active" && p.roles.includes(r);
function managesResource(p: P, rid: string) {
  const r = res(rid);
  return hasRole(p, "admin") || (r.managerId === p.id && hasRole(p, "manager")) || dept(r.departmentId)?.ownerId === p.id;
}
function userTier(uid_: string, rid: string) {
  const d = load();
  return Math.max(0, ...d.userBadges.filter((u) => u.userId === uid_ && u.status === "approved").map((u) => d.badges.find((b) => b.id === u.badgeId)).filter((b) => b && b.resourceId === rid).map((b) => b!.tier));
}
function supervisorKind(uid_: string, rid: string): SupervisorKind | null {
  const p = person(uid_);
  if (!p) return null;
  if (managesResource(p, rid)) return "staff";
  if (p.status === "active" && userTier(uid_, rid) >= 2 && load().approvals.some((a) => a.userId === uid_ && a.resourceId === rid && a.status === "approved")) return "peer";
  return null;
}
function insideAvailability(rid: string, s: string, e: string) {
  if (istDate(s) !== istDate(e)) return false;
  const wd = istWeekday(s);
  return load().slots.some((x) => x.resourceId === rid && x.weekday === wd && x.start <= istHHMM(s) && x.end >= istHHMM(e));
}
function weekOf(t: string) {
  const local = new Date(new Date(t).getTime() + IST);
  const wd = (local.getUTCDay() + 6) % 7;
  const mon = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - wd) - IST;
  return { start: mon, end: mon + 7 * 24 * H };
}
const cost = (t: ResourceType, h: number) => Math.ceil(h * (t === "specialised" ? RULES.credits_per_hour_specialised : RULES.credits_per_hour));
const chk = (ok: boolean, blocking: boolean, message: string): Chk => ({ ok, blocking, message });

function bookingChecks(userId: string, rid: string, s: string, e: string, supId: string | null, exclude: string | null, forApproval: boolean) {
  const d = load();
  const r = res(rid);
  const p = person(userId)!;
  const h = hours(s, e);
  const checks: Record<string, Chk> = {};
  let needsSup = false;
  let kind: SupervisorKind | null = null;
  checks.account = p.status !== "active" ? chk(false, true, "Your account is not active") : p.blockedUntil && new Date(p.blockedUntil).getTime() > now() ? chk(false, true, `Booking is blocked until ${new Date(p.blockedUntil).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}${p.blockReason ? ` (${p.blockReason})` : ""}`) : chk(true, true, "Account in good standing");
  checks.resource = r.status === "active" ? chk(true, true, "Resource is open for booking") : r.status === "maintenance" ? chk(false, true, "Resource is under maintenance") : chk(false, true, "Resource is not currently offered");
  checks.time = new Date(s).getTime() <= now() ? chk(false, true, "Start time must be in the future") : h > r.maxHours ? chk(false, true, `${round(h)} h requested; the maximum per booking is ${r.maxHours} h`) : chk(true, true, `${round(h)} h, within the ${r.maxHours} h limit`);
  checks.availability = insideAvailability(rid, s, e) ? chk(true, true, "Inside the published availability") : chk(false, true, "Outside the hours this resource is offered");
  const t = userTier(userId, rid);
  if (r.tier === 0) checks.eligibility = chk(true, true, "Open to every verified student");
  else if (r.tier === 1) checks.eligibility = t >= 1 ? chk(true, true, "Safety quiz passed") : chk(false, true, "Needs quiz: pass the safety quiz for this resource");
  else if (r.tier === 2) checks.eligibility = t >= 2 ? chk(true, true, "Certificate approved or graduated") : chk(false, true, "Needs certificate: upload a certificate for manager review");
  else if (t >= 2) checks.eligibility = chk(true, true, "Graduated: independent use allowed");
  else {
    needsSup = true;
    checks.eligibility = chk(true, true, "Supervised use: a supervisor is required");
  }
  if (!supId) checks.supervisor = needsSup ? chk(false, true, "Needs supervisor: choose a staff or peer supervisor with hours covering this slot") : chk(true, true, "No supervisor needed");
  else {
    kind = supervisorKind(supId, rid);
    checks.supervisor =
      supId === userId ? chk(false, true, "You cannot supervise your own booking")
      : !kind ? chk(false, true, "This person is not an approved supervisor for this resource")
      : !d.supSlots.some((x) => x.supervisorId === supId && x.resourceId === rid && new Date(x.start) <= new Date(s) && new Date(x.end) >= new Date(e)) ? chk(false, true, "The supervisor has not published hours covering this slot")
      : d.bookings.some((b) => b.supervisorId === supId && b.id !== exclude && ["approved", "checked_in", "overdue"].includes(b.status) && overlaps(b, { start: s, end: e })) ? chk(false, true, "The supervisor is already supervising another session then")
      : chk(true, true, `${kind[0].toUpperCase()}${kind.slice(1)} supervisor confirmed for this slot`);
  }
  const clash = d.bookings.some((b) => b.resourceId === rid && b.id !== exclude && ["approved", "checked_in", "overdue"].includes(b.status) && overlaps(b, { start: s, end: e }));
  checks.conflict = clash ? (forApproval ? chk(false, true, "The slot is already approved for someone else") : chk(false, false, "The slot is taken; you can still request it and be waitlisted")) : chk(true, true, "No conflicting approved booking");
  const wk = weekOf(s);
  const weekSt: BookingStatus[] = forApproval ? ["approved", "checked_in", "overdue", "returned", "completed", "no_show"] : ["requested", "approved", "checked_in", "overdue", "returned", "completed", "no_show"];
  const used = d.bookings.filter((b) => b.userId === userId && b.resourceId === rid && b.id !== exclude && weekSt.includes(b.status) && new Date(b.start).getTime() >= wk.start && new Date(b.start).getTime() < wk.end).reduce((x, b) => x + hours(b.start, b.end), 0);
  checks.weekly_cap = chk(used + h <= r.weeklyCapHours, true, `${round(used + h)} of ${r.weeklyCapHours} h this week on this resource`);
  const actSt: BookingStatus[] = forApproval ? ["approved", "checked_in", "overdue"] : ["requested", "approved", "checked_in", "overdue"];
  const n = d.bookings.filter((b) => b.userId === userId && b.id !== exclude && actSt.includes(b.status)).length;
  checks.active_limit = chk(n < RULES.max_active_bookings, true, `${n} of ${RULES.max_active_bookings} active bookings in use`);
  const c = cost(r.type, h);
  checks.credits = chk(p.credits >= c, true, `Costs ${c} credits; balance ${p.credits}`);
  const openInc = d.incidents.filter((i) => ["open", "under_review"].includes(i.status) && d.bookings.find((b) => b.id === i.bookingId)?.userId === userId).length;
  checks.open_incidents = openInc === 0 ? chk(true, true, "No open incidents") : chk(false, true, `${openInc} open incident(s) must be resolved first`);
  const okAll = !Object.values(checks).some((x) => !x.ok && x.blocking);
  return { ok: okAll, cost: c, needsSupervisor: needsSup, supervisorKind: kind, checks };
}
const round = (n: number) => Math.round(n * 100) / 100;
const failures = (checks: Record<string, Chk>) => Object.entries(checks).filter(([, v]) => !v.ok && v.blocking).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v.message);

function priority(userId: string, rid: string, s: string, deadline: boolean, exclude: string | null) {
  const d = load();
  const fresh = !d.bookings.some((b) => b.userId === userId && b.resourceId === rid && b.id !== exclude && ["approved", "checked_in", "overdue", "returned", "completed", "no_show"].includes(b.status) && new Date(b.start).getTime() >= now() - RULES.priority_fresh_days * 24 * H);
  const wk = weekOf(s);
  const h = d.bookings.filter((b) => b.userId === userId && b.id !== exclude && ["approved", "checked_in", "overdue", "returned", "completed", "no_show"].includes(b.status) && new Date(b.start).getTime() >= wk.start && new Date(b.start).getTime() < wk.end).reduce((x, b) => x + hours(b.start, b.end), 0);
  const ns = d.bookings.filter((b) => b.userId === userId && b.status === "no_show" && new Date(b.start).getTime() >= now() - RULES.no_show_window_days * 24 * H).length;
  const score = RULES.priority_base + (fresh ? RULES.priority_fresh_bonus : 0) + (deadline ? RULES.priority_deadline_bonus : 0) + RULES.priority_per_week_hour * h + RULES.priority_per_no_show * ns;
  const breakdown: Breakdown = { base: RULES.priority_base, fresh_resource: fresh ? RULES.priority_fresh_bonus : 0, verified_deadline: deadline ? RULES.priority_deadline_bonus : 0, hours_this_week: round(h), hours_penalty: round(RULES.priority_per_week_hour * h), no_shows_30d: ns, no_show_penalty: RULES.priority_per_no_show * ns, total: round(score) };
  return { score: round(score), breakdown };
}

function offerFreedSlots(rid: string) {
  const d = load();
  const queue = d.bookings.filter((b) => b.resourceId === rid && b.status === "waitlisted" && new Date(b.start).getTime() > now() + 60_000).sort((a, b) => b.priorityScore - a.priorityScore || a.createdAt.localeCompare(b.createdAt));
  for (const w of queue) {
    if (d.offers.some((o) => o.bookingId === w.id)) continue;
    if (d.bookings.some((x) => x.resourceId === rid && ["approved", "checked_in", "overdue"].includes(x.status) && overlaps(x, w))) continue;
    if (d.offers.some((o) => o.status === "offered" && overlaps(d.bookings.find((x) => x.id === o.bookingId)!, w) && d.bookings.find((x) => x.id === o.bookingId)!.resourceId === rid)) continue;
    const exp = Math.min(now() + RULES.waitlist_offer_minutes * 60_000, new Date(w.start).getTime());
    d.offers.push({ id: uid("of"), bookingId: w.id, offeredAt: iso(now()), expiresAt: iso(exp), status: "offered" });
    log(w.id, null, "Offered the freed slot", "Slot freed; offered in priority order");
    notify(w.userId, "waitlist_offer", "A slot opened up for you", `${res(rid).name}: accept within ${RULES.waitlist_offer_minutes} minutes.`, `/bookings/${w.id}`);
  }
}

function setStatus(b: B, status: BookingStatus, reason?: string | null) {
  b.status = status;
  if (reason !== undefined) b.reason = reason;
  b.updatedAt = iso(now());
  const r = res(b.resourceId);
  const labels: Partial<Record<BookingStatus, string>> = { approved: "approved", rejected: "rejected", waitlisted: "waitlisted", cancelled: "cancelled", checked_in: "checked in", returned: "returned", completed: "completed", no_show: "marked as a no-show", overdue: "overdue" };
  notify(b.userId, "booking_status", `${r.name}: ${labels[status] ?? status}`, b.reason ?? `Your booking is now ${labels[status] ?? status}.`, `/bookings/${b.id}`);
  if (status === "approved" && b.supervisorId) notify(b.supervisorId, "supervision_assigned", "You're supervising", `${person(b.userId)?.name} · ${r.name}`, "/supervising");
  if (["returned", "overdue", "no_show"].includes(status)) notify(r.managerId, `booking_${status}`, `${r.name}: ${labels[status]}`, `${person(b.userId)?.name}`, `/manage/requests/${b.id}`);
}

/** The mock's stand-in for pg_cron's run_scheduled_jobs(): no-shows, overdue, offer expiry, stale requests. */
function runJobs() {
  const d = load();
  let changed = false;
  for (const b of d.bookings) {
    if (b.status === "checked_in" && new Date(b.end).getTime() < now()) {
      setStatus(b, "overdue", "End time passed without a return");
      log(b.id, null, "Marked overdue (end time passed without a return)");
      changed = true;
    }
    if (b.status === "approved" && new Date(b.start).getTime() < now() - RULES.checkin_grace_minutes * 60_000) {
      setStatus(b, "no_show", "No check-in within the grace period");
      log(b.id, null, "Marked as a no-show (check-in window passed)");
      offerFreedSlots(b.resourceId);
      changed = true;
    }
    if (["requested", "waitlisted"].includes(b.status) && new Date(b.start).getTime() <= now()) {
      setStatus(b, "cancelled", "The slot started before the request could be approved");
      changed = true;
    }
  }
  for (const o of d.offers) {
    if (o.status === "offered" && new Date(o.expiresAt).getTime() <= now()) {
      o.status = "expired";
      const b = d.bookings.find((x) => x.id === o.bookingId)!;
      log(b.id, null, "Waitlist offer expired");
      offerFreedSlots(b.resourceId);
      changed = true;
    }
  }
  if (changed) save();
}

// ---------------------------------------------------------------------------
// View mapping
// ---------------------------------------------------------------------------
function viewResource(r: R): Resource {
  const dd = dept(r.departmentId);
  return {
    id: r.id, name: r.name, type: r.type, tier: r.tier, location: r.location, photos: r.photos, photoUrl: r.photos[0] ? blobs.get(r.photos[0]) ?? null : null,
    art: artFor(r.name, r.type), maxHours: r.maxHours, weeklyCapHours: r.weeklyCapHours, depositAmount: r.depositAmount, checklist: r.checklist, status: r.status,
    departmentId: r.departmentId, departmentName: dd?.name ?? "", managerId: r.managerId,
    slots: load().slots.filter((s) => s.resourceId === r.id).map((s): Slot => ({ weekday: s.weekday, start: s.start, end: s.end })).sort((a, b) => a.weekday - b.weekday),
  };
}
function viewBooking(b: B): Booking {
  const u = person(b.userId);
  const offer = load().offers.find((o) => o.bookingId === b.id && o.status === "offered" && new Date(o.expiresAt).getTime() > now());
  return {
    id: b.id, resource: viewResource(res(b.resourceId)), userId: b.userId, userName: u?.name ?? null, userRollNo: u?.rollNo ?? null,
    supervisorId: b.supervisorId, supervisorName: person(b.supervisorId)?.name ?? null, supervisorKind: b.supervisorKind,
    start: b.start, end: b.end, purpose: b.purpose, status: b.status, priorityScore: b.priorityScore, breakdown: b.breakdown,
    checks: checksList(b.checks), creditsCharged: b.creditsCharged, reason: b.reason, deadlineVerified: b.deadlineVerified, createdAt: b.createdAt,
    liveOffer: offer ? { id: offer.id, expiresAt: offer.expiresAt } : null,
  };
}
const viewReport = (r: CR): ConditionReport => ({ id: r.id, bookingId: r.bookingId, stage: r.stage, checklist: r.checklist, photoPaths: r.photoPaths, notes: r.notes, signedBy: r.signedBy, updatedAt: r.updatedAt });
function viewIncident(i: I): Incident {
  return { ...i, booking: viewBooking(load().bookings.find((b) => b.id === i.bookingId)!), openedByName: person(i.openedBy)?.name ?? null };
}
function me(): Me {
  const p = meRow();
  const d = load();
  return {
    id: p.id, name: p.name, email: p.email, rollNo: p.rollNo, departmentId: p.departmentId, departmentName: p.departmentId ? dept(p.departmentId)?.name ?? null : null,
    roles: p.roles, credits: p.credits, status: p.status, blockedUntil: p.blockedUntil, blockReason: p.blockReason,
    ownedDepartmentIds: d.departments.filter((x) => x.ownerId === p.id).map((x) => x.id),
    supervises: d.approvals.filter((a) => a.userId === p.id && a.status === "approved").map((a) => a.resourceId),
  };
}
function eligibilityOf(p: P, r: R): Eligibility {
  if (p.status !== "active" || (p.blockedUntil && new Date(p.blockedUntil).getTime() > now())) return { status: "blocked", until: p.blockedUntil, reason: p.blockReason };
  const t = userTier(p.id, r.id);
  const status = r.tier === 0 || (r.tier === 1 && t >= 1) || (r.tier >= 2 && t >= 2) ? "eligible" : r.tier === 1 ? "needs_quiz" : r.tier === 2 ? "needs_certificate" : "needs_supervisor";
  return { status, resourceTier: r.tier, yourTier: t };
}
function visibleBookings(p: P) {
  return load().bookings.filter((b) => b.userId === p.id || b.supervisorId === p.id || managesResource(p, b.resourceId));
}
function badgesOf(userId: string): BadgeHeld[] {
  const d = load();
  return d.userBadges
    .filter((u) => u.userId === userId)
    .map((u) => {
      const b = d.badges.find((x) => x.id === u.badgeId)!;
      return { userBadgeId: u.id, badgeId: b.id, kind: b.kind, tier: b.tier, name: b.name, resourceId: b.resourceId, resourceName: res(b.resourceId).name, status: u.status, reason: u.reason, submittedAt: u.submittedAt, grantedAt: u.grantedAt };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
function viewCert(u: UB): CertificateSubmission {
  const b = load().badges.find((x) => x.id === u.badgeId)!;
  const p = person(u.userId);
  return { userBadgeId: u.id, badgeId: b.id, userId: u.userId, userName: p?.name ?? null, userRollNo: p?.rollNo ?? null, resourceId: b.resourceId, resourceName: res(b.resourceId).name, path: u.path, status: u.status, reason: u.reason, aiExtraction: u.ai, submittedAt: u.submittedAt };
}
function cleanSessions(userId: string, rid: string) {
  const d = load();
  return d.bookings.filter(
    (b) =>
      b.userId === userId && b.resourceId === rid && b.status === "completed" && b.supervisorId &&
      d.reports.some((r) => r.bookingId === b.id && r.stage === "return" && r.signedBy.includes(b.supervisorId!)) &&
      !d.incidents.some((i) => i.bookingId === b.id && (i.status !== "closed" || (i.decision && i.decision !== "no_action" && i.disputeOutcome !== "overturned"))),
  ).length;
}
function graduation(userId: string, rid: string): GraduationProgress {
  const c = cleanSessions(userId, rid);
  const t = userTier(userId, rid);
  return { cleanSessions: c, required: RULES.graduation_sessions, graduated: t >= 2, readyForSignoff: c >= RULES.graduation_sessions && t < 2 };
}

function guard<T>(fn: () => Result<T>): Promise<Result<T>> {
  return wait().then(() => {
    try {
      const r = fn();
      save();
      return r;
    } catch (e) {
      return fail<T>(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
/** A's demo accounts (seed-demo-setup.sql). Same emails in mock and real mode. */
export const DEMO_ACCOUNTS = [
  { id: "u-priya", label: "Priya", role: "Student", email: "kulezteam+priya@gmail.com" },
  { id: "u-arjun", label: "Arjun", role: "Student, waitlist", email: "kulezteam+arjun@gmail.com" },
  { id: "u-kavya", label: "Kavya", role: "Peer supervisor", email: "kulezteam+supervisor@gmail.com" },
  { id: "u-rao", label: "Mr Rao", role: "Lab manager", email: "kulezteam+rao@gmail.com" },
  { id: "u-menon", label: "Dr Menon", role: "Owner, ECE", email: "kulezteam+owner@gmail.com" },
  { id: "u-admin", label: "Admin", role: "Platform admin", email: "kulezteam+admin@gmail.com" },
];

export function mockSignInAs(id: string) {
  try {
    window.localStorage.setItem(SESSION, id);
  } catch {
    /* ignore */
  }
  setTimeout(() => listeners.forEach((l) => l()), 0);
}

/** Demo only: the code printed under a resource's QR, so the check-in screen can show it as a hint. */
export function mockCheckinCode(resourceId: string) {
  return load().resources.find((r) => r.id === resourceId)?.code ?? null;
}

export function mockReset() {
  db = seed();
  blobs.clear();
  save();
}

export const mockApi: ScreensApi = {
  async getMe() {
    await wait(60);
    runJobs();
    try {
      return me();
    } catch {
      return null;
    }
  },
  async signIn(email) {
    await wait();
    const p = load().people.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!p) return fail("That email and password don't match. On the demo, use one of the demo accounts.");
    mockSignInAs(p.id);
    return good(me());
  },
  async signUp({ name, email, rollNo }) {
    await wait();
    const d = load();
    if (d.people.some((p) => p.email.toLowerCase() === email.trim().toLowerCase())) return fail("An account with this email already exists. Sign in instead.");
    const p: P = { id: uid("u"), name: name.trim(), email: email.trim(), rollNo: rollNo.trim() || null, departmentId: null, roles: ["student"], credits: 0, status: "active", blockedUntil: null, blockReason: null };
    d.people.push(p);
    credit(p.id, RULES.weekly_credit_budget, "Starting sponsored credits", null);
    save();
    mockSignInAs(p.id);
    return good({ needsConfirmation: false });
  },
  async signOut() {
    try {
      window.localStorage.removeItem(SESSION);
    } catch {
      /* ignore */
    }
  },
  async getRules() {
    return RULES;
  },
  async listDepartments() {
    await wait(60);
    return load().departments.map(({ id, name }): Department => ({ id, name }));
  },

  async listResources(f) {
    await wait();
    const p = meRow();
    let rows = load().resources.filter((r) => r.status === "active");
    if (f.type) rows = rows.filter((r) => r.type === f.type);
    if (f.department) rows = rows.filter((r) => r.departmentId === f.department);
    if (f.tier) rows = rows.filter((r) => String(r.tier) === f.tier);
    if (f.q) rows = rows.filter((r) => `${r.name} ${r.location} ${dept(r.departmentId)?.name}`.toLowerCase().includes(f.q!.toLowerCase()));
    if (f.date) {
      const wd = istWeekday(`${f.date}T12:00:00+05:30`);
      rows = rows.filter((r) => load().slots.some((s) => s.resourceId === r.id && s.weekday === wd));
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name)).map((r) => ({ ...viewResource(r), eligibility: eligibilityOf(p, r) }));
  },
  async getResource(id) {
    await wait();
    const p = meRow();
    const r = load().resources.find((x) => x.id === id);
    if (!r || (r.status !== "active" && !managesResource(p, id))) throw new Error("This resource isn't available.");
    return { ...viewResource(r), eligibility: eligibilityOf(p, r) } satisfies ResourceWithEligibility;
  },
  async getBusyTimes(rid, from, to) {
    await wait(80);
    return load().bookings.filter((b) => b.resourceId === rid && ["approved", "checked_in", "overdue"].includes(b.status) && overlaps(b, { start: from, end: to })).map((b) => ({ start: b.start, end: b.end }));
  },
  async listSupervisorAvailability(rid, from, to) {
    await wait(80);
    return load()
      .supSlots.filter((s) => s.resourceId === rid && overlaps(s, { start: from, end: to }) && supervisorKind(s.supervisorId, rid))
      .map((s) => ({ slotId: s.id, supervisorId: s.supervisorId, supervisorName: person(s.supervisorId)?.name ?? "", kind: supervisorKind(s.supervisorId, rid)!, start: s.start, end: s.end }))
      .sort((a, b) => a.start.localeCompare(b.start));
  },

  evaluateBooking: (rid, s, e, sup) =>
    guard(() => {
      const p = meRow();
      if (new Date(e) <= new Date(s)) return fail("Booking time range is invalid");
      const r = bookingChecks(p.id, rid, s, e, sup ?? null, null, false);
      const pr = priority(p.id, rid, s, false, null);
      return good({ ok: r.ok, cost: r.cost, needsSupervisor: r.needsSupervisor, supervisorKind: r.supervisorKind, checks: checksList(r.checks), priority: pr });
    }),
  requestBooking: (rid, s, e, purpose, sup) =>
    guard(() => {
      const p = meRow();
      if (!purpose.trim()) return fail("Please describe the purpose (1–2000 characters)");
      const r = bookingChecks(p.id, rid, s, e, sup ?? null, null, false);
      if (!r.ok) return fail(`Booking blocked: ${failures(r.checks).join("; ")}`, failures(r.checks));
      const pr = priority(p.id, rid, s, false, null);
      const b: B = { id: uid("bk"), resourceId: rid, userId: p.id, supervisorId: sup ?? null, supervisorKind: r.supervisorKind, start: s, end: e, purpose: purpose.trim(), status: "requested", priorityScore: pr.score, breakdown: pr.breakdown, checks: r.checks, creditsCharged: 0, reason: null, deadlineVerified: false, createdAt: iso(now()), updatedAt: iso(now()) };
      load().bookings.push(b);
      log(b.id, p.id, "Requested the booking", b.purpose);
      notify(res(rid).managerId, "booking_request", `New request: ${res(rid).name}`, `${p.name} asked for a slot.`, `/manage/requests/${b.id}`);
      return good({ bookingId: b.id });
    }),
  async listMyBookings() {
    await wait();
    runJobs();
    const p = meRow();
    return load().bookings.filter((b) => b.userId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(viewBooking);
  },
  async getBooking(id) {
    await wait();
    runJobs();
    const p = meRow();
    const d = load();
    const b = d.bookings.find((x) => x.id === id);
    if (!b || !visibleBookings(p).includes(b)) throw new Error("Booking not found, or you don't have access to it.");
    const canManage = managesResource(p, b.resourceId);
    const nameOf = (aid: string | null) => {
      if (!aid) return "LabPass";
      if (aid === p.id || aid === b.userId || aid === b.supervisorId || canManage) return person(aid)?.name ?? "Lab staff";
      return "Lab staff";
    };
    const timeline: TimelineEntry[] = d.activity.filter((a) => a.bookingId === id).sort((a, c) => a.at.localeCompare(c.at)).map((a) => ({ id: a.id, at: a.at, actor: nameOf(a.actorId), text: a.text, reason: a.reason }));
    const detail: BookingDetail = {
      booking: viewBooking(b),
      reports: d.reports.filter((r) => r.bookingId === id).map(viewReport),
      incidents: d.incidents.filter((i) => i.bookingId === id).map(viewIncident),
      timeline,
      competing: canManage ? d.bookings.filter((x) => x.id !== id && x.resourceId === b.resourceId && ["requested", "approved", "waitlisted"].includes(x.status) && overlaps(x, b)).map(viewBooking) : [],
    };
    return detail;
  },
  cancelBooking: (id, reason) =>
    guard(() => {
      const p = meRow();
      const b = load().bookings.find((x) => x.id === id);
      if (!b) return fail("Booking not found");
      const owner = b.userId === p.id;
      if (!owner && !managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (!owner && !reason?.trim()) return fail("A reason is required when a manager cancels a booking");
      if (!["requested", "approved", "waitlisted"].includes(b.status)) return fail("Booking cannot be cancelled in its current state");
      const wasApproved = b.status === "approved";
      let refund = 0;
      if (wasApproved && b.creditsCharged > 0 && (!owner || new Date(b.start).getTime() - now() > RULES.free_cancel_hours * H)) refund = b.creditsCharged;
      setStatus(b, "cancelled", reason?.trim() || "Cancelled by student");
      load().offers.filter((o) => o.bookingId === id && o.status === "offered").forEach((o) => (o.status = "expired"));
      log(b.id, p.id, "Cancelled the booking", b.reason);
      if (refund) credit(b.userId, refund, owner ? "Refund: free cancellation" : "Refund: cancelled by manager", b.id);
      if (wasApproved) offerFreedSlots(b.resourceId);
      return good({ refundedCredits: refund });
    }),
  decideBooking: (id, decision, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === id);
      if (!b || !managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (b.status !== "requested") return fail("Only requested bookings can be decided");
      const why = reason?.trim() || null;
      if (decision !== "approved" && !why) return fail(`A written reason is required to ${decision === "rejected" ? "reject" : "waitlist"} a request`);
      if (decision === "approved") {
        const r = bookingChecks(b.userId, b.resourceId, b.start, b.end, b.supervisorId, b.id, true);
        if (!r.ok) return fail(`Cannot approve: ${failures(r.checks).join("; ")}`, failures(r.checks));
        b.checks = r.checks;
        b.creditsCharged = r.cost;
        setStatus(b, "approved", why);
        log(b.id, p.id, "Approved the request", why);
        credit(b.userId, -r.cost, "Booking charge", b.id);
        for (const o of d.bookings.filter((x) => x.resourceId === b.resourceId && x.status === "requested" && x.id !== b.id && overlaps(x, b))) {
          setStatus(o, "waitlisted", "An overlapping request was approved; you are on the waitlist in priority order");
          log(o.id, p.id, "Moved to the waitlist (an overlapping request was approved)", o.reason);
        }
      } else {
        setStatus(b, decision, why);
        log(b.id, p.id, decision === "rejected" ? "Rejected the request" : "Waitlisted the request", why);
      }
      return good(undefined);
    }),
  setDeadlineVerified: (id, verified, reason) =>
    guard(() => {
      const p = meRow();
      const b = load().bookings.find((x) => x.id === id);
      if (!b || !managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (!["requested", "waitlisted"].includes(b.status)) return fail("Only pending or waitlisted requests can be rescored");
      if (!reason.trim()) return fail("A reason is required");
      const pr = priority(b.userId, b.resourceId, b.start, verified, b.id);
      b.deadlineVerified = verified;
      b.priorityScore = pr.score;
      b.breakdown = pr.breakdown;
      log(b.id, p.id, "Updated the faculty-verified deadline", reason.trim());
      return good(pr);
    }),
  async listRequests(scope) {
    await wait();
    runJobs();
    const p = meRow();
    const rows = load().bookings.filter((b) => managesResource(p, b.resourceId) && (scope === "all" || b.status === "requested"));
    return rows.sort((a, b) => (scope === "requested" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt))).map(viewBooking);
  },
  async listConflicts() {
    await wait();
    const p = meRow();
    const pool = load().bookings.filter((b) => managesResource(p, b.resourceId) && ["requested", "approved", "waitlisted"].includes(b.status) && new Date(b.end).getTime() > now()).map(viewBooking);
    const groups: ConflictGroup[] = [];
    for (const b of pool.sort((x, y) => x.start.localeCompare(y.start))) {
      const g = groups.find((x) => x.resource.id === b.resource.id && overlaps(x, b));
      if (g) {
        g.requests.push(b);
        if (b.end > g.end) g.end = b.end;
      } else groups.push({ key: `${b.resource.id}__${b.start}`, resource: b.resource, start: b.start, end: b.end, requests: [b] });
    }
    return groups.filter((g) => g.requests.length > 1 && g.requests.some((r) => r.status !== "approved")).map((g) => ({ ...g, requests: g.requests.sort((a, c) => c.priorityScore - a.priorityScore || a.createdAt.localeCompare(c.createdAt)) }));
  },
  async listPendingReturns() {
    await wait();
    const p = meRow();
    return load().bookings.filter((b) => b.status === "returned" && managesResource(p, b.resourceId)).map(viewBooking);
  },
  async listAllBookings() {
    await wait();
    const p = meRow();
    return visibleBookings(p).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(viewBooking);
  },

  getMyWaitlistRank: (id) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === id);
      if (!b || (b.userId !== p.id && !managesResource(p, b.resourceId))) return fail("You don't have permission to do this.");
      if (b.status !== "waitlisted") return fail("Booking is not waitlisted");
      const same = d.bookings.filter((x) => x.resourceId === b.resourceId && x.status === "waitlisted" && overlaps(x, b));
      const rank = same.filter((x) => x.id !== b.id && (x.priorityScore > b.priorityScore || (x.priorityScore === b.priorityScore && x.createdAt < b.createdAt))).length + 1;
      const o = d.offers.find((x) => x.bookingId === b.id && x.status === "offered");
      return good({ rank, of: same.length, score: b.priorityScore, breakdown: b.breakdown, liveOffer: o ? { id: o.id, expiresAt: o.expiresAt } : null });
    }),
  acceptWaitlistOffer: (offerId) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const o = d.offers.find((x) => x.id === offerId);
      if (!o) return fail("Offer not found");
      const b = d.bookings.find((x) => x.id === o.bookingId)!;
      if (b.userId !== p.id) return fail("You don't have permission to do this.");
      if (o.status !== "offered" || new Date(o.expiresAt).getTime() <= now() || b.status !== "waitlisted") return fail("This offer is no longer valid");
      const r = bookingChecks(b.userId, b.resourceId, b.start, b.end, b.supervisorId, b.id, true);
      if (!r.ok) return fail(`Cannot accept: ${failures(r.checks).join("; ")}`, failures(r.checks));
      b.checks = r.checks;
      b.creditsCharged = r.cost;
      setStatus(b, "approved", "Waitlist offer accepted");
      log(b.id, p.id, "Accepted the waitlist offer");
      credit(b.userId, -r.cost, "Booking charge (waitlist offer)", b.id);
      o.status = "accepted";
      return good(undefined);
    }),
  declineWaitlistOffer: (offerId) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const o = d.offers.find((x) => x.id === offerId);
      if (!o) return fail("Offer not found");
      const b = d.bookings.find((x) => x.id === o.bookingId)!;
      if (b.userId !== p.id) return fail("You don't have permission to do this.");
      if (o.status !== "offered") return fail("This offer is no longer open");
      o.status = "declined";
      setStatus(b, "cancelled", "Declined the waitlist offer");
      log(b.id, p.id, "Declined the waitlist offer");
      offerFreedSlots(b.resourceId);
      return good(undefined);
    }),

  async uploadEvidencePhoto(bookingId, file) {
    await wait(300);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail("Photos must be JPG, PNG or WebP.");
    if (file.size > 10 * 1024 * 1024) return fail("That photo is over 10 MB.");
    const path = `${bookingId}/${uid("photo")}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    try {
      blobs.set(path, URL.createObjectURL(file));
    } catch {
      /* no object URLs */
    }
    return good({ path });
  },
  async getConditionPhotoUrls(paths) {
    await wait(60);
    const out: Record<string, string> = {};
    for (const p of paths) {
      const blob = blobs.get(p);
      if (blob) out[p] = blob;
      else {
        const b = load().bookings.find((x) => p.startsWith(`${x.id}/`));
        const r = b ? res(b.resourceId) : null;
        const damaged = /return|incident/.test(p) && load().incidents.some((i) => i.bookingId === b?.id);
        out[p] = `art:${r ? artFor(r.name, r.type) : "oscilloscope"}${damaged ? ":damaged" : ""}`;
      }
    }
    return out;
  },
  saveConditionReport: (bookingId, stage, checklist, photoPaths, notes) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b) return fail("Booking not found");
      const owner = b.userId === p.id;
      if (!owner && !managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (stage === "check_in" && b.status !== "approved") return fail("The check-in report can only be filled before check-in");
      if (stage === "return" && !["checked_in", "overdue"].includes(b.status)) return fail("The return report can only be filled while the resource is in use");
      if (photoPaths.some((x) => !x.startsWith(`${b.id}/`))) return fail(`Photos must be uploaded to condition-photos under ${b.id}/`);
      let r = d.reports.find((x) => x.bookingId === bookingId && x.stage === stage);
      if (!r) {
        r = { id: uid("cr"), bookingId, stage, checklist, photoPaths, notes: notes ?? null, signedBy: [], updatedAt: iso(now()) };
        d.reports.push(r);
      }
      Object.assign(r, { checklist, photoPaths, notes: notes ?? null, signedBy: owner ? [p.id] : [], updatedAt: iso(now()) });
      log(b.id, p.id, stage === "check_in" ? "Saved the check-in checklist and photo" : "Saved the return checklist and photo", notes || null);
      if (b.supervisorId) notify(b.supervisorId, "cosign_needed", "Co-sign needed", `${person(b.userId)?.name} saved the ${stage === "check_in" ? "check-in" : "return"} report.`, "/supervising");
      return good({ reportId: r.id });
    }),
  signConditionReport: (reportId) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const r = d.reports.find((x) => x.id === reportId);
      if (!r) return fail("Report not found");
      const b = d.bookings.find((x) => x.id === r.bookingId)!;
      if (b.supervisorId !== p.id) return fail("Only the assigned supervisor may co-sign");
      if ((r.stage === "check_in" && b.status !== "approved") || (r.stage === "return" && !["checked_in", "overdue"].includes(b.status))) return fail("This report can no longer be signed");
      if (!r.photoPaths.length) return fail("The report needs a photo before it can be signed");
      if (!r.signedBy.includes(p.id)) r.signedBy.push(p.id);
      log(b.id, p.id, r.stage === "check_in" ? "Co-signed the check-in report" : "Co-signed the return report");
      return good(undefined);
    }),
  checkIn: (code, bookingId) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const clean = code.trim().replace(/^.*[?&]code=/, "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      let b = bookingId ? d.bookings.find((x) => x.id === bookingId) : undefined;
      if (!bookingId) {
        const open = d.bookings.filter((x) => x.userId === p.id && x.status === "approved" && Math.abs(new Date(x.start).getTime() - now()) <= RULES.checkin_grace_minutes * 60_000 && res(x.resourceId).code === clean);
        if (!open.length) return fail("No approved booking of yours is open for check-in at this resource right now.");
        if (open.length > 1) return fail("You have more than one booking here; open the one you want and check in from it.");
        b = open[0];
      }
      if (!b || b.userId !== p.id) return fail("You don't have permission to do this.");
      if (b.status !== "approved") return fail("Only approved bookings can check in");
      if (Math.abs(new Date(b.start).getTime() - now()) > RULES.checkin_grace_minutes * 60_000) return fail(`Check-in opens ${RULES.checkin_grace_minutes} minutes before the start and closes ${RULES.checkin_grace_minutes} minutes after it`);
      if (res(b.resourceId).code !== clean) return fail("The QR or check-in code does not match this resource");
      if (res(b.resourceId).status !== "active") return fail("This resource is not available right now");
      const r = d.reports.find((x) => x.bookingId === b!.id && x.stage === "check_in");
      if (!r) return fail("The check-in condition report is missing");
      if (!r.photoPaths.length) return fail("The check-in report needs at least one photo");
      if (r.checklist.length < res(b.resourceId).checklist.length) return fail("Complete every checklist item in the check-in report");
      if (b.supervisorId && !r.signedBy.includes(b.supervisorId)) return fail("The supervisor must co-sign the check-in report");
      setStatus(b, "checked_in");
      log(b.id, p.id, "Checked in");
      return good({ bookingId: b.id });
    }),
  returnBooking: (id) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === id);
      if (!b || b.userId !== p.id) return fail("You don't have permission to do this.");
      if (!["checked_in", "overdue"].includes(b.status)) return fail("Booking cannot be returned in this state");
      const r = d.reports.find((x) => x.bookingId === b.id && x.stage === "return");
      if (!r) return fail("The return condition report is missing");
      if (!r.photoPaths.length) return fail("The return report needs at least one photo");
      if (r.checklist.length < res(b.resourceId).checklist.length) return fail("Complete every checklist item in the return report");
      if (b.supervisorId && !r.signedBy.includes(b.supervisorId)) return fail("The supervisor must co-sign the return report");
      setStatus(b, "returned");
      log(b.id, p.id, "Returned the resource");
      return good(undefined);
    }),
  confirmReturn: (id, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === id);
      if (!b || !managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (b.status !== "returned") return fail("Only returned bookings can be confirmed");
      setStatus(b, "completed", reason?.trim() || null);
      log(b.id, p.id, "Confirmed the return", reason?.trim() || null);
      let reward = 0;
      if (b.supervisorKind === "peer" && d.reports.filter((r) => r.bookingId === b.id && r.signedBy.includes(b.supervisorId!)).length === 2) {
        reward = Math.max(1, Math.round(hours(b.start, b.end) * RULES.supervisor_reward_per_hour));
        credit(b.supervisorId!, reward, "Peer supervision reward", b.id);
      }
      return good({ supervisorReward: reward });
    }),
  getResourceQr: (rid) =>
    guard(() => {
      const p = meRow();
      if (!managesResource(p, rid)) return fail("You don't have permission to do this.");
      const r = res(rid);
      return good({ resourceId: r.id, resourceName: r.name, code: r.code, link: `${window.location.origin}/check-in?code=${r.code}`, qrDataUrl: null });
    }),
  rotateCheckinCode: (rid) =>
    guard(() => {
      const p = meRow();
      if (!managesResource(p, rid)) return fail("You don't have permission to do this.");
      const r = res(rid);
      r.code = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0");
      return good({ resourceId: r.id, resourceName: r.name, code: r.code, link: `${window.location.origin}/check-in?code=${r.code}`, qrDataUrl: null });
    }),

  async getQuiz(rid) {
    await wait();
    const q = load().quizzes.find((x) => x.resourceId === rid);
    return q ? { quizId: `quiz-${rid}`, passMark: q.passMark, questions: q.questions.map(({ id, text, options }) => ({ id, text, options })) } : null;
  },
  submitQuiz: (rid, answers) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const q = d.quizzes.find((x) => x.resourceId === rid);
      if (!q) return fail("This resource has no quiz");
      const correct = q.questions.filter((x) => answers[x.id] === x.answer).length;
      const score = round((100 * correct) / q.questions.length);
      const passed = score >= q.passMark;
      if (passed) {
        let b = d.badges.find((x) => x.resourceId === rid && x.kind === "quiz");
        if (!b) {
          b = { id: uid("b"), resourceId: rid, tier: 1, kind: "quiz", name: `Safety quiz — ${res(rid).name}`, description: null };
          d.badges.push(b);
        }
        const existing = d.userBadges.find((u) => u.userId === p.id && u.badgeId === b!.id);
        const reason = `Passed the safety quiz (${correct}/${q.questions.length})`;
        if (existing) Object.assign(existing, { status: "approved", reason, grantedAt: iso(now()) });
        else d.userBadges.push({ id: uid("ub"), userId: p.id, badgeId: b.id, status: "approved", path: null, ai: null, reason, submittedAt: iso(now()), grantedAt: iso(now()) });
      }
      return good({ correct, total: q.questions.length, score, passed });
    }),
  async getCertificateBadge(rid) {
    await wait(60);
    const b = load().badges.find((x) => x.resourceId === rid && x.kind === "certificate");
    return b ? { badgeId: b.id, name: b.name, description: b.description } : null;
  },
  async submitCertificate(badgeId, file) {
    await wait(500);
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) return fail("Certificates must be PDF, JPG, PNG or WebP.");
    if (file.size > 10 * 1024 * 1024) return fail("That file is over 10 MB.");
    return guard(() => {
      const p = meRow();
      const d = load();
      const b = d.badges.find((x) => x.id === badgeId && x.kind === "certificate");
      if (!b) return fail("Certificate badge not found");
      if (d.userBadges.some((u) => u.userId === p.id && u.badgeId === b.id && u.status === "approved")) return fail("You already hold this badge");
      const path = `${p.id}/${Date.now()}-${file.name}`;
      try {
        blobs.set(path, URL.createObjectURL(file));
      } catch {
        /* preview only */
      }
      let u = d.userBadges.find((x) => x.userId === p.id && x.badgeId === b.id);
      if (!u) {
        u = { id: uid("ub"), userId: p.id, badgeId: b.id, status: "pending", path, ai: null, reason: null, submittedAt: iso(now()), grantedAt: null };
        d.userBadges.push(u);
      } else Object.assign(u, { status: "pending", path, ai: null, reason: null, submittedAt: iso(now()), grantedAt: null });
      u.ai = { name: p.name, course: `${res(b.resourceId).name} safety training`, issued: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), issuer: "Read from the upload", note: "Name matches the profile. Confirm the course covers this machine." };
      notify(res(b.resourceId).managerId, "certificate_review", "Certificate to review", `${p.name} — ${res(b.resourceId).name}`, `/manage/certificates/${u.id}`);
      return good({ userBadgeId: u.id, path });
    });
  },
  async listMyBadges() {
    await wait();
    return badgesOf(meRow().id);
  },
  async listCertificatesToReview(scope) {
    await wait();
    const p = meRow();
    const d = load();
    return d.userBadges
      .filter((u) => d.badges.find((b) => b.id === u.badgeId)?.kind === "certificate" && managesResource(p, d.badges.find((b) => b.id === u.badgeId)!.resourceId) && u.userId !== p.id)
      .filter((u) => (scope === "pending" ? u.status === "pending" : u.status === "approved" || u.status === "rejected"))
      .map(viewCert);
  },
  async getCertificateSubmission(id) {
    await wait();
    const u = load().userBadges.find((x) => x.id === id);
    if (!u) throw new Error("Submission not found.");
    return viewCert(u);
  },
  async getCertificateUrl(path) {
    return blobs.get(path) ?? null;
  },
  decideCertificate: (id, decision, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const u = d.userBadges.find((x) => x.id === id);
      if (!u) return fail("Submission not found");
      const b = d.badges.find((x) => x.id === u.badgeId)!;
      if (!managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (u.status !== "pending") return fail("Only pending submissions can be decided");
      if (decision === "rejected" && !reason?.trim()) return fail("A reason is required to reject a certificate");
      Object.assign(u, { status: decision, reason: reason?.trim() || null, grantedAt: decision === "approved" ? iso(now()) : null });
      notify(u.userId, `certificate_${decision}`, decision === "approved" ? "Certificate approved" : "Certificate not accepted", decision === "approved" ? `${b.name}: you can now book ${res(b.resourceId).name} on your own.` : reason!.trim(), "/passport");
      return good(undefined);
    }),
  getGraduationProgress: (rid, userId) =>
    guard(() => {
      const p = meRow();
      const target = userId ?? p.id;
      if (target !== p.id && !managesResource(p, rid)) return fail("You don't have permission to do this.");
      return good(graduation(target, rid));
    }),
  graduateStudent: (userId, rid, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      if (!managesResource(p, rid)) return fail("You don't have permission to do this.");
      if (res(rid).tier !== 3) return fail("Graduation applies to Tier 3 resources");
      if (!reason.trim()) return fail("A reason is required");
      if (userTier(userId, rid) >= 2) return fail("Student is already Tier 2 for this resource");
      if (cleanSessions(userId, rid) < RULES.graduation_sessions) return fail(`Student needs ${RULES.graduation_sessions} clean supervised sessions first`);
      let b = d.badges.find((x) => x.resourceId === rid && x.kind === "graduation");
      if (!b) {
        b = { id: uid("b"), resourceId: rid, tier: 2, kind: "graduation", name: `Independent use — ${res(rid).name}`, description: null };
        d.badges.push(b);
      }
      d.userBadges.push({ id: uid("ub"), userId, badgeId: b.id, status: "approved", path: null, ai: null, reason: reason.trim(), submittedAt: iso(now()), grantedAt: iso(now()) });
      notify(userId, "graduated", "You graduated to Tier 2", `${res(rid).name}: independent use allowed.`, "/passport");
      return good(undefined);
    }),
  async getPassport() {
    await wait();
    const m = me();
    const d = load();
    const graduation_ = d.resources.filter((r) => r.tier === 3 && r.status === "active").map((r) => ({ resourceId: r.id, resourceName: r.name, progress: graduation(m.id, r.id) })).filter((g) => g.progress.cleanSessions > 0 || g.progress.graduated);
    const history = d.ledger.filter((l) => l.userId === m.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30).map((l) => ({ change: l.change, reason: l.reason, bookingId: l.bookingId, createdAt: l.createdAt }));
    return { me: m, badges: badgesOf(m.id), graduation: graduation_, balance: m.credits, history };
  },

  async getSupervision() {
    await wait();
    const m = me();
    const d = load();
    const applications = d.approvals.filter((a) => a.userId === m.id).map((a) => ({ id: a.id, userId: a.userId, userName: m.name, resourceId: a.resourceId, resourceName: res(a.resourceId).name, status: a.status, reason: a.reason, createdAt: a.createdAt, completedSessions: 0 }));
    const canApply = d.resources.filter((r) => r.status === "active" && r.tier === 3 && userTier(m.id, r.id) >= 2 && !applications.some((a) => a.resourceId === r.id && ["pending", "approved"].includes(a.status))).map(viewResource);
    const hours_ = d.supSlots.filter((s) => s.supervisorId === m.id && new Date(s.end).getTime() > now()).sort((a, b) => a.start.localeCompare(b.start)).map((s) => ({ slotId: s.id, resourceId: s.resourceId, resourceName: res(s.resourceId).name, start: s.start, end: s.end }));
    const sessions = d.bookings
      .filter((b) => b.supervisorId === m.id && ["approved", "checked_in", "overdue", "returned"].includes(b.status))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((b) => {
        const stage: ReportStage | null = b.status === "approved" ? "check_in" : b.status === "checked_in" || b.status === "overdue" ? "return" : null;
        const r = stage ? d.reports.find((x) => x.bookingId === b.id && x.stage === stage) : null;
        return { ...viewBooking(b), needsCosign: r && !r.signedBy.includes(m.id) && r.photoPaths.length ? { reportId: r.id, stage: stage! } : null };
      });
    return { applications, canApply, hours: hours_, sessions };
  },
  applyAsSupervisor: (rid) =>
    guard(() => {
      const p = meRow();
      const d = load();
      if (userTier(p.id, rid) < 2) return fail("Only students with Tier 2 status for this resource can apply as peer supervisors");
      if (d.approvals.some((a) => a.userId === p.id && a.resourceId === rid && a.status === "approved")) return fail("You are already an approved supervisor for this resource");
      let a = d.approvals.find((x) => x.userId === p.id && x.resourceId === rid);
      if (a) Object.assign(a, { status: "pending", reason: null, createdAt: iso(now()) });
      else {
        a = { id: uid("sa"), userId: p.id, resourceId: rid, status: "pending", reason: null, createdAt: iso(now()) };
        d.approvals.push(a);
      }
      notify(res(rid).managerId, "supervisor_application", "Supervisor application", `${p.name} — ${res(rid).name}`, "/manage/supervisors");
      return good({ approvalId: a.id });
    }),
  publishSupervisorHours: (rid, s, e) =>
    guard(() => {
      const p = meRow();
      const d = load();
      if (!supervisorKind(p.id, rid)) return fail("You don't have permission to do this.");
      if (new Date(e) <= new Date(s)) return fail("End time must be after the start.");
      if (d.supSlots.some((x) => x.supervisorId === p.id && overlaps(x, { start: s, end: e }))) return fail("These hours overlap hours you've already published.");
      const slot = { id: uid("ss"), supervisorId: p.id, resourceId: rid, start: s, end: e };
      d.supSlots.push(slot);
      return good({ slotId: slot.id });
    }),
  removeSupervisorHours: (slotId) =>
    guard(() => {
      const d = load();
      const s = d.supSlots.find((x) => x.id === slotId);
      if (!s) return fail("Not found");
      if (d.bookings.some((b) => b.supervisorId === s.supervisorId && b.resourceId === s.resourceId && ["approved", "checked_in", "overdue"].includes(b.status) && overlaps(b, s))) return fail("These hours cover an approved supervised session; ask the manager to cancel or reassign it first");
      d.supSlots = d.supSlots.filter((x) => x.id !== slotId);
      return good(undefined);
    }),
  async listSupervisorApplications() {
    await wait();
    const p = meRow();
    const d = load();
    return d.approvals
      .filter((a) => a.userId !== p.id && managesResource(p, a.resourceId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((a) => ({ id: a.id, userId: a.userId, userName: person(a.userId)?.name ?? null, resourceId: a.resourceId, resourceName: res(a.resourceId).name, status: a.status, reason: a.reason, createdAt: a.createdAt, completedSessions: d.bookings.filter((b) => b.supervisorId === a.userId && b.resourceId === a.resourceId && b.status === "completed").length }));
  },
  decideSupervisor: (id, decision, reason) =>
    guard(() => {
      const p = meRow();
      const a = load().approvals.find((x) => x.id === id);
      if (!a || !managesResource(p, a.resourceId)) return fail("You don't have permission to do this.");
      const okMove = (decision === "approved" && ["pending", "suspended"].includes(a.status)) || (decision === "rejected" && a.status === "pending") || (decision === "suspended" && a.status === "approved");
      if (!okMove) return fail(`Cannot move a ${a.status} application to ${decision}`);
      if (decision !== "approved" && !reason?.trim()) return fail("A written reason is required");
      Object.assign(a, { status: decision, reason: reason?.trim() || null });
      notify(a.userId, `supervisor_${decision}`, `Supervisor application ${decision}`, reason?.trim() || `You can now supervise the ${res(a.resourceId).name}.`, decision === "approved" ? "/supervising" : "/passport");
      return good(undefined);
    }),
  async listGraduationCandidates() {
    await wait();
    const p = meRow();
    const d = load();
    const pairs = new Map<string, { userId: string; rid: string }>();
    for (const b of d.bookings) if (b.status === "completed" && b.supervisorId && res(b.resourceId).tier === 3 && managesResource(p, b.resourceId)) pairs.set(`${b.userId}|${b.resourceId}`, { userId: b.userId, rid: b.resourceId });
    return Array.from(pairs.values())
      .map(({ userId, rid }) => ({ userId, userName: person(userId)?.name ?? null, resource: viewResource(res(rid)), progress: graduation(userId, rid) }))
      .filter((g) => !g.progress.graduated);
  },

  openIncident: (bookingId, type, description, photoPaths) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b || !(b.userId === p.id || b.supervisorId === p.id || managesResource(p, b.resourceId))) return fail("You don't have permission to do this.");
      if (!["checked_in", "overdue", "returned", "completed"].includes(b.status)) return fail("An incident cannot be opened from this booking state");
      if (!description.trim()) return fail("Describe what happened");
      const i: I = { id: uid("in"), bookingId, type, description: description.trim(), photoPaths, openedBy: p.id, aiSummary: null, aiPhotoDiff: null, decision: null, reason: null, penaltyCredits: null, blockUntil: null, userResponse: null, disputeOutcome: null, resolutionReason: null, status: "open", createdAt: iso(now()) };
      d.incidents.push(i);
      log(b.id, p.id, `Reported an issue: ${type.replace("_", " ")}`, description.trim());
      notify(p.id === b.userId ? res(b.resourceId).managerId : b.userId, "incident_opened", `Issue reported: ${res(b.resourceId).name}`, type.replace("_", " "), `/incidents/${i.id}`);
      return good({ incidentId: i.id });
    }),
  async listIncidents(scope) {
    await wait();
    const p = meRow();
    const d = load();
    return d.incidents
      .filter((i) => visibleBookings(p).some((b) => b.id === i.bookingId))
      .filter((i) => scope === "all" || ["open", "under_review", "disputed"].includes(i.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(viewIncident);
  },
  async getIncident(id) {
    await wait();
    const p = meRow();
    const d = load();
    const i = d.incidents.find((x) => x.id === id);
    if (!i || !visibleBookings(p).some((b) => b.id === i.bookingId)) throw new Error("Incident not found, or you don't have access to it.");
    return { incident: viewIncident(i), reports: d.reports.filter((r) => r.bookingId === i.bookingId).map(viewReport) };
  },
  startIncidentReview: (id) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const i = d.incidents.find((x) => x.id === id);
      if (!i) return fail("Incident not found");
      const b = d.bookings.find((x) => x.id === i.bookingId)!;
      if (!managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (i.status !== "open") return fail("Only open incidents can move to review");
      i.status = "under_review";
      log(b.id, p.id, "Started reviewing the issue");
      return good(undefined);
    }),
  decideIncident: (id, decision, reason, opts) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const i = d.incidents.find((x) => x.id === id);
      if (!i) return fail("Incident not found");
      const b = d.bookings.find((x) => x.id === i.bookingId)!;
      if (!managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (i.status !== "under_review") return fail("Start the review before deciding");
      if (!reason.trim()) return fail("A written reason is required");
      let applied: number | null = null;
      let blk: string | null = null;
      if (decision === "credit_penalty") {
        if (!opts.penaltyCredits || opts.penaltyCredits <= 0) return fail("Give a positive credit penalty");
        applied = Math.min(opts.penaltyCredits, person(b.userId)!.credits);
        if (applied > 0) credit(b.userId, -applied, `Incident penalty: ${reason.trim()}`, b.id);
      } else if (decision === "temporary_block") {
        if (!opts.blockDays || opts.blockDays < 1 || opts.blockDays > 30) return fail("Block length must be 1–30 days");
        blk = iso(now() + opts.blockDays * 24 * H);
        const u = person(b.userId)!;
        u.blockedUntil = blk;
        u.blockReason = `Incident decision: ${reason.trim()}`;
      }
      Object.assign(i, { status: "decided", decision, reason: reason.trim(), penaltyCredits: applied, blockUntil: blk });
      log(b.id, p.id, `Decided the issue: ${decision.replace("_", " ")}`, reason.trim());
      notify(b.userId, "incident_decision", "Incident decided", `${decision.replace("_", " ")}: ${reason.trim()}`, `/incidents/${i.id}`);
      return good({ penaltyCredits: applied, blockUntil: blk });
    }),
  respondToIncident: (id, response, dispute) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const i = d.incidents.find((x) => x.id === id);
      if (!i) return fail("Incident not found");
      const b = d.bookings.find((x) => x.id === i.bookingId)!;
      if (b.userId !== p.id) return fail("You don't have permission to do this.");
      if (!response.trim()) return fail("Write a response");
      if (dispute && i.status !== "decided") return fail("Only a decided incident can be disputed");
      if (!["open", "under_review", "decided"].includes(i.status)) return fail("This incident no longer accepts responses");
      i.userResponse = response.trim();
      if (dispute) i.status = "disputed";
      log(b.id, p.id, dispute ? "Disputed the decision" : "Responded to the issue", response.trim());
      if (dispute) d.people.filter((x) => x.roles.includes("admin")).forEach((a) => notify(a.id, "incident_dispute", "Incident disputed", `${p.name} disputed a decision.`, `/admin/incidents/${i.id}`));
      return good(undefined);
    }),
  closeIncident: (id, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      const i = d.incidents.find((x) => x.id === id);
      if (!i) return fail("Incident not found");
      const b = d.bookings.find((x) => x.id === i.bookingId)!;
      if (!managesResource(p, b.resourceId)) return fail("You don't have permission to do this.");
      if (i.status !== "decided") return fail("Only decided, undisputed incidents can be closed by a manager");
      i.status = "closed";
      log(b.id, p.id, "Closed the issue", reason?.trim() || null);
      return good(undefined);
    }),
  resolveIncidentDispute: (id, outcome, reason) =>
    guard(() => {
      const p = meRow();
      const d = load();
      if (!hasRole(p, "admin")) return fail("Only an admin can resolve disputes");
      const i = d.incidents.find((x) => x.id === id);
      if (!i || i.status !== "disputed") return fail("Incident is not disputed");
      if (!reason.trim()) return fail("A written reason is required");
      const b = d.bookings.find((x) => x.id === i.bookingId)!;
      if (outcome === "overturned") {
        if (i.penaltyCredits) credit(b.userId, i.penaltyCredits, "Refund: incident penalty overturned", b.id);
        const u = person(b.userId)!;
        if (i.blockUntil && u.blockedUntil === i.blockUntil) {
          u.blockedUntil = null;
          u.blockReason = null;
        }
      }
      Object.assign(i, { status: "closed", disputeOutcome: outcome, resolutionReason: reason.trim() });
      log(b.id, p.id, outcome === "upheld" ? "Admin upheld the decision" : "Admin overturned the decision", reason.trim());
      notify(b.userId, "incident_dispute_resolved", `Dispute ${outcome}`, reason.trim(), `/incidents/${i.id}`);
      return good(undefined);
    }),
  setResourceStatus: (rid, status, reason) =>
    guard(() => {
      const p = meRow();
      if (!managesResource(p, rid)) return fail("You don't have permission to do this.");
      if (!reason.trim()) return fail("A written reason is required");
      res(rid).status = status;
      return good(undefined);
    }),

  async getNotifications() {
    await wait(60);
    const p = meRow();
    const items = load()
      .notifications.filter((n) => n.userId === p.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 30)
      .map((n): AppNotification => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href, readAt: n.readAt, createdAt: n.createdAt }));
    return { items, unread: items.filter((n) => !n.readAt).length };
  },
  async markNotificationRead(id) {
    const n = load().notifications.find((x) => x.id === id);
    if (n && !n.readAt) {
      n.readAt = iso(now());
      save();
    }
  },
  async markAllNotificationsRead() {
    const p = meRow();
    load().notifications.filter((n) => n.userId === p.id && !n.readAt).forEach((n) => (n.readAt = iso(now())));
    save();
  },

  async getIdleRadar(from, to) {
    await wait(200);
    const p = meRow();
    const d = load();
    const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
    const baseline: Record<string, number> = { "r-seminar": 0.31, "r-robotics": 0.22, "r-scope": 0.12, "r-dslr": 0.18, "r-printer": 0.71, "r-laser": 0.86 };
    return d.resources
      .filter((r) => hasRole(p, "admin") || dept(r.departmentId)?.ownerId === p.id)
      .map((r): RadarRow => {
        const avail = round((days * 6) / 7) * 12;
        const util = baseline[r.id] ?? 0.2;
        const booked = round(avail * util);
        const waiting = d.bookings.filter((b) => b.resourceId === r.id && b.status === "waitlisted" && new Date(b.start).getTime() > now()).length + (r.id === "r-laser" ? 2 : 0);
        return { resourceId: r.id, resourceName: r.name, departmentId: r.departmentId, availableHours: avail, bookedHours: booked, usedHours: round(booked * 0.92), utilisation: util, noShowRate: r.id === "r-scope" ? 0.08 : r.id === "r-seminar" ? 0.05 : 0.02, waitlistLength: waiting, hoursUnlocked: r.id === "r-laser" ? 26 : 0, bottleneck: waiting >= 3 || util >= 0.8 };
      })
      .sort((a, b) => a.resourceName.localeCompare(b.resourceName));
  },
  async getIdleRadarHourly(rids) {
    await wait(120);
    const out: RadarHourly[] = [];
    for (let wd = 0; wd < 6; wd++)
      for (let h = 8; h < 20; h++) {
        const peak = h >= 14 && h <= 16 ? 0.9 : h >= 10 && h <= 12 ? 0.6 : h >= 18 ? 0.1 : 0.25;
        out.push({ weekday: wd, hour: h, bookedHours: round(peak * rids.length * (0.8 + ((wd * 7 + h * 3) % 5) * 0.06) * (wd === 5 ? 0.3 : 1)) });
      }
    return out;
  },
  async listPendingFlags() {
    await wait();
    return load()
      .flags.filter((f) => f.status === "pending")
      .map((f) => ({ id: f.id, userId: f.userId, userName: person(f.userId)?.name ?? null, source: f.source, evidence: f.evidence, proposedBlockDays: f.proposedBlockDays, createdAt: f.createdAt }));
  },
  decideUserFlag: (id, confirm, reason, blockDays) =>
    guard(() => {
      const p = meRow();
      if (!hasRole(p, "admin")) return fail("Only an admin can decide flags");
      const f = load().flags.find((x) => x.id === id);
      if (!f || f.status !== "pending") return fail("Flag is not pending");
      if (!reason.trim()) return fail("A written reason is required");
      if (confirm) {
        const days = blockDays ?? f.proposedBlockDays ?? RULES.no_show_block_days;
        if (days < 1 || days > 30) return fail("Block length must be 1–30 days");
        const u = person(f.userId)!;
        u.blockedUntil = iso(now() + days * 24 * H);
        u.blockReason = reason.trim();
        notify(u.id, "account_restricted", "Booking restricted", reason.trim(), "/passport");
      }
      f.status = confirm ? "confirmed" : "dismissed";
      return good(undefined);
    }),
  liftUserBlock: (userId, reason) =>
    guard(() => {
      const p = meRow();
      if (!hasRole(p, "admin")) return fail("Only an admin can lift a block");
      if (!reason.trim()) return fail("A written reason is required");
      const u = person(userId)!;
      u.blockedUntil = null;
      u.blockReason = null;
      notify(userId, "account_unrestricted", "Restriction lifted", reason.trim(), "/passport");
      return good(undefined);
    }),
  async listOwnedDepartments() {
    await wait(60);
    const p = meRow();
    return load().departments.filter((x) => hasRole(p, "admin") || x.ownerId === p.id).map(({ id, name }) => ({ id, name }));
  },
  async listOwnerResources() {
    await wait();
    const depts = (await mockApi.listOwnedDepartments()).map((x) => x.id);
    const d = load();
    return d.resources
      .filter((r) => depts.includes(r.departmentId))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r): OwnerResource => ({ ...viewResource(r), openRequests: d.bookings.filter((b) => b.resourceId === r.id && b.status === "requested").length, openIncidents: d.incidents.filter((i) => ["open", "under_review", "disputed"].includes(i.status) && d.bookings.find((b) => b.id === i.bookingId)?.resourceId === r.id).length }));
  },
  async getResourceDraft(id) {
    await wait();
    const r = load().resources.find((x) => x.id === id);
    if (!r) throw new Error("Resource not found.");
    const v = viewResource(r);
    return { id: r.id, name: r.name, type: r.type, tier: r.tier, departmentId: r.departmentId, managerId: r.managerId, location: r.location ?? "", maxHours: r.maxHours, weeklyCapHours: r.weeklyCapHours, depositAmount: r.depositAmount, checklist: r.checklist, slots: v.slots };
  },
  saveResource: (draft: ResourceDraft) =>
    guard(() => {
      const p = meRow();
      const d = load();
      if (!hasRole(p, "admin") && dept(draft.departmentId)?.ownerId !== p.id) return fail("You don't have permission to do this.");
      if (!hasRole(person(draft.managerId)!, "manager")) return fail("The assigned manager must have the manager role.");
      let r = draft.id ? d.resources.find((x) => x.id === draft.id) : undefined;
      const fields = { name: draft.name.trim(), type: draft.type, tier: draft.tier, departmentId: draft.departmentId, managerId: draft.managerId, location: draft.location.trim() || null, maxHours: draft.maxHours, weeklyCapHours: draft.weeklyCapHours, depositAmount: draft.depositAmount, checklist: draft.checklist };
      if (r) Object.assign(r, fields);
      else {
        r = { id: uid("r"), photos: [], status: "active", code: Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, "0"), ...fields };
        d.resources.push(r);
      }
      const rid = r.id;
      d.slots = d.slots.filter((s) => s.resourceId !== rid).concat(draft.slots.map((s) => ({ resourceId: rid, weekday: s.weekday, start: s.start, end: s.end })));
      return good({ id: rid });
    }),
  async uploadResourcePhoto(rid, file) {
    await wait(300);
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return fail("Photos must be JPG, PNG or WebP.");
    const path = `${rid}/${uid("photo")}.${file.type.split("/")[1].replace("jpeg", "jpg")}`;
    const url = URL.createObjectURL(file);
    blobs.set(path, url);
    res(rid).photos.push(path);
    save();
    return good({ path, url });
  },
  async listAssignableManagers() {
    await wait(60);
    return load().people.filter((p) => hasRole(p, "manager")).map((p) => ({ id: p.id, name: p.name }));
  },

  onChange(fn) {
    listeners.add(fn);
    const t = setInterval(() => {
      const before = JSON.stringify(load().bookings.map((b) => b.status));
      runJobs();
      if (JSON.stringify(load().bookings.map((b) => b.status)) !== before) fn();
    }, 30_000);
    return () => {
      listeners.delete(fn);
      clearInterval(t);
    };
  },
};
