import { supabase } from "./supabase";
import { computeNextDue } from "./due";
import type { Animal, Schedule, Species, TreatmentRecord } from "./types";

function orThrow<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No data returned");
  return data;
}

export async function listAnimals(includeArchived = false): Promise<Animal[]> {
  let q = supabase.from("animals").select("*").order("name");
  if (!includeArchived) q = q.eq("archived", false);
  return orThrow<Animal[]>(await q);
}

export async function getAnimal(id: string): Promise<Animal> {
  return orThrow<Animal>(
    await supabase.from("animals").select("*").eq("id", id).single()
  );
}

export interface NewAnimal {
  name: string;
  species: Species;
  breed?: string | null;
  born?: string | null;
  notes?: string | null;
}

export async function createAnimal(
  input: NewAnimal,
  treatments: { treatment: string; intervalDays: number | null }[]
): Promise<Animal> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not signed in");

  const animal = orThrow<Animal>(
    await supabase
      .from("animals")
      .insert({ ...input, user_id: userId })
      .select()
      .single()
  );

  if (treatments.length > 0) {
    const { error } = await supabase.from("schedules").insert(
      treatments.map((t) => ({
        animal_id: animal.id,
        treatment: t.treatment,
        interval_days: t.intervalDays,
      }))
    );
    if (error) throw new Error(error.message);
  }
  return animal;
}

export async function updateAnimal(
  id: string,
  patch: Partial<NewAnimal> & { archived?: boolean }
): Promise<void> {
  const { error } = await supabase.from("animals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listSchedules(animalId: string): Promise<Schedule[]> {
  return orThrow<Schedule[]>(
    await supabase
      .from("schedules")
      .select("*")
      .eq("animal_id", animalId)
      .eq("active", true)
      .order("treatment")
  );
}

export async function listAllSchedules(): Promise<Schedule[]> {
  return orThrow<Schedule[]>(
    await supabase.from("schedules").select("*").eq("active", true)
  );
}

export async function upsertSchedule(
  animalId: string,
  treatment: string,
  intervalDays: number | null
): Promise<void> {
  const { error } = await supabase
    .from("schedules")
    .upsert(
      { animal_id: animalId, treatment, interval_days: intervalDays, active: true },
      { onConflict: "animal_id,treatment" }
    );
  if (error) throw new Error(error.message);
}

export async function deactivateSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedules")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listRecords(animalId: string): Promise<TreatmentRecord[]> {
  return orThrow<TreatmentRecord[]>(
    await supabase
      .from("records")
      .select("*")
      .eq("animal_id", animalId)
      .order("given_on", { ascending: false })
      .order("created_at", { ascending: false })
  );
}

export async function listAllRecords(): Promise<TreatmentRecord[]> {
  return orThrow<TreatmentRecord[]>(
    await supabase
      .from("records")
      .select("*")
      .order("given_on", { ascending: false })
  );
}

export interface NewRecord {
  animal_id: string;
  treatment: string;
  given_on: string;
  interval_days: number | null; // used to compute next_due at write time
  product?: string | null;
  given_by?: string | null;
  notes?: string | null;
}

/**
 * Log a dose. next_due is computed here (given_on + interval_days) so
 * backdating recalculates correctly. Also keeps the schedule row in
 * step when the interval was changed in the log form.
 */
export async function logDose(input: NewRecord): Promise<TreatmentRecord> {
  const { interval_days, ...rest } = input;
  const record = orThrow<TreatmentRecord>(
    await supabase
      .from("records")
      .insert({ ...rest, next_due: computeNextDue(input.given_on, interval_days) })
      .select()
      .single()
  );
  await upsertSchedule(input.animal_id, input.treatment, interval_days);
  return record;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from("records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
