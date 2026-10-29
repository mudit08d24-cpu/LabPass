// View types the screens render. They are shaped from A's tables (src/lib/supabase/types.ts)
// and B's action results (API.md), converted once in src/lib/screens/real.ts so screens never
// parse time ranges or raw JSON themselves.

import type { Database } from "@/lib/supabase/types";

type E = Database["public"]["Enums"];
export type BookingStatus = E["booking_status"];
export type ResourceType = E["resource_type"];
export type ResourceStatus = E["resource_status"];
export type IncidentType = E["incident_type"];
export type IncidentStatus = E["incident_status"];
export type IncidentDecision = E["incident_decision"];
export type ApprovalStatus = E["approval_status"];
export type SupervisorKind = E["supervisor_kind"];
export type ReportStage = E["report_stage"];
export type DisputeOutcome = E["dispute_outcome"];
export type BadgeKind = E["badge_kind"];

export type Role = "student" | "manager" | "admin";

/** Same contract as B's actions: `{ ok: true, data }` or `{ ok: false, error, reasons? }`. */
export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; reasons?: string[] };

/** Every value in A's labpass_config(), read with B's getRules(). */
export interface Rules {
  timezone: string;
  max_active_bookings: number;
  default_weekly_hours_per_resource: number;
  weekly_credit_budget: number;
  credits_per_hour: number;
  credits_per_hour_specialised: number;
  supervisor_reward_per_hour: number;
  free_cancel_hours: number;
  checkin_grace_minutes: number;
  reminder_minutes: number;
  waitlist_offer_minutes: number;
  graduation_sessions: number;
  no_show_flag_count: number;
  no_show_window_days: number;
  no_show_block_days: number;
  photo_retention_days: number;
  priority_base: number;
  priority_fresh_bonus: number;
  priority_fresh_days: number;
  priority_deadline_bonus: number;
  priority_per_week_hour: number;
  priority_per_no_show: number;
}

export interface Me {
  id: string;
  name: string;
  email: string;
  rollNo: string | null;
  departmentId: string | null;
  departmentName: string | null;
  roles: Role[];
  credits: number;
  status: "active" | "suspended";
  blockedUntil: string | null;
  blockReason: string | null;
  /** Derived: owns at least one department (departments.owner_id). */
  ownedDepartmentIds: string[];
  /** Derived: resource ids this user is an approved peer supervisor for. */
  supervises: string[];
}

export interface Department {
  id: string;
  name: string;
}

export type ArtKind = "seminar" | "oscilloscope" | "robotics" | "dslr" | "printer" | "laser";

/** availability_slots: weekday Mon = 0 … Sun = 6, institution time zone. */
export interface Slot {
  weekday: number;
  start: string; // "08:00"
  end: string; // "20:00"
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  tier: number;
  location: string | null;
  photos: string[];
  photoUrl: string | null;
  art: ArtKind;
  maxHours: number;
  weeklyCapHours: number;
  depositAmount: number;
  checklist: string[];
  status: ResourceStatus;
  departmentId: string;
  departmentName: string;
  managerId: string;
  slots: Slot[];
}

export type EligibilityStatus = "eligible" | "needs_quiz" | "needs_certificate" | "needs_supervisor" | "blocked";

export interface Eligibility {
  status: EligibilityStatus;
  resourceTier?: number;
  yourTier?: number;
  until?: string | null;
  reason?: string | null;
}

export interface ResourceWithEligibility extends Resource {
  eligibility: Eligibility | null;
}

/** One entry of the booking checklist from evaluate_booking / bookings.checks. */
export interface CheckItem {
  key: string;
  ok: boolean;
  blocking: boolean;
  message: string;
}

/** Priority breakdown object (A's _priority). */
export interface Breakdown {
  base: number;
  fresh_resource: number;
  verified_deadline: number;
  hours_this_week: number;
  hours_penalty: number;
  no_shows_30d: number;
  no_show_penalty: number;
  total: number;
}

export interface Evaluation {
  ok: boolean;
  cost: number;
  needsSupervisor: boolean;
  supervisorKind: SupervisorKind | null;
  checks: CheckItem[];
  priority: { score: number; breakdown: Breakdown } | null;
}

export interface SupervisorWindow {
  slotId: string;
  supervisorId: string;
  supervisorName: string;
  kind: SupervisorKind;
  start: string;
  end: string;
}

export interface Booking {
  id: string;
  resource: Resource;
  userId: string;
  userName: string | null;
  userRollNo: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  supervisorKind: SupervisorKind | null;
  start: string;
  end: string;
  purpose: string;
  status: BookingStatus;
  priorityScore: number;
  breakdown: Breakdown | null;
  checks: CheckItem[];
  creditsCharged: number;
  reason: string | null;
  deadlineVerified: boolean;
  createdAt: string;
  liveOffer: { id: string; expiresAt: string } | null;
}

export interface ChecklistAnswer {
  item: string;
  ok: boolean;
  note?: string;
}

export interface ConditionReport {
  id: string;
  bookingId: string;
  stage: ReportStage;
  checklist: ChecklistAnswer[];
  photoPaths: string[];
  notes: string | null;
  signedBy: string[];
  updatedAt: string;
}

export interface TimelineEntry {
  id: string;
  at: string;
  actor: string;
  text: string;
  reason: string | null;
}

export interface Incident {
  id: string;
  bookingId: string;
  booking: Booking;
  type: IncidentType;
  description: string;
  photoPaths: string[];
  openedBy: string | null;
  openedByName: string | null;
  aiSummary: string | null;
  aiPhotoDiff: string[] | null;
  decision: IncidentDecision | null;
  reason: string | null;
  penaltyCredits: number | null;
  blockUntil: string | null;
  userResponse: string | null;
  disputeOutcome: DisputeOutcome | null;
  resolutionReason: string | null;
  status: IncidentStatus;
  createdAt: string;
}

export interface BookingDetail {
  booking: Booking;
  reports: ConditionReport[];
  incidents: Incident[];
  timeline: TimelineEntry[];
  /** Other requests/approvals on an overlapping slot (managers only; empty for students). */
  competing: Booking[];
}

export interface WaitlistInfo {
  rank: number;
  of: number;
  score: number;
  breakdown: Breakdown | null;
  liveOffer: { id: string; expiresAt: string } | null;
}

export interface ConflictGroup {
  key: string;
  resource: Resource;
  start: string;
  end: string;
  requests: Booking[];
}

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
}

export interface Quiz {
  quizId: string;
  passMark: number; // percent
  questions: QuizQuestion[];
}

export interface QuizResult {
  correct: number;
  total: number;
  score: number; // percent
  passed: boolean;
}

export interface BadgeHeld {
  userBadgeId: string;
  badgeId: string;
  kind: BadgeKind;
  tier: number;
  name: string;
  resourceId: string;
  resourceName: string;
  status: ApprovalStatus;
  reason: string | null;
  submittedAt: string;
  grantedAt: string | null;
}

export interface CertificateSubmission {
  userBadgeId: string;
  badgeId: string;
  userId: string;
  userName: string | null;
  userRollNo: string | null;
  resourceId: string;
  resourceName: string;
  path: string | null;
  status: ApprovalStatus;
  reason: string | null;
  aiExtraction: Record<string, unknown> | null;
  submittedAt: string;
}

export interface GraduationProgress {
  cleanSessions: number;
  required: number;
  graduated: boolean;
  readyForSignoff: boolean;
}

export interface CreditEntry {
  change: number;
  reason: string;
  bookingId: string | null;
  createdAt: string;
}

export interface Passport {
  me: Me;
  badges: BadgeHeld[];
  graduation: { resourceId: string; resourceName: string; progress: GraduationProgress }[];
  balance: number;
  history: CreditEntry[];
}

export interface SupervisorApplication {
  id: string;
  userId: string;
  userName: string | null;
  resourceId: string;
  resourceName: string;
  status: ApprovalStatus;
  reason: string | null;
  createdAt: string;
  completedSessions: number;
}

export interface SupervisorHours {
  slotId: string;
  resourceId: string;
  resourceName: string;
  start: string;
  end: string;
}

export interface SupervisionView {
  applications: SupervisorApplication[];
  /** Tier 3 resources where I hold Tier 2 and have not applied (or was rejected). */
  canApply: Resource[];
  hours: SupervisorHours[];
  sessions: (Booking & { needsCosign: { reportId: string; stage: ReportStage } | null })[];
}

export interface GraduationCandidate {
  userId: string;
  userName: string | null;
  resource: Resource;
  progress: GraduationProgress;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface RadarRow {
  resourceId: string;
  resourceName: string;
  departmentId: string;
  availableHours: number;
  bookedHours: number;
  usedHours: number;
  utilisation: number | null;
  noShowRate: number | null;
  waitlistLength: number;
  hoursUnlocked: number;
  bottleneck: boolean;
}

export interface RadarHourly {
  weekday: number; // Mon = 0
  hour: number;
  bookedHours: number;
}

export interface UserFlag {
  id: string;
  userId: string;
  userName: string | null;
  source: "no_show_rule" | "ai_pattern";
  evidence: Record<string, unknown>;
  proposedBlockDays: number | null;
  createdAt: string;
}

export interface QrInfo {
  resourceId: string;
  resourceName: string;
  code: string;
  link: string;
  qrDataUrl: string | null;
}

export interface OwnerResource extends Resource {
  openRequests: number;
  openIncidents: number;
}

export interface ResourceDraft {
  id?: string;
  name: string;
  type: ResourceType;
  tier: number;
  departmentId: string;
  managerId: string;
  location: string;
  maxHours: number;
  weeklyCapHours: number;
  depositAmount: number;
  checklist: string[];
  slots: Slot[];
}

export interface ResourceFilters {
  q?: string;
  type?: string;
  department?: string;
  tier?: string;
  /** yyyy-mm-dd: only resources open that weekday */
  date?: string;
}

/** Everything the screens call. Implemented by real.ts (B's actions + Supabase reads) and mock.ts. */
export interface ScreensApi {
  // session
  getMe(): Promise<Me | null>;
  signIn(email: string, password: string): Promise<Result<Me>>;
  signUp(input: { name: string; email: string; rollNo: string; password: string }): Promise<Result<{ needsConfirmation: boolean }>>;
  signOut(): Promise<void>;
  getRules(): Promise<Rules>;
  listDepartments(): Promise<Department[]>;

  // discovery
  listResources(filters: ResourceFilters): Promise<ResourceWithEligibility[]>;
  getResource(id: string): Promise<ResourceWithEligibility>;
  getBusyTimes(resourceId: string, from: string, to: string): Promise<{ start: string; end: string }[]>;
  listSupervisorAvailability(resourceId: string, from: string, to: string): Promise<SupervisorWindow[]>;

  // bookings
  evaluateBooking(resourceId: string, start: string, end: string, supervisorId?: string | null): Promise<Result<Evaluation>>;
  requestBooking(resourceId: string, start: string, end: string, purpose: string, supervisorId?: string | null): Promise<Result<{ bookingId: string }>>;
  listMyBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<BookingDetail>;
  cancelBooking(bookingId: string, reason?: string): Promise<Result<{ refundedCredits: number }>>;
  decideBooking(bookingId: string, decision: "approved" | "rejected" | "waitlisted", reason?: string): Promise<Result>;
  setDeadlineVerified(bookingId: string, verified: boolean, reason: string): Promise<Result<{ score: number; breakdown: Breakdown }>>;
  listRequests(scope: "requested" | "all"): Promise<Booking[]>;
  listConflicts(): Promise<ConflictGroup[]>;
  listPendingReturns(): Promise<Booking[]>;
  listAllBookings(): Promise<Booking[]>;

  // waitlist
  getMyWaitlistRank(bookingId: string): Promise<Result<WaitlistInfo>>;
  acceptWaitlistOffer(offerId: string): Promise<Result>;
  declineWaitlistOffer(offerId: string): Promise<Result>;

  // handover
  uploadEvidencePhoto(bookingId: string, file: File): Promise<Result<{ path: string }>>;
  getConditionPhotoUrls(paths: string[]): Promise<Record<string, string>>;
  saveConditionReport(bookingId: string, stage: ReportStage, checklist: ChecklistAnswer[], photoPaths: string[], notes?: string): Promise<Result<{ reportId: string }>>;
  signConditionReport(reportId: string): Promise<Result>;
  checkIn(scannedOrTyped: string, bookingId?: string): Promise<Result<{ bookingId: string }>>;
  returnBooking(bookingId: string): Promise<Result>;
  confirmReturn(bookingId: string, reason?: string): Promise<Result<{ supervisorReward: number }>>;
  getResourceQr(resourceId: string): Promise<Result<QrInfo>>;
  rotateCheckinCode(resourceId: string): Promise<Result<QrInfo>>;

  // badges
  getQuiz(resourceId: string): Promise<Quiz | null>;
  submitQuiz(resourceId: string, answers: Record<string, string>): Promise<Result<QuizResult>>;
  getCertificateBadge(resourceId: string): Promise<{ badgeId: string; name: string; description: string | null } | null>;
  submitCertificate(badgeId: string, file: File): Promise<Result<{ userBadgeId: string; path: string }>>;
  listMyBadges(): Promise<BadgeHeld[]>;
  listCertificatesToReview(scope: "pending" | "decided"): Promise<CertificateSubmission[]>;
  getCertificateSubmission(userBadgeId: string): Promise<CertificateSubmission>;
  getCertificateUrl(path: string): Promise<string | null>;
  decideCertificate(userBadgeId: string, decision: "approved" | "rejected", reason?: string): Promise<Result>;
  getGraduationProgress(resourceId: string, userId?: string): Promise<Result<GraduationProgress>>;
  graduateStudent(userId: string, resourceId: string, reason: string): Promise<Result>;
  getPassport(): Promise<Passport>;

  // supervision
  getSupervision(): Promise<SupervisionView>;
  applyAsSupervisor(resourceId: string): Promise<Result<{ approvalId: string }>>;
  publishSupervisorHours(resourceId: string, start: string, end: string): Promise<Result<{ slotId: string }>>;
  removeSupervisorHours(slotId: string): Promise<Result>;
  listSupervisorApplications(): Promise<SupervisorApplication[]>;
  decideSupervisor(approvalId: string, decision: "approved" | "rejected" | "suspended", reason?: string): Promise<Result>;
  listGraduationCandidates(): Promise<GraduationCandidate[]>;

  // incidents
  openIncident(bookingId: string, type: IncidentType, description: string, photoPaths: string[]): Promise<Result<{ incidentId: string }>>;
  listIncidents(scope: "attention" | "all"): Promise<Incident[]>;
  getIncident(id: string): Promise<{ incident: Incident; reports: ConditionReport[] }>;
  startIncidentReview(incidentId: string): Promise<Result>;
  decideIncident(incidentId: string, decision: IncidentDecision, reason: string, opts: { penaltyCredits?: number; blockDays?: number }): Promise<Result<{ penaltyCredits: number | null; blockUntil: string | null }>>;
  respondToIncident(incidentId: string, response: string, dispute: boolean): Promise<Result>;
  closeIncident(incidentId: string, reason?: string): Promise<Result>;
  resolveIncidentDispute(incidentId: string, outcome: DisputeOutcome, reason: string): Promise<Result>;
  setResourceStatus(resourceId: string, status: ResourceStatus, reason: string): Promise<Result>;

  // notifications
  getNotifications(): Promise<{ items: AppNotification[]; unread: number }>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // admin / owner
  getIdleRadar(from: string, to: string): Promise<RadarRow[]>;
  getIdleRadarHourly(resourceIds: string[], from: string, to: string): Promise<RadarHourly[]>;
  listPendingFlags(): Promise<UserFlag[]>;
  decideUserFlag(flagId: string, confirm: boolean, reason: string, blockDays?: number): Promise<Result>;
  liftUserBlock(userId: string, reason: string): Promise<Result>;
  listOwnerResources(): Promise<OwnerResource[]>;
  getResourceDraft(id: string): Promise<ResourceDraft>;
  saveResource(draft: ResourceDraft): Promise<Result<{ id: string }>>;
  uploadResourcePhoto(resourceId: string, file: File): Promise<Result<{ path: string; url: string }>>;
  listAssignableManagers(): Promise<{ id: string; name: string }[]>;
  listOwnedDepartments(): Promise<Department[]>;

  /** Re-run reads when data changes (Supabase Realtime in production, store commits in mock). */
  onChange(fn: () => void): () => void;
}
