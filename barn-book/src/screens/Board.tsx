import { useEffect, useState } from "react";
import { buildScheduleRows, type ScheduleRow } from "../lib/board";
import { listAllRecords, listAllSchedules, listAnimals } from "../lib/db";
import { todayLocal, statusLabel } from "../lib/due";
import { SPECIES } from "../lib/catalog";
import { formatDate, STATUS_BORDER, STATUS_TEXT } from "../lib/format";
import { navigate } from "../lib/router";
import type { Animal } from "../lib/types";
import { EmptyNote, PrimaryButton, SectionHeading } from "../components/ui";

function ScheduleRowItem({ row }: { row: ScheduleRow }) {
  return (
    <button
      onClick={() => navigate({ name: "animal", id: row.animal.id })}
      className={`w-full text-left bg-card border border-line rounded-sm border-l-4 ${STATUS_BORDER[row.state.status]} px-3 py-2.5 min-h-11 flex items-center justify-between gap-3`}
    >
      <span>
        <span className="font-serif text-ink">{row.animal.name}</span>
        <span className="text-soft"> — </span>
        <span className="font-serif text-ink">{row.schedule.treatment}</span>
        <span className={`block text-sm ${STATUS_TEXT[row.state.status]}`}>
          {statusLabel(row.state)}
          {row.state.nextDue && (
            <span className="text-soft"> · due {formatDate(row.state.nextDue)}</span>
          )}
        </span>
      </span>
      <span className="text-soft" aria-hidden>
        ›
      </span>
    </button>
  );
}

function AnimalRow({ animal }: { animal: Animal }) {
  return (
    <button
      onClick={() => navigate({ name: "animal", id: animal.id })}
      className="w-full text-left bg-card border border-line rounded-sm px-3 py-2.5 min-h-11 flex items-center justify-between gap-3"
    >
      <span>
        <span className="font-serif text-lg text-ink">{animal.name}</span>
        {animal.breed && <span className="text-soft text-sm"> · {animal.breed}</span>}
        {animal.born && <span className="text-soft text-sm"> · b. {animal.born}</span>}
      </span>
      <span className="text-soft" aria-hidden>
        ›
      </span>
    </button>
  );
}

export function Board() {
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAnimals(), listAllSchedules(), listAllRecords()])
      .then(([animals, schedules, records]) => {
        if (cancelled) return;
        setAnimals(animals);
        setRows(buildScheduleRows(animals, schedules, records, todayLocal()));
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-overdue px-1 py-4">{error}</p>;
  }
  if (animals === null) {
    return <p className="text-soft px-1 py-4">Loading the barn…</p>;
  }

  if (animals.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="font-serif text-xl text-ink">Start with one animal.</p>
        <p className="text-soft text-sm mt-1">
          Add a horse, dog, or cat and pick the treatments to track.
        </p>
        <PrimaryButton className="mt-4" onClick={() => navigate({ name: "add" })}>
          Add an animal
        </PrimaryButton>
      </div>
    );
  }

  const attention = rows.filter(
    (r) => r.state.status === "never" || r.state.status === "overdue"
  );
  const comingUp = rows.filter((r) => r.state.status === "soon");

  return (
    <div>
      <SectionHeading>Needs attention</SectionHeading>
      {attention.length === 0 ? (
        <EmptyNote>Nothing overdue. The barn is caught up.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {attention.map((r) => (
            <ScheduleRowItem key={r.schedule.id} row={r} />
          ))}
        </div>
      )}

      <SectionHeading>Coming up in the next month</SectionHeading>
      {comingUp.length === 0 ? (
        <EmptyNote>Nothing due in the next 30 days.</EmptyNote>
      ) : (
        <div className="space-y-2">
          {comingUp.map((r) => (
            <ScheduleRowItem key={r.schedule.id} row={r} />
          ))}
        </div>
      )}

      {SPECIES.map(({ value, plural }) => {
        const group = animals.filter((a) => a.species === value);
        if (group.length === 0) return null;
        return (
          <div key={value}>
            <SectionHeading>{plural}</SectionHeading>
            <div className="space-y-2">
              {group.map((a) => (
                <AnimalRow key={a.id} animal={a} />
              ))}
            </div>
          </div>
        );
      })}

      <div className="mt-8 flex justify-center">
        <PrimaryButton onClick={() => navigate({ name: "add" })}>
          Add an animal
        </PrimaryButton>
      </div>
    </div>
  );
}
