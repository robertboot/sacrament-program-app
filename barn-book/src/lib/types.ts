export type Species = "horse" | "dog" | "cat";

export interface Animal {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed: string | null;
  born: string | null;
  notes: string | null;
  archived: boolean;
  created_at: string;
}

export interface Schedule {
  id: string;
  animal_id: string;
  treatment: string;
  interval_days: number | null;
  active: boolean;
}

export interface TreatmentRecord {
  id: string;
  animal_id: string;
  treatment: string;
  given_on: string; // YYYY-MM-DD
  next_due: string | null; // YYYY-MM-DD
  product: string | null;
  given_by: string | null;
  notes: string | null;
  created_at: string;
}
