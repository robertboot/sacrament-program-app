// Hand-written types mirroring supabase/migrations/*.sql.
// Regenerate with `supabase gen types typescript` once you have the CLI linked
// to your project — until then, this keeps the app strongly typed.

export type UserRole = "bishopric" | "chorister";
export type BishopricPosition = "bishop" | "first_counselor" | "second_counselor";
export type SpeakerCategory = "first" | "second" | "concluding";
export type AssignmentSlot = "first" | "second" | "concluding";
export type AssignmentStatus =
  | "not_yet_asked"
  | "awaiting_confirmation"
  | "confirmed"
  | "declined";
export type ProgramStatus = "draft" | "published";
export type MeetingType = "regular" | "fast_sunday" | "no_services";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  bishopric_position: BishopricPosition | null;
  last_conducted_date: string | null;
  created_at: string;
  /** Hydrated from auth.users by the settings page; null if no real email
   *  is on file (placeholder accounts that haven't been claimed yet). */
  email?: string | null;
};

export type Speaker = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  last_spoke_date: string | null;
  /** Manual backfill of dates from before this app existed. */
  historical_dates?: string[];
  created_at: string;
  categories?: SpeakerCategory[]; // hydrated from speaker_categories join
  /** True if this speaker has any upcoming (non-declined) speaking assignment. */
  scheduled?: boolean;
};

export type SpeakerCategoryRow = {
  speaker_id: string;
  category: SpeakerCategory;
};

export type Topic = {
  id: string;
  title: string;
  description: string | null;
  last_used_date: string | null;
  is_active: boolean;
  created_at: string;
  categories?: SpeakerCategory[]; // hydrated from topic_categories join
};

export type Hymn = {
  id: number;
  number: number;
  title: string;
  hymnal: "1985" | "new";
};

export type Program = {
  id: string;
  meeting_date: string;
  presiding: string | null;
  conducting_id: string | null;
  welcome_text: string | null;
  brief_reminders: string | null;
  opening_hymn_id: number | null;
  sacrament_hymn_id: number | null;
  intermediate_hymn_id: number | null;
  intermediate_hymn_text: string | null;
  closing_hymn_id: number | null;
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
  /** Bishop has reviewed the (possibly auto-generated) pick and finalized
   *  this slot. Until true the slot is a draft suggestion and the invite
   *  workflow is hidden. */
  slot_confirmed: boolean;
  asked_at: string | null;
  asked_by: string | null;
  confirmed_at: string | null;
  declined_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SacramentEvent = {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  display_start: string;
  display_end: string;
  external_uid: string | null;
  as_brief_reminder: boolean;
  created_at: string;
};

export type AppSettings = {
  id: 1;
  default_welcome_text: string;
  assignment_paper_template: string;
  branch_name: string;
  calendar_ics_url: string | null;
  unit_type: "ward" | "branch";
  ward_business_footer: string;
  updated_at: string;
};
