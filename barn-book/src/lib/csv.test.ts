import { describe, expect, it } from "vitest";
import { buildRecordsCsv, csvEscape } from "./csv";
import type { Animal, TreatmentRecord } from "./types";

const animal = (id: string, name: string): Animal => ({
  id,
  user_id: "u1",
  name,
  species: "horse",
  breed: null,
  born: null,
  notes: null,
  archived: false,
  created_at: "2026-01-01T00:00:00Z",
});

const record = (
  animal_id: string,
  treatment: string,
  given_on: string,
  extra: Partial<TreatmentRecord> = {}
): TreatmentRecord => ({
  id: `${animal_id}-${given_on}`,
  animal_id,
  treatment,
  given_on,
  next_due: null,
  product: null,
  given_by: null,
  notes: null,
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("csvEscape", () => {
  it("passes plain values through", () => {
    expect(csvEscape("Ivermectin paste")).toBe("Ivermectin paste");
  });
  it("quotes commas, quotes, and newlines", () => {
    expect(csvEscape('1ml, lot "4A"')).toBe('"1ml, lot ""4A"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("buildRecordsCsv", () => {
  it("orders by animal name then date descending, with header", () => {
    const csv = buildRecordsCsv(
      [animal("a2", "Zeke"), animal("a1", "Maple")],
      [
        record("a2", "Rabies", "2026-01-10"),
        record("a1", "Coggins test", "2026-05-15", {
          next_due: "2027-05-15",
          product: "AGID",
          given_by: "Dr. Reyes",
        }),
        record("a1", "Deworming", "2026-06-20"),
      ]
    );
    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "Animal,Species,Treatment,Date given,Next due,Product,Given by,Notes"
    );
    expect(lines[1]).toBe(
      "Maple,horse,Deworming,2026-06-20,,,,"
    );
    expect(lines[2]).toBe(
      "Maple,horse,Coggins test,2026-05-15,2027-05-15,AGID,Dr. Reyes,"
    );
    expect(lines[3]).toBe("Zeke,horse,Rabies,2026-01-10,,,,");
  });

  it("escapes fields with commas and quotes", () => {
    const csv = buildRecordsCsv(
      [animal("a1", "Maple")],
      [
        record("a1", "Rabies", "2026-01-10", {
          product: 'Nobivac 1ml, lot "4A22"',
          notes: "left neck",
        }),
      ]
    );
    expect(csv).toContain('"Nobivac 1ml, lot ""4A22"""');
    expect(csv).toContain("left neck");
  });
});
