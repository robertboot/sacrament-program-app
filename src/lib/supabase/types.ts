// Hand-written types mirroring supabase/migrations/v2/00_schema.sql.
// Regenerate with `supabase gen types typescript` once linked to the project.

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export type UnitType = "ward" | "branch";
export type MemberRole = "leader" | "chorister";
export type LeaderPosition =
  | "president"
  | "first_counselor"
  | "second_counselor"
  | "clerk";
export type SpeakerCategory = "first" | "second" | "concluding";
export type AssignmentSlot = "first" | "second" | "concluding";
export type AssignmentStatus =
  | "not_yet_asked"
  | "awaiting_confirmation"
  | "confirmed"
  | "declined";
export type ProgramStatus = "draft" | "published";
export type MeetingType = "regular" | "fast_sunday" | "no_services";

// Compatibility alias for code that still references the v1 vocabulary.
// Internally maps to `leader` for full-access checks. Will be removed once
// every call site moves to MemberRole.
export type UserRole = MemberRole | "bishopric";
export type BishopricPosition = LeaderPosition;

// ---------------------------------------------------------------------------
// Unit (the tenant)
// ---------------------------------------------------------------------------
export type Unit = {
  id: string;
  name: string;
  type: UnitType;
  owner_id: string;
  created_at: string;
  updated_at: string;
  default_welcome_text: string;
  assignment_paper_template: string;
  unit_business_footer: string | null;
  calendar_ics_url: string | null;
};

export type UnitMember = {
  unit_id: string;
  user_id: string;
  role: MemberRole;
  position: LeaderPosition | null;
  last_conducted_date: string | null;
  created_at: string;
  // Hydrated from profiles join (typically full_name + email)
  profile?: { full_name: string; email: string } | null;
};

export type UnitInvite = {
  id: string;
  unit_id: string;
  email: string;
  role: MemberRole;
  position: LeaderPosition | null;
  invited_by: string;
  token: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Profile (extends auth.users)
// ---------------------------------------------------------------------------
export type Profile = {
  id: string;
  full_name: string;
  email: string;
  active_unit_id: string | null;
  created_at: string;
};

// Convenience view used in the planner header + bishopric pickers — joins a
// profile with the user's role/position in the currently active unit.
export type ProfileWithMembership = Profile & {
  membership: Pick<UnitMember, "role" | "position" | "last_conducted_date"> | null;
};

// ---------------------------------------------------------------------------
// Speakers, topics, hymns
// ---------------------------------------------------------------------------
export type Speaker = {
  id: string;
  unit_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  last_spoke_date: string | null;
  historical_dates?: string[];
  created_at: string;
  categories?: SpeakerCategory[];
  scheduled?: boolean;
};

export type SpeakerCategoryRow = {
  speaker_id: string;
  category: SpeakerCategory;
};

export type Topic = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  last_used_date: string | null;
  is_active: boolean;
  created_at: string;
  categories?: SpeakerCategory[];
};

export type Hymn = {
  id: string;
  number: number;
  title: string;
};

// ---------------------------------------------------------------------------
// Programs + assignments
// ---------------------------------------------------------------------------
export type Program = {
  id: string;
  unit_id: string;
  meeting_date: string;
  presiding: string | null;
  conducting_id: string | null;
  welcome_text: string | null;
  brief_reminders: string | null;
  opening_hymn_id: string | null;
  sacrament_hymn_id: string | null;
  intermediate_hymn_id: string | null;
  intermediate_hymn_text: string | null;
  closing_hymn_id: string | null;
  invocation: string | null;
  benediction: string | null;
  chorister: string | null;
  organist: string | null;
  releases: string | null;
  sustainings: string | null;
  move_in_welcomes: string | null;
  aaronic_sustainings: string | null;
  baptism_confirmation: string | null;
  baby_blessing: string | null;
  stake_business: string | null;
  ward_business_releases: boolean;
  ward_business_sustainings: boolean;
  ward_business_move_in_welcomes: boolean;
  ward_business_aaronic_sustainings: boolean;
  ward_business_baptism_confirmation: boolean;
  ward_business_baby_blessing: boolean;
  status: ProgramStatus;
  meeting_type: MeetingType;
  meeting_type_label: string | null;
  share_token: string;
  created_at: string;
  updated_at: string;
};

export type SpeakingAssignment = {
  id: string;
  program_id: string;
  speaker_id: string | null;
  custom_speaker_name: string | null;
  topic_id: string | null;
  custom_topic_text: string | null;
  slot: AssignmentSlot;
  length_minutes: number;
  status: AssignmentStatus;
  asked_at: string | null;
  asked_by: string | null;
  confirmed_at: string | null;
  declined_at: string | null;
  invited_at: string | null;
  reminded_at: string | null;
  last_response: "confirmed" | "declined" | null;
  responded_at: string | null;
  confirmation_source: "self" | "manual" | null;
  confirm_token: string;
  notes: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export type SacramentEvent = {
  id: string;
  unit_id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  display_start: string;
  display_end: string;
  external_uid: string | null;
  as_brief_reminder: boolean;
  created_at: string;
};
