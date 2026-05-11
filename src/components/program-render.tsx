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

export function ProgramRender({ data }: { data: ProgramRenderData }) {
  if (data.meetingType === "no_services") {
    return <NoServicesRender data={data} />;
  }
  const isFast = data.meetingType === "fast_sunday";

  const intermediate =
    !isFast && (data.intermediateHymn ??
      (data.intermediateHymnText ? { text: data.intermediateHymnText } : null));

  const slotByKey = (k: AssignmentSlot) => data.assignments.find((a) => a.slot === k);
  const first = slotByKey("first");
  const second = slotByKey("second");
  const concluding = slotByKey("concluding");

  return (
    <>
    <article className="mx-auto max-w-[7.5in] p-6 sm:p-10 text-black bg-white text-[14px] leading-snug">
      <header className="text-center pb-3 mb-4 border-b-2 border-black">
        <h1 className="text-2xl font-bold tracking-tight">{data.branchName}</h1>
        <p className="uppercase tracking-widest text-xs text-gray-600 mt-1">
          Sacrament Meeting
        </p>
      </header>

      <p className="italic text-center mb-5 text-sm">
        {data.welcomeText ?? "Welcome to sacrament meeting. We're glad you're here."}
      </p>

      {isFast && (
        <p className="text-center font-semibold uppercase tracking-widest text-xs mb-4">
          Fast &amp; Testimony Meeting
        </p>
      )}

      <table className="w-full mb-4 text-sm">
        <tbody>
          <tr>
            <td className="font-semibold pr-2 w-28">Presiding:</td>
            <td>{data.presiding ?? "—"}</td>
          </tr>
          <tr>
            <td className="font-semibold pr-2">Conducting:</td>
            <td>
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
                  <span className="text-gray-600 ml-2">
                    ({bishopricPositionLabel(
                      data.conducting.bishopric_position as
                        | "bishop"
                        | "first_counselor"
                        | "second_counselor",
                      data.unitType,
                    )})
                  </span>
                )}
            </td>
          </tr>
          <tr>
            <td className="font-semibold pr-2">Date:</td>
            <td>{formatMeetingDate(data.meetingDate)}</td>
          </tr>
        </tbody>
      </table>

      {data.briefReminders && (
        <section className="mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide border-b pb-1 mb-1">
            Brief Reminders
          </h2>
          <div className="text-sm space-y-1 mt-1">
            {data.briefReminders
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, i) => (
                <div key={`txt-${i}`} className="flex gap-2">
                  <span className="text-gray-500 select-none" aria-hidden="true">
                    •
                  </span>
                  <div className="flex-1">{line}</div>
                </div>
              ))}
          </div>
        </section>
      )}

      {data.briefReminderEvents.length > 0 && (
        <section className="mb-4">
          <h2 className="font-semibold text-sm uppercase tracking-wide border-b pb-1 mb-1">
            Upcoming Events
          </h2>
          <div className="text-sm space-y-1 mt-1">
            {data.briefReminderEvents.map((e, i) => (
              <div key={`ev-${i}`} className="flex gap-2">
                <span className="text-gray-500 select-none" aria-hidden="true">
                  •
                </span>
                <div className="flex-1">
                  <span className="font-medium">{e.title}</span>
                  {e.event_date && (
                    <span className="text-gray-600 ml-2">
                      — {formatMeetingDate(e.event_date)}
                    </span>
                  )}
                  {e.description && (
                    <div className="text-gray-700 text-xs">{e.description}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Row label="Opening Hymn" value={hymnLine(data.openingHymn)} />
      <Row label="Invocation" value={data.invocation?.trim() || "By Invitation"} />

      <WardBusinessSection
        data={data.wardBusiness}
        unitType={data.unitType}
        footer={data.wardBusinessFooter}
      />
      {data.stakeBusiness && (
        <section className="my-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide border-b pb-1 mb-1">
            Stake Business
          </h2>
          <div className="whitespace-pre-wrap text-sm">{data.stakeBusiness}</div>
        </section>
      )}

      <section className="my-3">
        <div className="flex items-center justify-between border-b pb-1 mb-1">
          <h2 className="font-semibold text-sm uppercase tracking-wide">
            Blessing and Passing of the Sacrament
          </h2>
          <div className="no-print">
            <SacramentPrayersButton />
          </div>
        </div>
        <p className="text-sm leading-relaxed">
          We will now prepare for the sacrament by singing{" "}
          <span className="font-medium">{hymnLine(data.sacramentHymn)}</span>, after which the
          sacrament will be passed to the congregation.
        </p>
      </section>

      <section className="my-3">
        <h2 className="font-semibold text-sm uppercase tracking-wide border-b pb-1 mb-1">
          {isFast ? "Bearing of Testimonies" : "Balance of Program"}
        </h2>
        {isFast ? (
          <p className="text-sm">
            The congregation is invited to come to the pulpit and bear brief testimonies.
          </p>
        ) : (
          <>
            {first && (
              <Row label={SLOT_LABELS.first} value={speakerLine(first)} />
            )}
            {second && (
              <Row label={SLOT_LABELS.second} value={speakerLine(second)} />
            )}
            {intermediate && (
              <Row
                label="Intermediate"
                value={
                  "text" in intermediate
                    ? intermediate.text
                    : hymnLine(intermediate as { number: number; title: string })
                }
              />
            )}
            {concluding && (
              <Row label={SLOT_LABELS.concluding} value={speakerLine(concluding)} />
            )}
          </>
        )}
      </section>

      <Row label="Closing Hymn" value={hymnLine(data.closingHymn)} />
      <Row label="Benediction" value={data.benediction?.trim() || "By Invitation"} />

      <section className="mt-6 text-center text-xs text-gray-600">
        Chorister: {data.chorister ?? "—"} &nbsp;·&nbsp; Organist: {data.organist ?? "—"}
      </section>


    </article>
    </>
  );
}

function Row({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "flex gap-2 py-0.5" : "flex gap-2 py-1"}>
      <div className="font-semibold w-32 shrink-0">{label}:</div>
      <div className="flex-1 whitespace-pre-wrap">{value}</div>
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
    <div className="space-y-1 text-sm py-3 border-b border-gray-400 last:border-b-0 last:pb-0">
      <div className="font-semibold text-xs uppercase tracking-wide">{heading}</div>
      {intro && <p className="italic">{intro}</p>}
      {lines.map((l, i) => (
        <p key={i} className="pl-4">
          {l}
        </p>
      ))}
      {outro && <p className="italic">{outro}</p>}
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
    <section className="my-3">
      <h2 className="font-semibold text-sm uppercase tracking-wide border-b pb-1 mb-1">
        {labels.unit} Business
      </h2>
      {!anyActive ? (
        <p className="italic text-sm">
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
        <p className="text-sm italic mt-3 pt-3 border-t border-gray-300">{footer}</p>
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
    <article className="mx-auto max-w-[7.5in] p-6 sm:p-10 text-black bg-white">
      <header className="text-center pb-3 mb-4 border-b-2 border-black">
        <h1 className="text-2xl font-bold tracking-tight">{data.branchName}</h1>
        <p className="uppercase tracking-widest text-xs text-gray-600 mt-1">
          {formatMeetingDate(data.meetingDate)}
        </p>
      </header>
      <div className="text-center py-12 space-y-2">
        <p className="uppercase tracking-widest text-xs text-gray-500">
          No sacrament meeting
        </p>
        <h2 className="text-3xl font-bold">
          {data.meetingTypeLabel?.trim() || "Conference"}
        </h2>
        <p className="text-sm text-gray-700 max-w-lg mx-auto pt-2">
          There is no sacrament meeting at the {labels.unitLower} today. Please refer to the
          conference schedule.
        </p>
      </div>
    </article>
  );
}
