import { YEAR_THEMES } from "@/lib/fsy-lessons";
import type {
  CouncilAgendaItem,
  CouncilMeeting,
  Hymn,
} from "@/lib/supabase/types";

export type CouncilRenderData = {
  branchName: string;
  meeting: CouncilMeeting;
  items: CouncilAgendaItem[];
  hymn: Hymn | null;
};

/**
 * Printable agenda renderer — matches the hand-crafted PDFs the branch has
 * been using.
 *
 *  * Branch Council: single portrait US Letter page. Navy #1e3a5f section
 *    headings with a thin navy rule under each. Bold "Opening Hymn:" /
 *    "Opening Prayer:" / "Closing Prayer:" labels followed by value or
 *    underscore line. Numbered Branch Items with grey #666 sub-notes.
 *
 *  * BYC: two landscape US Letter pages, each split down the middle by a
 *    dashed fold line. Page 2 is rendered rotated 180° so long-edge
 *    duplex printing yields a correctly-oriented inside spread, which
 *    folds in half and tucks into the youth's FSY manuals.
 *
 * Both layouts are driven from the same CouncilRenderData; the kind
 * switches which component we emit.
 */
export function CouncilRender(props: CouncilRenderData) {
  return props.meeting.kind === "branch_council" ? (
    <BranchCouncilAgenda {...props} />
  ) : (
    <BycBooklet {...props} />
  );
}

function BranchCouncilAgenda({
  branchName,
  meeting,
  items,
  hymn,
}: CouncilRenderData) {
  const hymnLine = formatHymn(meeting.opening_hymn_text, hymn);
  const unitName = stripTrailingUnit(branchName);
  return (
    <article className="council-print council-bc max-w-[7in] mx-auto px-6 py-8 text-[10.5pt] font-sans text-black leading-snug">
      <h1 className="font-bold text-[1.9rem] leading-tight text-[#1e3a5f]">
        {unitName} Branch Council
      </h1>
      <p className="text-[0.85rem] text-[#666] mt-0.5">
        {formatDateTitle(meeting.meeting_date)} &nbsp;·&nbsp; Agenda
      </p>

      <Section title="Opening">
        <ul className="space-y-1.5">
          <li className="flex gap-3">
            <Dot />
            <div>
              <strong>Opening Hymn:</strong> {hymnLine}
            </div>
          </li>
          <li className="flex gap-3">
            <Dot />
            <div>
              <strong>Opening Prayer:</strong>{" "}
              <UnderscoreBlank />
            </div>
          </li>
          <li className="flex gap-3">
            <Dot />
            <div>Welcome — President Boot</div>
          </li>
        </ul>
      </Section>

      <Section title="Follow-up from Last Council">
        <ul className="space-y-1">
          {splitBullets(meeting.follow_up_text).map((line, i) => (
            <li key={i} className="flex gap-3">
              <Dot />
              <div>{line}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Branch Items">
        {items.length === 0 ? (
          <p className="text-[#666] italic">No items yet.</p>
        ) : (
          <ol className="space-y-2">
            {items.map((it, i) => (
              <li key={it.id} className="flex gap-3">
                <span className="text-black w-5 shrink-0 text-right pr-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{it.title || "—"}</div>
                  {it.sub_note && (
                    <div className="text-[9.5pt] text-[#666] mt-0.5 whitespace-pre-wrap">
                      {it.sub_note}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Closing">
        <ul className="space-y-1.5">
          <li className="flex gap-3">
            <Dot />
            <div>Assignments recap</div>
          </li>
          <li className="flex gap-3">
            <Dot />
            <div>
              <strong>Closing Prayer:</strong> <UnderscoreBlank />
            </div>
          </li>
        </ul>
      </Section>
    </article>
  );
}

function BycBooklet({ branchName, meeting, items }: CouncilRenderData) {
  const activityDateLabel = meeting.activity_date
    ? formatShort(meeting.activity_date)
    : "Wed, [date]";
  const themeLabel = meeting.theme?.trim() || "[FSY chapter title]";
  const monthLabel = new Date(meeting.meeting_date + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "long" },
  );
  const unitName = stripTrailingUnit(branchName);

  return (
    <div className="council-print council-byc">
      {/* Page 1 — outside spread. Agenda on the right, Notes (with
          Angel Moroni watermark) on the left. */}
      <div className="byc-page">
        <div className="byc-half byc-half-notes">
          <h2 className="byc-panel-title">Notes</h2>
          <RuledLines count={28} />
          <div className="byc-watermark" aria-hidden />
        </div>
        <div className="byc-fold" aria-hidden />
        <div className="byc-half byc-half-agenda">
          <h1 className="font-bold text-[1.35rem] leading-tight text-[#1e3a5f]">
            {unitName} Branch Youth Council
          </h1>
          <p className="text-[0.8rem] text-[#666] mt-0.5">
            {formatDateTitle(meeting.meeting_date)} &nbsp;·&nbsp; Agenda
          </p>

          <Section title="Opening" compact>
            <ul className="space-y-1">
              <li className="flex gap-2.5">
                <Dot />
                <div>
                  <strong>Opening Prayer:</strong> <UnderscoreBlank />
                </div>
              </li>
              <li className="flex gap-2.5">
                <Dot />
                <div>Welcome — President Boot</div>
              </li>
            </ul>
          </Section>

          <Section title="Purpose of BYC" compact>
            <ul className="space-y-0.5">
              <li className="flex gap-2.5">
                <Dot />
                <div>
                  <div>The BYC plans and leads each combined activity</div>
                  <div className="text-[8pt] text-[#666] mt-0.5">
                    One combined activity per month — 3rd Wednesday. Adult
                    leaders support; the BYC owns the ideas, assignments,
                    and follow-through
                  </div>
                </div>
              </li>
            </ul>
          </Section>

          <Section title="Follow-up" compact>
            <ul className="space-y-1">
              {splitBullets(meeting.follow_up_text).map((line, i) => (
                <li key={i} className="flex gap-2.5">
                  <Dot />
                  <div>{line}</div>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={`${monthLabel} Planning`} compact>
            <ol className="space-y-1.5">
              {bycStandardItems({ monthLabel, meeting }).map((it, i) => (
                <li key={`std-${i}`} className="flex gap-2.5">
                  <span className="text-black w-4 shrink-0 text-right pr-0.5">
                    {i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it.title}</div>
                    {it.sub_note && (
                      <div className="text-[8pt] text-[#666] mt-0.5 whitespace-pre-wrap">
                        {it.sub_note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {/* User-added extras numbered after the standard 5. */}
              {items.map((it, i) => (
                <li key={it.id} className="flex gap-2.5">
                  <span className="text-black w-4 shrink-0 text-right pr-0.5">
                    {bycStandardItems({ monthLabel, meeting }).length + i + 1}.
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it.title || "—"}</div>
                    {it.sub_note && (
                      <div className="text-[8pt] text-[#666] mt-0.5 whitespace-pre-wrap">
                        {it.sub_note}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </Section>

          {meeting.looking_ahead_text?.trim() && (
            <Section title="Looking Ahead" compact>
              <ul className="space-y-1">
                <li className="flex gap-2.5">
                  <Dot />
                  <div className="whitespace-pre-wrap">
                    {meeting.looking_ahead_text}
                  </div>
                </li>
              </ul>
            </Section>
          )}

          <Section title="Closing" compact>
            <ul className="space-y-1">
              <li className="flex gap-2.5">
                <Dot />
                <div>Assignments recap</div>
              </li>
              <li className="flex gap-2.5">
                <Dot />
                <div>
                  <strong>Closing Prayer:</strong> <UnderscoreBlank />
                </div>
              </li>
            </ul>
          </Section>
        </div>
      </div>

      {/* Page 2 — inside spread, rotated 180° so long-edge duplex
          prints it right-side-up. Left = Assignments, right = Planning. */}
      <div className="byc-page byc-page-2">
        <div className="byc-page-2-inner">
          <div className="byc-half byc-half-assignments">
            <h2 className="byc-panel-title">Assignments</h2>
            <p className="text-[8pt] text-[#666] -mt-1 mb-2">Who · What · By when</p>
            <RuledLines count={26} />
          </div>
          <div className="byc-fold" aria-hidden />
          <div className="byc-half byc-half-planning">
            <h2 className="byc-panel-title">
              Planning — {monthLabel} Combined Activity
            </h2>
            <p className="text-[8pt] text-[#666] -mt-1 mb-2">
              {activityDateLabel} · Theme: {themeLabel}
            </p>
            <dl className="text-[9pt] space-y-1.5 mb-3">
              <LabelledLine label="Activity" />
              <LabelledLine label="Location" />
              <LabelledLine label="Lead youth" />
              <LabelledLine label="Spiritual message" />
              <LabelledLine label="Supplies / help" />
            </dl>
            <RuledLines count={14} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  compact,
}: {
  title: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "mt-2.5" : "mt-4"}>
      <h2
        className={`${
          compact ? "text-[0.95rem]" : "text-[1.05rem]"
        } font-bold text-[#1e3a5f] pb-0.5 border-b border-[#1e3a5f]/70`}
      >
        {title}
      </h2>
      <div className={compact ? "mt-1.5" : "mt-2"}>{children}</div>
    </section>
  );
}

function Dot() {
  return (
    <span className="text-black w-2 text-right pr-0.5 shrink-0" aria-hidden>
      •
    </span>
  );
}

function UnderscoreBlank() {
  return (
    <span
      aria-hidden
      className="inline-block border-b border-black align-baseline w-[16em] max-w-full"
    />
  );
}

function LabelledLine({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-2">
      <dt className="text-[#666] shrink-0 whitespace-nowrap">{label}:</dt>
      <dd className="flex-1 border-b border-[#c8cdd3] h-[1em]" />
    </div>
  );
}

function RuledLines({ count }: { count: number }) {
  return (
    <div className="space-y-[18pt]" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="border-b border-[#c8cdd3] h-0" />
      ))}
    </div>
  );
}

function splitBullets(text: string): string[] {
  return text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDateTitle(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatShort(iso: string): string {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, mo - 1, da).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * The five standard BYC agenda items, computed from the meeting record
 * (theme, theme_pages, activity_date, activity_ideas) and the current
 * year theme. Rendered before any user-added extras so a freshly-created
 * BYC prints a complete agenda without typing anything.
 *
 * Fields that failed to auto-populate render as "(verify)" markers so
 * the leader sees exactly what to fill in rather than a mysterious blank.
 */
function bycStandardItems({
  monthLabel,
  meeting,
}: {
  monthLabel: string;
  meeting: CouncilMeeting;
}): Array<{ title: string; sub_note: string | null }> {
  const year = Number(meeting.meeting_date.slice(0, 4));
  const yearTheme = YEAR_THEMES[year];
  const chapter = meeting.theme?.trim() || "(verify)";
  const pages = meeting.theme_pages?.trim();
  const themeLine =
    `${monthLabel} theme — “${chapter}” (FSY guide${pages ? `, pp. ${pages}` : ""})`;
  const yearNote = yearTheme
    ? `Year theme: “${yearTheme.title}” — ${yearTheme.scripture}. Review the ${monthLabel} FSY magazine`
    : `Review the ${monthLabel} FSY magazine`;

  const activityShort = meeting.activity_date
    ? formatShort(meeting.activity_date)
    : "(verify)";
  const ideas = meeting.activity_ideas?.trim();

  return [
    { title: themeLine, sub_note: yearNote },
    {
      title: `${monthLabel} combined activity — ${activityShort}`,
      sub_note: ideas
        ? `Magazine ideas: ${ideas}. Youth pick and lead`
        : "Youth pick and lead",
    },
    {
      title: "Spiritual message",
      sub_note: "Tie the activity to the gospel subject; assign a youth to share",
    },
    {
      title: "Assignments",
      sub_note:
        "Who leads, who gives the message, who coordinates with adult leaders",
    },
    {
      title: "Upcoming events",
      sub_note: null,
    },
  ];
}

function stripTrailingUnit(name: string): string {
  // "Talladega Branch" → "Talladega" so the title doesn't become
  // "Talladega Branch Branch Council". No-op when branch_name is
  // already stored as a bare place-name.
  return name.replace(/\s+(Branch|Ward)$/i, "").trim();
}

function formatHymn(custom: string | null, hymn: Hymn | null): string {
  if (custom?.trim()) return custom.trim();
  if (hymn) return `#${hymn.number} — ${hymn.title}`;
  return "___ — [Hymn title]";
}
