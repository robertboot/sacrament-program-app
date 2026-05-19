import type { ReactNode } from "react";
import { Music2, HeartHandshake, User, BookOpen } from "lucide-react";
import { formatMeetingDate } from "@/lib/dates";
import { SLOT_LABELS } from "@/lib/assignments";
import { bishopricPositionLabel, leaderDisplayName, unitLabels, type UnitType } from "@/lib/labels";
import type { AssignmentSlot } from "@/lib/supabase/types";
import { SacramentPrayersButton } from "./sacrament-prayers-dialog";

export type WardBusinessItem = { active: boolean; names: string | null };

export type ProgramRenderData = {
  branchName: string;
  unitType: UnitType;
  meetingType: "regular" | "fast_sunday" | "no_services";
  meetingTypeLabel: string | null;
  wardBusinessFooter: string | null;
  meetingDate: string;
  presiding: string | null;
  conducting: { full_name: string; bishopric_position: string | null } | null;
  welcomeText: string | null;
  briefReminders: string | null;
  openingHymn: { number: number; title: string } | null;
  invocation: string | null;
  wardBusiness: {
    releases: WardBusinessItem;
    sustainings: WardBusinessItem;
    moveInWelcomes: WardBusinessItem;
    aaronicSustainings: WardBusinessItem;
    baptismConfirmation: WardBusinessItem;
    babyBlessing: WardBusinessItem;
  };
  stakeBusiness: string | null;
  sacramentHymn: { number: number; title: string } | null;
  intermediateHymn: { number: number; title: string } | null;
  intermediateHymnText: string | null;
  closingHymn: { number: number; title: string } | null;
  benediction: string | null;
  chorister: string | null;
  organist: string | null;
  assignments: {
    slot: AssignmentSlot;
    speakerName: string | null;
    topicTitle: string | null;
    isStake: boolean;
    lengthMinutes: number;
  }[];
  events: { title: string; description: string | null; event_date: string | null }[];
  briefReminderEvents: {
    title: string;
    description: string | null;
    event_date: string | null;
  }[];
};

/** Thin ornamental rule with a center diamond — used under the title. */
function Ornament() {
  return (
    <div className="flex items-center justify-center gap-3 my-3 print:my-1.5 text-[var(--brand-gold)] print:text-black">
      <span className="h-px w-16 bg-current opacity-40" />
      <span className="text-[0.6rem] leading-none">◆</span>
      <span className="h-px w-16 bg-current opacity-40" />
    </div>
  );
}

/** Centered gold section label flanked by hairlines. */
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 my-3 print:my-2 print-avoid-break">
      <span className="h-px flex-1 bg-primary/70 print:bg-black/40" />
      <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary print:text-black text-center">
        {children}
      </h2>
      <span className="h-px flex-1 bg-primary/70 print:bg-black/40" />
    </div>
  );
}

export function ProgramRender({
  data,
  mode = "admin",
}: {
  data: ProgramRenderData;
  /**
   * "admin" shows everything: itemized branch + stake business, conducting
   * verbiage for the sacrament. "public" is the bulletin view: a single
   * "Branch and Stake Business" heading with no items, and the sacrament
   * section trimmed to the hymn line + prayers link only.
   */
  mode?: "admin" | "public";
}) {
  if (data.meetingType === "no_services") {
    return <NoServicesRender data={data} />;
  }
  const isFast = data.meetingType === "fast_sunday";
  const isPublic = mode === "public";

  const slotByKey = (k: AssignmentSlot) => data.assignments.find((a) => a.slot === k);
  const first = slotByKey("first");
  const second = slotByKey("second");
  const concluding = slotByKey("concluding");

  return (
    <>
    <article className="mx-auto max-w-[7.5in] bg-white text-black text-[14px] leading-snug p-6 sm:p-10 print:py-2 print:px-0 ring-1 ring-black/10 print:ring-0">
      <header className="text-center">
        <h1 className="font-serif text-[2.2rem] print:text-[1.8rem] leading-tight tracking-tight">
          {data.branchName}
        </h1>
        <p className="uppercase tracking-[0.28em] text-xs text-[var(--brand-gold)] print:text-black mt-1.5">
          Sacrament Meeting
        </p>
        <Ornament />
      </header>

      <p className="font-serif italic text-center text-[0.95rem] leading-snug text-gray-700 print:text-black max-w-xl mx-auto mb-4 print:mb-2">
        {data.welcomeText ?? "Welcome to sacrament meeting. We're glad you're here."}
      </p>

      {isFast && (
        <p className="text-center font-semibold uppercase tracking-[0.2em] text-xs mb-5">
          Fast &amp; Testimony Meeting
        </p>
      )}

      <div className="grid grid-cols-3 gap-4 text-center border-y border-black/10 print:border-black/30 py-3 print:py-2 mb-1">
        <div className="px-2">
          <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--brand-gold)] print:text-black mb-1">
            Presiding
          </div>
          <div className="text-sm">{data.presiding ?? "—"}</div>
        </div>
        <div className="px-2 border-x border-black/10 print:border-black/30">
          <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--brand-gold)] print:text-black mb-1">
            Conducting
          </div>
          <div className="text-sm">
            {data.conducting
              ? leaderDisplayName(
                  data.unitType,
                  data.conducting as {
                    full_name: string;
                    bishopric_position:
                      | "bishop"
                      | "first_counselor"
                      | "second_counselor"
                      | null;
                  },
                )
              : "—"}
            {data.conducting?.bishopric_position &&
              data.conducting.bishopric_position !== "bishop" && (
                <div className="text-gray-600 print:text-black italic text-xs mt-0.5">
                  ({bishopricPositionLabel(
                    data.conducting.bishopric_position as
                      | "bishop"
                      | "first_counselor"
                      | "second_counselor",
                    data.unitType,
                  )})
                </div>
              )}
          </div>
        </div>
        <div className="px-2">
          <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[var(--brand-gold)] print:text-black mb-1">
            Date
          </div>
          <div className="text-sm">{formatMeetingDate(data.meetingDate)}</div>
        </div>
      </div>

      {data.briefReminders && (
        <section className="mb-1 print-avoid-break">
          <SectionHeading>Brief Reminders</SectionHeading>
          <div className="text-sm space-y-1">
            {data.briefReminders
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <div key={`txt-${i}`} className="flex gap-2">
                  <span className="text-[var(--brand-gold)] print:text-black select-none" aria-hidden="true">
                    •
                  </span>
                  <div className="flex-1">{line}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {data.briefReminderEvents.length > 0 && (
        <section className="mb-1 print-avoid-break">
          <SectionHeading>Upcoming Events</SectionHeading>
          <div className="text-sm space-y-1">
            {data.briefReminderEvents.map((e, i) => (
              <div key={`ev-${i}`} className="flex gap-2">
                <span className="text-[var(--brand-gold)] print:text-black select-none" aria-hidden="true">
                  •
                </span>
                <div className="flex-1">
                  <span className="font-medium">{e.title}</span>
                  {e.event_date && (
                    <span className="text-gray-600 print:text-black ml-2">
                      — {formatMeetingDate(e.event_date)}
                    </span>
                  )}
                  {e.description && (
                    <div className="text-gray-700 print:text-black text-xs">{e.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6">
        <Row icon={<Music2 />} label="Opening Hymn" value={hymnLine(data.openingHymn)} />
        <Row icon={<HeartHandshake />} label="Invocation" value={data.invocation?.trim() || "By Invitation"} />
      </div>

      {isPublic ? (
        <SectionHeading>{unitLabels(data.unitType).unit} and Stake Business</SectionHeading>
      ) : (
        <>
          <WardBusinessSection
            data={data.wardBusiness}
            unitType={data.unitType}
            footer={data.wardBusinessFooter}
          />
          {data.stakeBusiness && (
            <section className="my-2 print:my-1 print-avoid-break">
              <SectionHeading>Stake Business</SectionHeading>
              <div className="whitespace-pre-wrap text-sm">{data.stakeBusiness}</div>
            </section>
          )}
        </>
      )}

      <section className="my-2 print:my-1 print-avoid-break">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <SectionHeading>Blessing and Passing of the Sacrament</SectionHeading>
          </div>
          <div className="no-print shrink-0">
            <SacramentPrayersButton />
          </div>
        </div>
        {isPublic ? (
          <Row icon={<BookOpen />} label="Sacrament Hymn" value={hymnLine(data.sacramentHymn)} />
        ) : (
          <p className="text-sm leading-relaxed">
            We will now prepare for the sacrament by singing{" "}
            <span className="font-medium">{hymnLine(data.sacramentHymn)}</span>, after which the
            sacrament will be passed to the congregation.
          </p>
        )}
      </section>

      <section className="my-2 print:my-1 print-avoid-break">
        <SectionHeading>{isFast ? "Bearing of Testimonies" : "Balance of Program"}</SectionHeading>
        {isFast ? (
          <p className="text-sm text-center italic">
            The congregation is invited to come to the pulpit and bear brief testimonies.
          </p>
        ) : (
          <>
            {first && (
              <Row icon={<User />} label={SLOT_LABELS.first} value={speakerLine(first)} />
            )}
            {second && (
              <Row icon={<User />} label={SLOT_LABELS.second} value={speakerLine(second)} />
            )}
            <hr className="my-1 border-black/15 print:border-black/40" />
            <Row
              icon={<Music2 />}
              label="Intermediate Hymn"
              value={
                data.intermediateHymn
                  ? hymnLine(data.intermediateHymn)
                  : data.intermediateHymnText?.trim() || "—"
              }
            />
            {concluding && (
              <Row icon={<User />} label={SLOT_LABELS.concluding} value={speakerLine(concluding)} />
            )}
          </>
        )}
      </section>

      <hr className="my-1 border-black/15 print:border-black/40" />
      <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-6">
        <Row icon={<Music2 />} label="Closing Hymn" value={hymnLine(data.closingHymn)} />
        <Row icon={<HeartHandshake />} label="Benediction" value={data.benediction?.trim() || "By Invitation"} />
      </div>

      <Ornament />
      <section className="text-center text-xs text-gray-600 print:text-black">
        Chorister: {data.chorister ?? "—"} &nbsp;·&nbsp; Organist: {data.organist ?? "—"}
      </section>
    </article>
    </>
  );
}

function Row({
  label,
  value,
  icon,
  compact,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 ${compact ? "py-1 print:py-0.5" : "py-2 print:py-1"}`}>
      {icon && (
        <span className="shrink-0 w-10 h-10 rounded-full border border-[var(--brand-gold)]/50 print:border-black/40 flex items-center justify-center text-[var(--brand-gold)] print:text-black [&_svg]:w-[1.05rem] [&_svg]:h-[1.05rem]">
          {icon}
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-[var(--brand-gold)] print:text-black">
          {label}
        </div>
        <div className="whitespace-pre-wrap leading-snug">{value}</div>
      </div>
    </div>
  );
}

/**
 * Splits one line of names-field text into `left — right` (or just `left` if
 * there is no separator). Treats em-dash, en-dash, " - ", and " | " all the
 * same so the user isn't forced into one punctuation choice.
 */
function splitNameLine(line: string): { left: string; right: string | null } {
  const re = /\s+[—–]\s+|\s+-\s+|\s+\|\s+/;
  const m = line.match(re);
  if (!m) return { left: line.trim(), right: null };
  const idx = m.index!;
  return {
    left: line.slice(0, idx).trim(),
    right: line.slice(idx + m[0].length).trim(),
  };
}

function splitLines(names: string | null | undefined): string[] {
  if (!names) return [];
  return names
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function StructuredBlock({
  heading,
  intro,
  lines,
  outro,
}: {
  heading: string;
  intro?: string;
  lines: string[];
  outro?: string;
}) {
  return (
    <div className="space-y-0.5 text-sm py-2 print:py-1 border-b border-black/15 print:border-black/30 last:border-b-0 last:pb-0">
      <div className="font-semibold text-xs uppercase tracking-[0.14em]">{heading}</div>
      {intro && <p className="italic text-gray-700 print:text-black">{intro}</p>}
      {lines.map((l, i) => (
        <p key={i} className="pl-4">
          {l}
        </p>
      ))}
      {outro && <p className="italic text-gray-700 print:text-black">{outro}</p>}
    </div>
  );
}

function WardBusinessSection({
  data,
  unitType,
  footer,
}: {
  data: ProgramRenderData["wardBusiness"];
  unitType: UnitType;
  footer: string | null;
}) {
  const labels = unitLabels(unitType);
  const anyActive = Object.values(data).some((x) => x.active);

  const releaseLines = splitLines(data.releases.names).map((line) => {
    const { left, right } = splitNameLine(line);
    return right
      ? `${left} has been released as ${right}.`
      : `${left} has been released.`;
  });

  const sustainingLines = splitLines(data.sustainings.names).map((line) => {
    const { left, right } = splitNameLine(line);
    return right
      ? `${left} has been called to serve as ${right}.`
      : `${left} has been called.`;
  });

  const moveInLines = splitLines(data.moveInWelcomes.names);

  const aaronicLines = splitLines(data.aaronicSustainings.names).map((line) => {
    const { left, right } = splitNameLine(line);
    return right
      ? `We propose that ${left} receive the Aaronic Priesthood and be ordained a ${right}.`
      : `We propose that ${left} receive the Aaronic Priesthood.`;
  });

  const baptismLines = splitLines(data.baptismConfirmation.names).map((line) => {
    const { left, right } = splitNameLine(line);
    return right
      ? `${left} was baptized and confirmed a member of the Church on ${right} and we welcome him/her into the Church.`
      : `${left} was baptized and confirmed a member of the Church and we welcome him/her into the Church.`;
  });

  const blessingLines = splitLines(data.babyBlessing.names).map((line) => {
    const { left, right } = splitNameLine(line);
    return right
      ? `${left} will now be blessed by ${right}.`
      : `${left} will now be blessed.`;
  });

  return (
    <section className="my-2 print:my-1">
      <SectionHeading>{labels.unit} Business</SectionHeading>
      {!anyActive ? (
        <p className="italic text-sm text-center text-gray-700 print:text-black">
          There is no {labels.unitLower} business this week.
        </p>
      ) : (
        <>
          {data.releases.active && (
            <StructuredBlock
              heading="Releases"
              intro="Will the following please stand and remain standing?"
              lines={releaseLines}
              outro="We propose that [he/she/they] be given a vote of thanks for [his/her/their] service. Those who wish to express their appreciation may manifest it by the uplifted hand."
            />
          )}
          {data.sustainings.active && (
            <StructuredBlock
              heading="Sustainings"
              intro="Will the following please stand and remain standing?"
              lines={sustainingLines}
              outro="We propose that [he/she/they] be sustained. Those in favor may manifest it by the uplifted hand. Those opposed, if any, may manifest it."
            />
          )}
          {data.moveInWelcomes.active && (
            <StructuredBlock
              heading="New Records"
              intro="We have received the membership records for the following individuals. Please stand as your names are read."
              lines={moveInLines}
              outro="Those who can welcome these members please manifest it by the uplifted hand."
            />
          )}
          {data.aaronicSustainings.active && (
            <StructuredBlock
              heading="Aaronic Priesthood"
              lines={aaronicLines}
              outro="Those in favor may manifest it by the uplifted hand. Those opposed, if any, may manifest it."
            />
          )}
          {data.baptismConfirmation.active && (
            <StructuredBlock
              heading="Baptism &amp; Confirmation"
              lines={baptismLines}
              outro="All those who can welcome please manifest it by the uplifted hand."
            />
          )}
          {data.babyBlessing.active && (
            <StructuredBlock
              heading="Blessing of a Child"
              lines={blessingLines}
              outro="Those who have been invited to participate, please come forward."
            />
          )}
        </>
      )}
      {footer && footer.trim() && (
        <p className="text-sm italic mt-3 pt-3 border-t border-black/20 print:border-black/40">{footer}</p>
      )}
    </section>
  );
}

function hymnLine(h: { number: number; title: string } | null): string {
  if (!h) return "—";
  return `#${h.number} — ${h.title}`;
}

/** Speaker name + topic, falling back to "Stake Speaker" as the topic when a
 * stake speaker is assigned and no specific topic is set. */
function speakerLine(a: {
  speakerName: string | null;
  topicTitle: string | null;
  isStake: boolean;
}): string {
  const name = a.speakerName ?? "—";
  const topic = a.topicTitle ?? (a.isStake ? "Stake Speaker" : null);
  return topic ? `${name} — "${topic}"` : name;
}

function NoServicesRender({ data }: { data: ProgramRenderData }) {
  const labels = unitLabels(data.unitType);
  return (
    <article className="mx-auto max-w-[7.5in] bg-white text-black p-8 sm:p-12 ring-1 ring-black/10 print:ring-0 print:p-0">
      <header className="text-center">
        <h1 className="font-serif text-[2.4rem] leading-tight tracking-tight">
          {data.branchName}
        </h1>
        <p className="uppercase tracking-[0.28em] text-xs text-[var(--brand-gold)] print:text-black mt-1.5">
          {formatMeetingDate(data.meetingDate)}
        </p>
        <Ornament />
      </header>
      <div className="text-center py-12 space-y-2">
        <p className="uppercase tracking-[0.2em] text-xs text-gray-500 print:text-black">
          No sacrament meeting
        </p>
        <h2 className="font-serif text-3xl">
          {data.meetingTypeLabel?.trim() || "Conference"}
        </h2>
        <p className="text-sm text-gray-700 print:text-black max-w-lg mx-auto pt-2">
          There is no sacrament meeting at the {labels.unitLower} today. Please refer to the
          conference schedule.
        </p>
      </div>
    </article>
  );
}
