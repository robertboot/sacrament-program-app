import { describe, expect, it } from "vitest";
import { buildScheduleRows, latestRecords, pairKey } from "./board";
import type { Animal, Schedule, TreatmentRecord } from "./types";

const animal = (id: string, name: string, archived = false): Animal => ({
  id,
  user_id: "u1",
  name,
  species: "horse",
  breed: null,
  born: null,
  notes: null,
  archived,
  created_at: "2026-01-01T00:00:00Z",
});

const schedule = (
  id: string,
  animal_id: string,
  treatment: string,
  interval_days: number | null = 365
): Schedule => ({ id, animal_id, treatment, interval_days, active: true });

const record = (
  animal_id: string,
  treatment: string,
  given_on: string,
  next_due: string | null,
  created_at = "2026-01-01T00:00:00Z"
): TreatmentRecord => ({
  id: `${animal_id}-${treatment}-${given_on}`,
  animal_id,
  treatment,
  given_on,
  next_due,
  product: null,
  given_by: null,
  notes: null,
  created_at,
});

describe("latestRecords", () => {
  it("keeps the newest record per (animal, treatment) pair", () => {
    const latest = latestRecords([
      record("a1", "Rabies", "2025-01-01", "2026-01-01"),
      record("a1", "Rabies", "2026-02-01", "2027-02-01"),
      record("a2", "Rabies", "2025-06-01", "2026-06-01"),
    ]);
    expect(latest.get(pairKey("a1", "Rabies"))?.given_on).toBe("2026-02-01");
    expect(latest.get(pairKey("a2", "Rabies"))?.given_on).toBe("2025-06-01");
  });

  it("breaks same-day ties by created_at", () => {
    const latest = latestRecords([
      record("a1", "Deworming", "2026-05-01", "2026-06-01", "2026-05-01T08:00:00Z"),
      record("a1", "Deworming", "2026-05-01", "2026-07-01", "2026-05-01T09:00:00Z"),
    ]);
    expect(latest.get(pairKey("a1", "Deworming"))?.next_due).toBe("2026-07-01");
  });
});

describe("buildScheduleRows", () => {
  it("matches records to schedules and skips archived animals", () => {
    const rows = buildScheduleRows(
      [animal("a1", "Maple"), animal("a2", "Old Joe", true)],
      [schedule("s1", "a1", "Coggins test"), schedule("s2", "a2", "Coggins test")],
      [record("a1", "Coggins test", "2026-05-15", "2027-05-15")],
      "2026-09-01"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].state.status).toBe("current");
    expect(rows[0].state.lastGiven).toBe("2026-05-15");
  });

  it("an interval change on one animal leaves the other untouched", () => {
    const rows = buildScheduleRows(
      [animal("a1", "Maple"), animal("a2", "Blue")],
      [schedule("s1", "a1", "Deworming", 28), schedule("s2", "a2", "Deworming", 90)],
      [
        record("a1", "Deworming", "2026-08-01", "2026-08-29"),
        record("a2", "Deworming", "2026-08-01", "2026-10-30"),
      ],
      "2026-09-01"
    );
    const byName = Object.fromEntries(rows.map((r) => [r.animal.name, r.state]));
    expect(byName["Maple"].status).toBe("overdue");
    expect(byName["Blue"].status).toBe("current");
  });
});
