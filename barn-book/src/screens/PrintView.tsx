import { useEffect, useState } from "react";
import { PrimaryButton, QuietButton } from "../components/ui";
import { latestRecords, pairKey } from "../lib/board";
import { speciesLabel } from "../lib/catalog";
import { getAnimal, listRecords, listSchedules } from "../lib/db";
import { dueState, statusLabel, todayLocal } from "../lib/due";
import { formatDate } from "../lib/format";
import { navigate } from "../lib/router";
import type { Animal, Schedule, TreatmentRecord } from "../lib/types";

const th = "text-left font-normal text-xs uppercase tracking-wide text-soft print:text-black border-b border-line py-1 pr-3";
const td = "align-top border-b border-line py-1.5 pr-3 text-sm text-ink";

export function PrintView({ id }: { id: string }) {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [records, setRecords] = useState<TreatmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getAnimal(id), listSchedules(id), listRecords(id)])
      .then(([a, s, r]) => {
        setAnimal(a);
        setSchedules(s);
        setRecords(r);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  if (error) return <p className="text-overdue px-1 py-4">{error}</p>;
  if (!animal) return <p className="text-soft px-1 py-4">Loading…</p>;

  const today = todayLocal();
  const latest = latestRecords(records);
  const scheduleRows = schedules
    .map((s) => ({
      schedule: s,
      state: dueState(latest.get(pairKey(s.animal_id, s.treatment)) ?? null, today),
    }))
    .sort((a, b) => a.schedule.treatment.localeCompare(b.schedule.treatment));

  return (
    <div className="print:text-black">
      <div className="no-print flex gap-2 py-2">
        <QuietButton onClick={() => navigate({ name: "export" })}>‹ Back</QuietButton>
        <PrimaryButton onClick={() => window.print()}>Print</PrimaryButton>
      </div>

      <header className="border-b-2 border-ink pb-2">
        <h1 className="font-serif text-3xl text-ink">{animal.name}</h1>
        <p className="text-sm text-soft print:text-black">
          {speciesLabel(animal.species)}
          {animal.breed && ` · ${animal.breed}`}
          {animal.born && ` · born ${animal.born}`}
        </p>
        {animal.notes && (
          <p className="text-sm text-ink mt-1">{animal.notes}</p>
        )}
        <p className="text-xs text-soft print:text-black mt-1">
          Health record · printed {formatDate(today)} · Barn Book
        </p>
      </header>

      <h2 className="font-serif text-lg text-ink mt-5 mb-1">Current schedule</h2>
      {scheduleRows.length === 0 ? (
        <p className="text-sm text-soft print:text-black">
          No treatments tracked.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Treatment</th>
              <th className={th}>Last given</th>
              <th className={th}>Next due</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {scheduleRows.map(({ schedule, state }) => (
              <tr key={schedule.id}>
                <td className={`${td} font-serif`}>{schedule.treatment}</td>
                <td className={td}>{formatDate(state.lastGiven)}</td>
                <td className={td}>{formatDate(state.nextDue)}</td>
                <td className={td}>{statusLabel(state)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="font-serif text-lg text-ink mt-5 mb-1">History</h2>
      {records.length === 0 ? (
        <p className="text-sm text-soft print:text-black">
          No doses logged yet.
        </p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={th}>Date</th>
              <th className={th}>Treatment</th>
              <th className={th}>Product / dose / lot</th>
              <th className={th}>Given by</th>
              <th className={th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap`}>{formatDate(r.given_on)}</td>
                <td className={`${td} font-serif`}>{r.treatment}</td>
                <td className={td}>{r.product ?? ""}</td>
                <td className={td}>{r.given_by ?? ""}</td>
                <td className={td}>{r.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
