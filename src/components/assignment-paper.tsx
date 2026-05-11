import { formatMeetingDate } from "@/lib/dates";
import { SLOT_LABELS } from "@/lib/assignments";
import type { AssignmentSlot } from "@/lib/supabase/types";

type Props = {
  branchName: string;
  meetingDate: string;
  speakerName: string;
  slot: AssignmentSlot;
  lengthMinutes: number;
  topicTitle: string;
  topicDescription: string | null;
  messageTemplate: string;
};

export function AssignmentPaper({
  branchName,
  meetingDate,
  speakerName,
  slot,
  lengthMinutes,
  topicTitle,
  topicDescription,
  messageTemplate,
}: Props) {
  return (
    <div className="print-avoid-break mx-auto max-w-[7in] p-8 space-y-6 text-black bg-white">
      <header className="text-center border-b pb-3">
        <h1 className="text-2xl font-semibold">{branchName}</h1>
        <p className="text-sm uppercase tracking-widest text-gray-600 mt-1">
          Speaking Assignment
        </p>
      </header>

      <section className="grid grid-cols-[7rem_1fr] gap-y-3 gap-x-4 text-base">
        <div className="text-gray-600">Speaker</div>
        <div className="font-semibold text-lg">{speakerName}</div>

        <div className="text-gray-600">Date</div>
        <div>{formatMeetingDate(meetingDate)}</div>

        <div className="text-gray-600">Slot</div>
        <div>{SLOT_LABELS[slot]}</div>

        <div className="text-gray-600">Length</div>
        <div className="font-medium">{lengthMinutes} minutes</div>

        <div className="text-gray-600">Topic</div>
        <div className="font-semibold">{topicTitle}</div>

        {topicDescription && (
          <>
            <div></div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {topicDescription}
            </div>
          </>
        )}
      </section>

      <section className="text-sm leading-relaxed border-t pt-4 whitespace-pre-wrap">
        {messageTemplate}
      </section>
    </div>
  );
}
