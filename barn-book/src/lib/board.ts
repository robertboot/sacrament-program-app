import { compareDueStates, dueState, type DueState } from "./due";
import type { Animal, Schedule, TreatmentRecord } from "./types";

export interface ScheduleRow {
  animal: Animal;
  schedule: Schedule;
  state: DueState;
}

/** Map key for an (animal, treatment) pair. */
export function pairKey(animalId: string, treatment: string): string {
  return animalId + "|" + treatment;
}

/** Latest record per (animal, treatment), by given_on then created_at. */
export function latestRecords(
  records: TreatmentRecord[]
): Map<string, TreatmentRecord> {
  const latest = new Map<string, TreatmentRecord>();
  for (const r of records) {
    const key = pairKey(r.animal_id, r.treatment);
    const prev = latest.get(key);
    if (
      !prev ||
      r.given_on > prev.given_on ||
      (r.given_on === prev.given_on && r.created_at > prev.created_at)
    ) {
      latest.set(key, r);
    }
  }
  return latest;
}

export function buildScheduleRows(
  animals: Animal[],
  schedules: Schedule[],
  records: TreatmentRecord[],
  today: string
): ScheduleRow[] {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const latest = latestRecords(records);
  const rows: ScheduleRow[] = [];
  for (const s of schedules) {
    const animal = byId.get(s.animal_id);
    if (!animal || animal.archived) continue;
    const last = latest.get(pairKey(s.animal_id, s.treatment)) ?? null;
    rows.push({ animal, schedule: s, state: dueState(last, today) });
  }
  rows.sort(
    (a, b) =>
      compareDueStates(a.state, b.state) ||
      a.animal.name.localeCompare(b.animal.name) ||
      a.schedule.treatment.localeCompare(b.schedule.treatment)
  );
  return rows;
}
