import type { Species } from "./types";

export interface CatalogEntry {
  treatment: string;
  intervalDays: number;
}

/**
 * Default treatments per species. Starting points only — every interval
 * is editable per animal on its schedule.
 */
export const CATALOG: Record<Species, CatalogEntry[]> = {
  horse: [
    { treatment: "Coggins test", intervalDays: 365 },
    { treatment: "Rabies", intervalDays: 365 },
    { treatment: "Eastern/Western + Tetanus", intervalDays: 365 },
    { treatment: "West Nile", intervalDays: 365 },
    { treatment: "Flu/Rhino", intervalDays: 182 },
    { treatment: "Strangles", intervalDays: 365 },
    { treatment: "Hardware medicine", intervalDays: 56 },
    { treatment: "Deworming", intervalDays: 56 },
    { treatment: "Farrier/hoof trim", intervalDays: 42 },
    { treatment: "Dental float", intervalDays: 365 },
  ],
  dog: [
    { treatment: "Rabies", intervalDays: 365 },
    { treatment: "DHPP", intervalDays: 365 },
    { treatment: "Bordetella", intervalDays: 182 },
    { treatment: "Leptospirosis", intervalDays: 365 },
    { treatment: "Annual exam", intervalDays: 365 },
    { treatment: "Hardware medicine", intervalDays: 30 },
    { treatment: "Heartworm prevention", intervalDays: 30 },
    { treatment: "Flea & tick", intervalDays: 30 },
    { treatment: "Deworming", intervalDays: 90 },
  ],
  cat: [
    { treatment: "Rabies", intervalDays: 365 },
    { treatment: "FVRCP", intervalDays: 365 },
    { treatment: "Feline leukemia", intervalDays: 365 },
    { treatment: "Annual exam", intervalDays: 365 },
    { treatment: "Flea & tick", intervalDays: 30 },
    { treatment: "Deworming", intervalDays: 90 },
  ],
};

export const SPECIES: { value: Species; label: string; plural: string }[] = [
  { value: "horse", label: "Horse", plural: "Horses" },
  { value: "dog", label: "Dog", plural: "Dogs" },
  { value: "cat", label: "Cat", plural: "Cats" },
];

export function speciesLabel(s: Species): string {
  return SPECIES.find((x) => x.value === s)?.label ?? s;
}
