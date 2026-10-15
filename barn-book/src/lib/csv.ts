import type { Animal, TreatmentRecord } from "./types";

export const CSV_HEADER = [
  "Animal",
  "Species",
  "Treatment",
  "Date given",
  "Next due",
  "Product",
  "Given by",
  "Notes",
];

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Every record as CSV, animals alphabetical, each animal's records
 * newest first. Includes archived animals — an export is the full book.
 */
export function buildRecordsCsv(
  animals: Animal[],
  records: TreatmentRecord[]
): string {
  const byId = new Map(animals.map((a) => [a.id, a]));
  const sorted = [...records].sort((a, b) => {
    const an = byId.get(a.animal_id)?.name ?? "";
    const bn = byId.get(b.animal_id)?.name ?? "";
    return an.localeCompare(bn) || b.given_on.localeCompare(a.given_on);
  });
  const lines = [CSV_HEADER.join(",")];
  for (const r of sorted) {
    const animal = byId.get(r.animal_id);
    lines.push(
      [
        animal?.name ?? "",
        animal?.species ?? "",
        r.treatment,
        r.given_on,
        r.next_due ?? "",
        r.product ?? "",
        r.given_by ?? "",
        r.notes ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}
