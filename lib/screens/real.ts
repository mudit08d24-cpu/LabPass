// The screens' data layer on the real backend.
//  - Writes and rule-driven reads call B's server actions (src/lib/actions/*, API.md), which call A's
//    database functions. Results come back as { ok, data } / { ok: false, error, reasons }.
//  - Plain reads (resource lists, booking details, queues, timelines) query A's tables directly with
//    the browser client; A's row-level security only returns what the signed-in user may see
//    (API.md "Conventions").

import { getBusyTimes as bGetBusyTimes, getMyEligibility, listAssignableManagers as bListAssignableManagers, listSupervisorAvailability as bListSupervisorAvailability, setResourceStatus as bSetResourceStatus } from "@/lib/actions/resources";
import {
  acceptWaitlistOffer as bAcceptWaitlistOffer,
  cancelBooking as bCancelBooking,
  confirmReturn as bConfirmReturn,
  decideBooking as bDecideBooking,
  declineWaitlistOffer as bDeclineWaitlistOffer,
  evaluateBooking as bEvaluateBooking,
  getMyWaitlistRank as bGetMyWaitlistRank,
  requestBooking as bRequestBooking,
  returnBooking as bReturnBooking,
  saveConditionReport as bSaveConditionReport,
  setDeadlineVerified as bSetDeadlineVerified,
  signConditionReport as bSignConditionReport,
} from "@/lib/actions/bookings";
import { checkIn as bCheckIn, getResourceQr as bGetResourceQr, rotateCheckinCode as bRotateCheckinCode } from "@/lib/actions/checkin";
import { decideCertificate as bDecideCertificate, getGraduationProgress as bGetGraduationProgress, getQuiz as bGetQuiz, graduateStudent as bGraduateStudent, submitQuiz as bSubmitQuiz } from "@/lib/actions/badges";
import { applyAsSupervisor as bApplyAsSupervisor, decideSupervisor as bDecideSupervisor, listMySupervisorHours as bListMySupervisorHours, publishSupervisorHours as bPublishSupervisorHours, removeSupervisorHours as bRemoveSupervisorHours } from "@/lib/actions/supervisors";
import { closeIncident as bCloseIncident, decideIncident as bDecideIncident, openIncident as bOpenIncident, resolveIncidentDispute as bResolveIncidentDispute, respondToIncident as bRespondToIncident, startIncidentReview as bStartIncidentReview } from "@/lib/actions/incidents";
import { getCreditBalance as bGetCreditBalance } from "@/lib/actions/credits";
import { decideUserFlag as bDecideUserFlag, getIdleRadar as bGetIdleRadar, getIdleRadarHourly as bGetIdleRadarHourly, liftUserBlock as bLiftUserBlock, listPendingFlags as bListPendingFlags } from "@/lib/actions/admin";
import { getNotifications as bGetNotifications, markAllNotificationsRead as bMarkAllNotificationsRead, markNotificationRead as bMarkNotificationRead } from "@/lib/actions/notifications";
import { getCertificateUrl as bGetCertificateUrl, getConditionPhotoUrls as bGetConditionPhotoUrls, submitCertificate as bSubmitCertificate, uploadEvidencePhoto as bUploadEvidencePhoto, uploadResourcePhoto as bUploadResourcePhoto } from "@/lib/actions/uploads";
import { resourcePhotoUrl } from "@/lib/storage";
import { browserDb } from "./browser";
import { artFor, breakdownOf, checklistAnswers, checklistItems, checksList, describeActivity, parseRange, type RawActivity } from "./format";
import { loadRules, saveResource as cSaveResource, setResourcePhotos } from "./server-actions";
import type {
  BadgeHeld,
  Booking,
  BookingDetail,
  CertificateSubmission,
  ConditionReport,
  ConflictGroup,
  Department,
  Eligibility,
  GraduationProgress,
  Incident,
  Me,
  OwnerResource,
  Resource,
  ResourceWithEligibility,
  Result,
  Role,
  Rules,
  ScreensApi,
  Slot,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const OOPS = "Something went wrong. Please try again.";

/** B's action result → Result<T>, mapping data. Never throws. */
async function act<T>(p: Promise<unknown>, map: (d: Any) => T = (d) => d as T): Promise<Result<T>> {
  try {
    const r = (await p) as Any;
    if (r && r.ok) return { ok: true, data: map(r.data) };
    return { ok: false, error: r?.error ?? OOPS, reasons: r?.reasons };
  } catch {
    return { ok: false, error: OOPS };
  }
}

/** Same, for reads: throws the plain-language error so useQuery shows it. */
async function must<T>(p: Promise<unknown>, map: (d: Any) => T = (d) => d as T): Promise<T> {
  const r = await act(p, map);
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

function fd(file: File) {
  const f = new FormData();
  f.append("file", file);
  return f;
}

function dbError(e: { message?: string } | null) {
  if (!e) return;
  throw new Error(/permission|row-level/i.test(e.message ?? "") ? "You don't have permission to see this." : OOPS);
}

const db = () => browserDb();

// ---------- row mapping ----------

const RES =
  "id,name,type,tier,location,photos,max_hours,weekly_cap_hours,deposit_amount,checklist,status,department_id,manager_id,departments(name),availability_slots(weekday,start_time,end_time)";
const BOOKING = `*, resources(${RES}), student:profiles!bookings_user_id_fkey(name,roll_no), sup:profiles!bookings_supervisor_id_fkey(name), waitlist_offers(id,status,expires_at)`;

function mapResource(r: Any): Resource {
  const photos: string[] = r.photos ?? [];
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    tier: Number(r.tier),
    location: r.location,
    photos,
    photoUrl: photos[0] ? resourcePhotoUrl(photos[0]) : null,
    art: artFor(r.name, r.type),
    maxHours: Number(r.max_hours),
    weeklyCapHours: Number(r.weekly_cap_hours),
    depositAmount: Number(r.deposit_amount),
    checklist: checklistItems(r.checklist),
    status: r.status,
    departmentId: r.department_id,
    departmentName: r.departments?.name ?? "",
    managerId: r.manager_id,
    slots: ((r.availability_slots ?? []) as Any[])
      .map((s): Slot => ({ weekday: Number(s.weekday), start: String(s.start_time).slice(0, 5), end: String(s.end_time).slice(0, 5) }))
      .sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start)),
  };
}

/** A booking's resource can be hidden from a student by RLS (e.g. under maintenance); keep the row usable. */
function hiddenResource(id: string): Resource {
  return {
    id, name: "Resource (not currently offered)", type: "equipment", tier: 0, location: null, photos: [], photoUrl: null,
    art: "oscilloscope", maxHours: 0, weeklyCapHours: 0, depositAmount: 0, checklist: [], status: "inactive",
    departmentId: "", departmentName: "", managerId: "", slots: [],
  };
}

function mapBooking(b: Any): Booking {
  const { start, end } = parseRange(b.time_range);
  const offer = ((b.waitlist_offers ?? []) as Any[]).find((o) => o.status === "offered" && new Date(o.expires_at).getTime() > Date.now());
  return {
    id: b.id,
    resource: b.resources ? mapResource(b.resources) : hiddenResource(b.resource_id),
    userId: b.user_id,
    userName: b.student?.name ?? null,
    userRollNo: b.student?.roll_no ?? null,
    supervisorId: b.supervisor_id,
    supervisorName: b.sup?.name ?? null,
    supervisorKind: b.supervisor_kind,
    start,
    end,
    purpose: b.purpose,
    status: b.status,
    priorityScore: Number(b.priority_score ?? 0),
    breakdown: breakdownOf(b.score_breakdown),
    checks: checksList(b.checks),
    creditsCharged: Number(b.credits_charged ?? 0),
    reason: b.reason,
    deadlineVerified: Boolean(b.deadline_verified),
    createdAt: b.created_at,
    liveOffer: offer ? { id: offer.id, expiresAt: offer.expires_at } : null,
  };
}

function mapReport(r: Any): ConditionReport {
  return {
    id: r.id,
    bookingId: r.booking_id,
    stage: r.stage,
    checklist: checklistAnswers(r.checklist),
    photoPaths: r.photo_urls ?? [],
    notes: r.notes,
    signedBy: r.signed_by ?? [],
    updatedAt: r.updated_at,
  };
}

function aiDiff(v: unknown): string[] | null {
  if (!v) return null;
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : String((x as Any)?.text ?? (x as Any)?.difference ?? JSON.stringify(x))));
  if (typeof v === "object") {
    const o = v as Any;
    if (Array.isArray(o.differences)) return aiDiff(o.differences);
    if (Array.isArray(o.items)) return aiDiff(o.items);
    return Object.values(o).map(String);
  }
  return [String(v)];
}

function mapIncident(i: Any, booking?: Booking): Incident {
  return {
    id: i.id,
    bookingId: i.booking_id,
    booking: booking ?? mapBooking(i.bookings),
    type: i.type,
    description: i.description,
    photoPaths: i.photo_urls ?? [],
    openedBy: i.opened_by,
    openedByName: i.opener?.name ?? null,
    aiSummary: i.ai_summary,
    aiPhotoDiff: aiDiff(i.ai_photo_diff),
    decision: i.decision,
    reason: i.reason,
    penaltyCredits: i.penalty_credits,
    blockUntil: i.block_until,
    userResponse: i.user_response,
    disputeOutcome: i.dispute_outcome,
    resolutionReason: i.resolution_reason,
    status: i.status,
    createdAt: i.created_at,
  };
}

function overlaps(a: { start: string; end: string }, b: { start: string; end: string }) {
  return new Date(a.start) < new Date(b.end) && new Date(b.start) < new Date(a.end);
}

let rulesCache: Promise<Rules> | null = null;

// One Realtime channel shared by every open screen (Realtime is on bookings, waitlist_offers, notifications).
const listeners = new Set<() => void>();
let channel: ReturnType<ReturnType<typeof browserDb>["channel"]> | null = null;
let pingTimer: ReturnType<typeof setTimeout> | null = null;
function ping() {
  meCache = null;
  if (pingTimer) clearTimeout(pingTimer);
  pingTimer = setTimeout(() => listeners.forEach((l) => l()), 300);
}
let meCache: { at: number; me: Promise<Me | null> } | null = null;

async function getMe(): Promise<Me | null> {
  if (meCache && Date.now() - meCache.at < 3000) return meCache.me;
  const me = (async () => {
    const { data } = await db().auth.getUser();
    const user = data.user;
    if (!user) return null;
    const [{ data: p }, { data: owned }, { data: sup }] = await Promise.all([
      db().from("profiles").select("*, departments!profiles_department_id_fkey(name)").eq("id", user.id).single(),
      db().from("departments").select("id").eq("owner_id", user.id),
      db().from("supervisor_approvals").select("resource_id").eq("user_id", user.id).eq("status", "approved"),
    ]);
    if (!p) return null;
    const pp = p as Any;
    // Sign-up keeps the roll number in the account metadata until the email is confirmed;
    // copy it to the profile on the first sign-in (A's grants let a user set their own roll_no).
    const metaRoll = typeof user.user_metadata?.roll_no === "string" ? user.user_metadata.roll_no.trim() : "";
    if (!pp.roll_no && metaRoll) {
      const { error } = await db().from("profiles").update({ roll_no: metaRoll }).eq("id", user.id);
      if (!error) pp.roll_no = metaRoll;
    }
    return {
      id: pp.id,
      name: pp.name || user.email || "",
      email: pp.email ?? user.email ?? "",
      rollNo: pp.roll_no,
      departmentId: pp.department_id,
      departmentName: pp.departments?.name ?? null,
      roles: (pp.roles ?? ["student"]) as Role[],
      credits: pp.credits_balance,
      status: pp.status,
      blockedUntil: pp.blocked_until,
      blockReason: pp.block_reason,
      ownedDepartmentIds: (owned ?? []).map((d) => d.id),
      supervises: (sup ?? []).map((s) => s.resource_id),
    } satisfies Me;
  })();
  meCache = { at: Date.now(), me };
  return me;
}

async function myId() {
  const me = await getMe();
  if (!me) throw new Error("Please sign in again.");
  return me;
}

async function eligibility(resourceId: string): Promise<Eligibility | null> {
  const r = await act(getMyEligibility(resourceId), (d: Any) => d as Eligibility);
  return r.ok ? r.data : null;
}

async function listGraduation(resourceId: string, userId?: string): Promise<Result<GraduationProgress>> {
  return act(bGetGraduationProgress(resourceId, userId), (d: Any) => ({
    cleanSessions: Number(d.cleanSessions ?? d.clean_supervised_sessions ?? 0),
    required: Number(d.required ?? 3),
    graduated: Boolean(d.graduated),
    readyForSignoff: Boolean(d.readyForSignoff ?? d.ready_for_signoff),
  }));
}

async function badgesHeld(userId: string): Promise<BadgeHeld[]> {
  const { data, error } = await db().from("user_badges").select("*, badges(id,kind,tier,name,resource_id,resources(name))").eq("user_id", userId).order("submitted_at", { ascending: false });
  dbError(error);
  return ((data ?? []) as Any[]).map((u) => ({
    userBadgeId: u.id,
    badgeId: u.badge_id,
    kind: u.badges?.kind,
    tier: Number(u.badges?.tier ?? 0),
    name: u.badges?.name ?? "",
    resourceId: u.badges?.resource_id,
    resourceName: u.badges?.resources?.name ?? "",
    status: u.status,
    reason: u.reason,
    submittedAt: u.submitted_at,
    grantedAt: u.granted_at,
  }));
}

function mapCertificate(u: Any): CertificateSubmission {
  return {
    userBadgeId: u.id,
    badgeId: u.badge_id,
    userId: u.user_id,
    userName: u.student?.name ?? null,
    userRollNo: u.student?.roll_no ?? null,
    resourceId: u.badges?.resource_id,
    resourceName: u.badges?.resources?.name ?? "",
    path: u.evidence_url,
    status: u.status,
    reason: u.reason,
    aiExtraction: u.ai_extraction && typeof u.ai_extraction === "object" ? u.ai_extraction : null,
    submittedAt: u.submitted_at,
  };
}

const CERT = "*, student:profiles!user_badges_user_id_fkey(name,roll_no), badges!inner(id,kind,resource_id,resources(name))";

export const realApi: ScreensApi = {
  // ---------- session ----------
  getMe,
  async signIn(email, password) {
    const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return { ok: false, error: /confirm/i.test(error.message) ? "Confirm your email first: open the link we sent you." : "That email and password don't match." };
    }
    meCache = null;
    const me = await getMe();
    return me ? { ok: true, data: me } : { ok: false, error: OOPS };
  },
  async signUp({ name, email, rollNo, password }) {
    const { data, error } = await db().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), roll_no: rollNo.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) return { ok: false, error: /registered|exists/i.test(error.message) ? "An account with this email already exists. Sign in instead." : error.message };
    return { ok: true, data: { needsConfirmation: !data.session } };
  },
  async signOut() {
    await db().auth.signOut();
    meCache = null;
  },
  getRules() {
    if (!rulesCache) rulesCache = loadRules().catch((e) => {
      rulesCache = null;
      throw e;
    });
    return rulesCache;
  },
  async listDepartments() {
    const { data, error } = await db().from("departments").select("id,name").order("name");
    dbError(error);
    return (data ?? []) as Department[];
  },

  // ---------- discovery ----------
  async listResources(f) {
    const { data, error } = await db().from("resources").select(RES).eq("status", "active").order("name");
    dbError(error);
    let rows = ((data ?? []) as Any[]).map(mapResource);
    if (f.type) rows = rows.filter((r) => r.type === f.type);
    if (f.department) rows = rows.filter((r) => r.departmentId === f.department);
    if (f.tier) rows = rows.filter((r) => String(r.tier) === f.tier);
    if (f.q) rows = rows.filter((r) => `${r.name} ${r.location ?? ""} ${r.departmentName}`.toLowerCase().includes(f.q!.toLowerCase()));
    if (f.date) {
      const wd = (new Date(`${f.date}T12:00:00+05:30`).getUTCDay() + 6) % 7;
      rows = rows.filter((r) => r.slots.some((s) => s.weekday === wd));
    }
    const elig = await Promise.all(rows.map((r) => eligibility(r.id)));
    return rows.map((r, i) => ({ ...r, eligibility: elig[i] }));
  },
  async getResource(id) {
    const { data, error } = await db().from("resources").select(RES).eq("id", id).maybeSingle();
    dbError(error);
    if (!data) throw new Error("This resource isn't available.");
    return { ...mapResource(data), eligibility: await eligibility(id) } satisfies ResourceWithEligibility;
  },
  getBusyTimes: (resourceId, from, to) => must(bGetBusyTimes(resourceId, from, to), (d: Any[]) => d.map((x) => ({ start: x.start, end: x.end }))),
  listSupervisorAvailability: (resourceId, from, to) =>
    must(bListSupervisorAvailability(resourceId, from, to), (d: Any[]) =>
      d.map((x) => ({ slotId: x.slotId, supervisorId: x.supervisorId, supervisorName: x.supervisorName, kind: x.kind, start: x.start, end: x.end })),
    ),

  // ---------- bookings ----------
  evaluateBooking: (resourceId, start, end, supervisorId) =>
    act(bEvaluateBooking(resourceId, start, end, supervisorId ?? undefined), (d: Any) => ({
      ok: Boolean(d.ok),
      cost: Number(d.cost ?? 0),
      needsSupervisor: Boolean(d.needs_supervisor ?? d.needsSupervisor),
      supervisorKind: d.supervisor_kind ?? d.supervisorKind ?? null,
      checks: checksList(d.checks),
      priority: d.priority ? { score: Number(d.priority.score), breakdown: breakdownOf(d.priority.breakdown)! } : null,
    })),
  requestBooking: (resourceId, start, end, purpose, supervisorId) => act(bRequestBooking(resourceId, start, end, purpose, supervisorId ?? undefined)),
  async listMyBookings() {
    const me = await myId();
    const { data, error } = await db().from("bookings").select(BOOKING).eq("user_id", me.id).order("created_at", { ascending: false });
    dbError(error);
    return ((data ?? []) as Any[]).map(mapBooking);
  },
  async getBooking(id) {
    const me = await getMe();
    const { data, error } = await db().from("bookings").select(BOOKING).eq("id", id).maybeSingle();
    dbError(error);
    if (!data) throw new Error("Booking not found, or you don't have access to it.");
    const booking = mapBooking(data);
    const [reps, incs, log, others] = await Promise.all([
      db().from("condition_reports").select("*").eq("booking_id", id),
      db().from("incidents").select("*, opener:profiles!incidents_opened_by_fkey(name)").eq("booking_id", id).order("created_at"),
      db().from("activity_log").select("*").eq("booking_id", id).order("created_at"),
      db().from("bookings").select(BOOKING).eq("resource_id", booking.resource.id).in("status", ["requested", "approved", "waitlisted"]).neq("id", id),
    ]);
    const actorIds = Array.from(new Set(((log.data ?? []) as Any[]).map((a) => a.actor_id).filter(Boolean)));
    const { data: people } = actorIds.length ? await db().from("profiles").select("id,name").in("id", actorIds) : { data: [] };
    const names = new Map<string, string>(((people ?? []) as Any[]).map((p) => [p.id, p.name]));
    if (booking.userName) names.set(booking.userId, booking.userName);
    if (booking.supervisorId && booking.supervisorName) names.set(booking.supervisorId, booking.supervisorName);
    if (me) names.set(me.id, me.name);
    const detail: BookingDetail = {
      booking,
      reports: ((reps.data ?? []) as Any[]).map(mapReport),
      incidents: ((incs.data ?? []) as Any[]).map((i) => mapIncident(i, booking)),
      timeline: describeActivity((log.data ?? []) as RawActivity[], (aid) => (aid ? names.get(aid) ?? "Lab staff" : "LabPass")),
      competing: ((others.data ?? []) as Any[]).map(mapBooking).filter((o) => o.userId !== booking.userId && overlaps(o, booking)),
    };
    return detail;
  },
  cancelBooking: (bookingId, reason) => act(bCancelBooking(bookingId, reason), (d: Any) => ({ refundedCredits: Number(d?.refundedCredits ?? 0) })),
  decideBooking: (bookingId, decision, reason) => act(bDecideBooking(bookingId, decision, reason), () => undefined),
  setDeadlineVerified: (bookingId, verified, reason) => act(bSetDeadlineVerified(bookingId, verified, reason), (d: Any) => ({ score: Number(d.score), breakdown: breakdownOf(d.breakdown)! })),
  async listRequests(scope) {
    let q = db().from("bookings").select(BOOKING).order("created_at", { ascending: scope === "requested" });
    q = scope === "requested" ? q.eq("status", "requested") : q.limit(200);
    const { data, error } = await q;
    dbError(error);
    const me = await myId();
    return ((data ?? []) as Any[]).map(mapBooking).filter((b) => b.userId !== me.id || me.roles.includes("admin"));
  },
  async listConflicts() {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const { data, error } = await db().from("bookings").select(BOOKING).in("status", ["requested", "approved", "waitlisted"]).gte("created_at", new Date(Date.now() - 60 * 86_400_000).toISOString());
    dbError(error);
    const pool = ((data ?? []) as Any[]).map(mapBooking).filter((b) => b.end > since);
    const groups: ConflictGroup[] = [];
    for (const b of pool.sort((x, y) => x.start.localeCompare(y.start))) {
      const g = groups.find((x) => x.resource.id === b.resource.id && overlaps(x, b));
      if (g) {
        g.requests.push(b);
        if (b.end > g.end) g.end = b.end;
      } else groups.push({ key: `${b.resource.id}__${b.start}`, resource: b.resource, start: b.start, end: b.end, requests: [b] });
    }
    return groups
      .filter((g) => g.requests.length > 1 && g.requests.some((r) => r.status !== "approved"))
      .map((g) => ({ ...g, requests: g.requests.sort((a, c) => c.priorityScore - a.priorityScore || a.createdAt.localeCompare(c.createdAt)) }));
  },
  async listPendingReturns() {
    const { data, error } = await db().from("bookings").select(BOOKING).eq("status", "returned").order("updated_at");
    dbError(error);
    return ((data ?? []) as Any[]).map(mapBooking);
  },
  async listAllBookings() {
    const { data, error } = await db().from("bookings").select(BOOKING).order("created_at", { ascending: false }).limit(300);
    dbError(error);
    return ((data ?? []) as Any[]).map(mapBooking);
  },

  // ---------- waitlist ----------
  getMyWaitlistRank: (bookingId) =>
    act(bGetMyWaitlistRank(bookingId), (d: Any) => {
      const lo = d.liveOffer ?? d.live_offer;
      return {
        rank: Number(d.rank),
        of: Number(d.of),
        score: Number(d.score),
        breakdown: breakdownOf(d.breakdown),
        liveOffer: lo ? { id: lo.id, expiresAt: lo.expiresAt ?? lo.expires_at } : null,
      };
    }),
  acceptWaitlistOffer: (offerId) => act(bAcceptWaitlistOffer(offerId), () => undefined),
  declineWaitlistOffer: (offerId) => act(bDeclineWaitlistOffer(offerId), () => undefined),

  // ---------- handover ----------
  uploadEvidencePhoto: (bookingId, file) => act(bUploadEvidencePhoto(bookingId, fd(file)), (d: Any) => ({ path: d.path })),
  async getConditionPhotoUrls(paths) {
    if (!paths.length) return {};
    const r = await act(bGetConditionPhotoUrls(paths), (d: Any[]) => Object.fromEntries(d.map((x) => [x.path, x.url])) as Record<string, string>);
    return r.ok ? r.data : {};
  },
  saveConditionReport: (bookingId, stage, checklist, photoPaths, notes) => act(bSaveConditionReport(bookingId, stage, checklist, photoPaths, notes), (d: Any) => ({ reportId: d.reportId })),
  signConditionReport: (reportId) => act(bSignConditionReport(reportId), () => undefined),
  checkIn: (code, bookingId) => act(bCheckIn(code, bookingId), (d: Any) => ({ bookingId: d.bookingId })),
  returnBooking: (bookingId) => act(bReturnBooking(bookingId), () => undefined),
  confirmReturn: (bookingId, reason) => act(bConfirmReturn(bookingId, reason), (d: Any) => ({ supervisorReward: Number(d?.supervisorReward ?? 0) })),
  getResourceQr: (resourceId) => act(bGetResourceQr(resourceId)),
  rotateCheckinCode: (resourceId) => act(bRotateCheckinCode(resourceId)),

  // ---------- badges ----------
  getQuiz: (resourceId) =>
    must(bGetQuiz(resourceId), (d: Any) =>
      d ? { quizId: d.quizId, passMark: Number(d.passMark), questions: (d.questions ?? []).map((q: Any) => ({ id: q.id, text: q.text, options: q.options ?? [] })) } : null,
    ),
  submitQuiz: (resourceId, answers) => act(bSubmitQuiz(resourceId, answers), (d: Any) => ({ correct: d.correct, total: d.total, score: Number(d.score), passed: Boolean(d.passed) })),
  async getCertificateBadge(resourceId) {
    const { data } = await db().from("badges").select("id,name,description").eq("resource_id", resourceId).eq("kind", "certificate").maybeSingle();
    return data ? { badgeId: data.id, name: data.name, description: data.description } : null;
  },
  submitCertificate: (badgeId, file) => act(bSubmitCertificate(badgeId, fd(file)), (d: Any) => ({ userBadgeId: d.userBadgeId, path: d.path })),
  async listMyBadges() {
    return badgesHeld((await myId()).id);
  },
  async listCertificatesToReview(scope) {
    let q = db().from("user_badges").select(CERT).eq("badges.kind", "certificate").order("submitted_at", { ascending: scope === "pending" });
    q = scope === "pending" ? q.eq("status", "pending") : q.in("status", ["approved", "rejected"]).limit(100);
    const { data, error } = await q;
    dbError(error);
    const me = await myId();
    return ((data ?? []) as Any[]).map(mapCertificate).filter((c) => c.userId !== me.id);
  },
  async getCertificateSubmission(userBadgeId) {
    const { data, error } = await db().from("user_badges").select(CERT).eq("id", userBadgeId).maybeSingle();
    dbError(error);
    if (!data) throw new Error("Submission not found.");
    return mapCertificate(data);
  },
  async getCertificateUrl(path) {
    const r = await act(bGetCertificateUrl(path), (d: Any) => d.url as string);
    return r.ok ? r.data : null;
  },
  decideCertificate: (id, decision, reason) => act(bDecideCertificate(id, decision, reason), () => undefined),
  getGraduationProgress: (resourceId, userId) => listGraduation(resourceId, userId),
  graduateStudent: (userId, resourceId, reason) => act(bGraduateStudent(userId, resourceId, reason), () => undefined),
  async getPassport() {
    const me = await myId();
    const [badges, credits, tier3] = await Promise.all([
      badgesHeld(me.id),
      must(bGetCreditBalance(30), (d: Any) => d),
      db().from("resources").select("id,name").eq("tier", 3).eq("status", "active"),
    ]);
    const graduation = await Promise.all(
      ((tier3.data ?? []) as Any[]).map(async (r) => {
        const g = await listGraduation(r.id);
        return g.ok ? { resourceId: r.id, resourceName: r.name, progress: g.data } : null;
      }),
    );
    return {
      me,
      badges,
      graduation: graduation.filter((g): g is NonNullable<typeof g> => !!g && (g.progress.cleanSessions > 0 || g.progress.graduated)),
      balance: Number(credits.balance ?? me.credits),
      history: ((credits.history ?? []) as Any[]).map((h) => ({ change: h.change, reason: h.reason, bookingId: h.bookingId ?? null, createdAt: h.createdAt })),
    };
  },

  // ---------- supervision ----------
  async getSupervision() {
    const me = await myId();
    const [apps, hours, sessions, badges, tier3] = await Promise.all([
      db().from("supervisor_approvals").select("*, resources(name)").eq("user_id", me.id).order("created_at", { ascending: false }),
      must(bListMySupervisorHours(), (d: Any[]) => d),
      db().from("bookings").select(`${BOOKING}, condition_reports(id,stage,signed_by,photo_urls)`).eq("supervisor_id", me.id).in("status", ["approved", "checked_in", "overdue", "returned"]),
      badgesHeld(me.id),
      db().from("resources").select(RES).eq("tier", 3).eq("status", "active"),
    ]);
    const resources = ((tier3.data ?? []) as Any[]).map(mapResource);
    const names = new Map(resources.map((r) => [r.id, r.name]));
    const applications = ((apps.data ?? []) as Any[]).map((a) => ({
      id: a.id,
      userId: a.user_id,
      userName: me.name,
      resourceId: a.resource_id,
      resourceName: a.resources?.name ?? "",
      status: a.status,
      reason: a.reason,
      createdAt: a.created_at,
      completedSessions: 0,
    }));
    const tier2 = new Set(badges.filter((b) => b.status === "approved" && b.tier >= 2).map((b) => b.resourceId));
    return {
      applications,
      canApply: resources.filter((r) => tier2.has(r.id) && !applications.some((a) => a.resourceId === r.id && (a.status === "pending" || a.status === "approved"))),
      hours: hours
        .map((h: Any) => ({ slotId: h.slotId, resourceId: h.resourceId, resourceName: names.get(h.resourceId) ?? "", start: h.start, end: h.end }))
        .sort((a: Any, b: Any) => a.start.localeCompare(b.start)),
      sessions: ((sessions.data ?? []) as Any[])
        .map((row) => {
          const b = mapBooking(row);
          const stage: "check_in" | "return" | null = b.status === "approved" ? "check_in" : b.status === "checked_in" || b.status === "overdue" ? "return" : null;
          const rep = stage ? ((row.condition_reports ?? []) as Any[]).find((c) => c.stage === stage) : null;
          const needs = rep && !(rep.signed_by ?? []).includes(me.id) && (rep.photo_urls ?? []).length ? { reportId: rep.id as string, stage: stage! } : null;
          return { ...b, needsCosign: needs };
        })
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
  },
  applyAsSupervisor: (resourceId) => act(bApplyAsSupervisor(resourceId), (d: Any) => ({ approvalId: d.approvalId })),
  publishSupervisorHours: (resourceId, start, end) => act(bPublishSupervisorHours(resourceId, start, end), (d: Any) => ({ slotId: d.slotId })),
  removeSupervisorHours: (slotId) => act(bRemoveSupervisorHours(slotId), () => undefined),
  async listSupervisorApplications() {
    const me = await myId();
    const { data, error } = await db()
      .from("supervisor_approvals")
      .select("*, resources(name), applicant:profiles!supervisor_approvals_user_id_fkey(name)")
      .neq("user_id", me.id)
      .order("created_at", { ascending: false });
    dbError(error);
    const rows = (data ?? []) as Any[];
    const ids = rows.map((r) => r.user_id);
    const { data: done } = ids.length
      ? await db().from("bookings").select("supervisor_id,resource_id").eq("status", "completed").in("supervisor_id", ids)
      : { data: [] };
    return rows.map((a) => ({
      id: a.id,
      userId: a.user_id,
      userName: a.applicant?.name ?? null,
      resourceId: a.resource_id,
      resourceName: a.resources?.name ?? "",
      status: a.status,
      reason: a.reason,
      createdAt: a.created_at,
      completedSessions: ((done ?? []) as Any[]).filter((d) => d.supervisor_id === a.user_id && d.resource_id === a.resource_id).length,
    }));
  },
  decideSupervisor: (approvalId, decision, reason) => act(bDecideSupervisor(approvalId, decision, reason), () => undefined),
  async listGraduationCandidates() {
    const { data, error } = await db().from("bookings").select(BOOKING).eq("status", "completed").not("supervisor_id", "is", null);
    dbError(error);
    const done = ((data ?? []) as Any[]).map(mapBooking).filter((b) => b.resource.tier === 3);
    const pairs = new Map<string, Booking>();
    for (const b of done) pairs.set(`${b.userId}|${b.resource.id}`, b);
    const out = await Promise.all(
      Array.from(pairs.values()).map(async (b) => {
        const g = await listGraduation(b.resource.id, b.userId);
        return g.ok ? { userId: b.userId, userName: b.userName, resource: b.resource, progress: g.data } : null;
      }),
    );
    return out.filter((x): x is NonNullable<typeof x> => !!x && !x.progress.graduated);
  },

  // ---------- incidents ----------
  openIncident: (bookingId, type, description, photoPaths) => act(bOpenIncident(bookingId, type, description, photoPaths), (d: Any) => ({ incidentId: d.incidentId })),
  async listIncidents(scope) {
    let q = db().from("incidents").select(`*, opener:profiles!incidents_opened_by_fkey(name), bookings(${BOOKING})`).order("created_at", { ascending: false });
    if (scope === "attention") q = q.in("status", ["open", "under_review", "disputed"]);
    const { data, error } = await q;
    dbError(error);
    return ((data ?? []) as Any[]).map((i) => mapIncident(i));
  },
  async getIncident(id) {
    const { data, error } = await db().from("incidents").select(`*, opener:profiles!incidents_opened_by_fkey(name), bookings(${BOOKING})`).eq("id", id).maybeSingle();
    dbError(error);
    if (!data) throw new Error("Incident not found, or you don't have access to it.");
    const incident = mapIncident(data);
    const { data: reps } = await db().from("condition_reports").select("*").eq("booking_id", incident.bookingId);
    return { incident, reports: ((reps ?? []) as Any[]).map(mapReport) };
  },
  startIncidentReview: (id) => act(bStartIncidentReview(id), () => undefined),
  decideIncident: (id, decision, reason, opts) =>
    act(bDecideIncident(id, decision, reason, opts), (d: Any) => ({ penaltyCredits: d?.penaltyCredits ?? null, blockUntil: d?.blockUntil ?? null })),
  respondToIncident: (id, response, dispute) => act(bRespondToIncident(id, response, dispute), () => undefined),
  closeIncident: (id, reason) => act(bCloseIncident(id, reason), () => undefined),
  resolveIncidentDispute: (id, outcome, reason) => act(bResolveIncidentDispute(id, outcome, reason), () => undefined),
  setResourceStatus: (resourceId, status, reason) => act(bSetResourceStatus(resourceId, status, reason), () => undefined),

  // ---------- notifications ----------
  getNotifications: () =>
    must(bGetNotifications(30), (d: Any) => ({
      unread: Number(d.unread ?? 0),
      items: ((d.items ?? []) as Any[]).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href ?? null, readAt: n.readAt ?? null, createdAt: n.createdAt })),
    })),
  async markNotificationRead(id) {
    await act(bMarkNotificationRead(id));
  },
  async markAllNotificationsRead() {
    await act(bMarkAllNotificationsRead());
  },

  // ---------- admin / owner ----------
  getIdleRadar: (from, to) => must(bGetIdleRadar(from, to), (d: Any[]) => d),
  async getIdleRadarHourly(resourceIds, from, to) {
    const all = await Promise.all(resourceIds.map((id) => act(bGetIdleRadarHourly(id, from, to), (d: Any[]) => d)));
    const sum = new Map<string, number>();
    for (const r of all) if (r.ok) for (const h of r.data as Any[]) sum.set(`${h.weekday}|${h.hour}`, (sum.get(`${h.weekday}|${h.hour}`) ?? 0) + Number(h.bookedHours));
    return Array.from(sum.entries()).map(([k, v]) => {
      const [weekday, hour] = k.split("|").map(Number);
      return { weekday, hour, bookedHours: v };
    });
  },
  listPendingFlags: () => must(bListPendingFlags(), (d: Any[]) => d),
  decideUserFlag: (flagId, confirm, reason, blockDays) => act(bDecideUserFlag(flagId, confirm, reason, blockDays), () => undefined),
  liftUserBlock: (userId, reason) => act(bLiftUserBlock(userId, reason), () => undefined),
  async listOwnedDepartments() {
    const me = await myId();
    let q = db().from("departments").select("id,name").order("name");
    if (!me.roles.includes("admin")) q = q.eq("owner_id", me.id);
    const { data, error } = await q;
    dbError(error);
    return (data ?? []) as Department[];
  },
  async listOwnerResources() {
    const depts = await realApi.listOwnedDepartments();
    if (!depts.length) return [];
    const ids = depts.map((d) => d.id);
    const [res, reqs, incs] = await Promise.all([
      db().from("resources").select(RES).in("department_id", ids).order("name"),
      db().from("bookings").select("resource_id").eq("status", "requested"),
      db().from("incidents").select("status, bookings(resource_id)").in("status", ["open", "under_review", "disputed"]),
    ]);
    dbError(res.error);
    return ((res.data ?? []) as Any[]).map((r): OwnerResource => ({
      ...mapResource(r),
      openRequests: ((reqs.data ?? []) as Any[]).filter((b) => b.resource_id === r.id).length,
      openIncidents: ((incs.data ?? []) as Any[]).filter((i) => i.bookings?.resource_id === r.id).length,
    }));
  },
  async getResourceDraft(id) {
    const { data, error } = await db().from("resources").select(RES).eq("id", id).maybeSingle();
    dbError(error);
    if (!data) throw new Error("Resource not found.");
    const r = mapResource(data);
    return {
      id: r.id,
      name: r.name,
      type: r.type,
      tier: r.tier,
      departmentId: r.departmentId,
      managerId: r.managerId,
      location: r.location ?? "",
      maxHours: r.maxHours,
      weeklyCapHours: r.weeklyCapHours,
      depositAmount: r.depositAmount,
      checklist: r.checklist,
      slots: r.slots,
    };
  },
  saveResource: (draft) => cSaveResource(draft),
  async uploadResourcePhoto(resourceId, file) {
    const up = await act(bUploadResourcePhoto(resourceId, fd(file)), (d: Any) => ({ path: d.path as string, url: d.url as string }));
    if (!up.ok) return up;
    const { data } = await db().from("resources").select("photos").eq("id", resourceId).single();
    const saved = await setResourcePhotos(resourceId, [...((data?.photos as string[]) ?? []), up.data.path]);
    return saved.ok ? up : saved;
  },
  listAssignableManagers: () => must(bListAssignableManagers(), (d: Any[]) => d),

  onChange(fn) {
    listeners.add(fn);
    if (!channel) {
      channel = db()
        .channel("labpass-screens")
        .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, ping)
        .on("postgres_changes", { event: "*", schema: "public", table: "waitlist_offers" }, ping)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, ping)
        .subscribe();
    }
    return () => {
      listeners.delete(fn);
      if (!listeners.size && channel) {
        db().removeChannel(channel);
        channel = null;
      }
    };
  },
};
