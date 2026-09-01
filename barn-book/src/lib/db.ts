import { supabase } from "./supabase";
import { computeNextDue } from "./due";
import type { Animal, Schedule, Species, TreatmentRecord } from "./types";
import * as demo from "./demo-db";

/** Demo build: no auth, localStorage-backed data (see demo-db.ts). */
export const IS_DEMO = import.meta.env.VITE_DEMO === "1";

function orThrow<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("No data returned");
  return data;
}

async function listAnimalsReal(includeArchived = false): Promise<Animal[]> {
  let q = supabase.from("animals").select("*").order("name");
  if (!includeArchived) q = q.eq("archived", false);
  return orThrow<Animal[]>(await q);
}
export const listAnimals = IS_DEMO ? demo.listAnimals : listAnimalsReal;

async function getAnimalReal(id: string): Promise<Animal> {
  return orThrow<Animal>(
    await supabase.from("animals").select("*").eq("id", id).single()
  );
}
export const getAnimal = IS_DEMO ? demo.getAnimal : getAnimalReal;

export interface NewAnimal {
  name: string;
  species: Species;
  breed?: string | null;
  born?: string | null;
  notes?: string | null;
}

async function createAnimalReal(
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
export const createAnimal = IS_DEMO ? demo.createAnimal : createAnimalReal;

async function updateAnimalReal(
  id: string,
  patch: Partial<NewAnimal> & { archived?: boolean }
): Promise<void> {
  const { error } = await supabase.from("animals").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
export const updateAnimal = IS_DEMO ? demo.updateAnimal : updateAnimalReal;

async function listSchedulesReal(animalId: string): Promise<Schedule[]> {
  return orThrow<Schedule[]>(
    await supabase
      .from("schedules")
      .select("*")
      .eq("animal_id", animalId)
      .eq("active", true)
      .order("treatment")
  );
}
export const listSchedules = IS_DEMO ? demo.listSchedules : listSchedulesReal;

async function listAllSchedulesReal(): Promise<Schedule[]> {
  return orThrow<Schedule[]>(
    await supabase.from("schedules").select("*").eq("active", true)
  );
}
export const listAllSchedules = IS_DEMO ? demo.listAllSchedules : listAllSchedulesReal;

async function upsertScheduleReal(
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
export const upsertSchedule = IS_DEMO ? demo.upsertSchedule : upsertScheduleReal;

async function deactivateScheduleReal(id: string): Promise<void> {
  const { error } = await supabase
    .from("schedules")
    .update({ active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
export const deactivateSchedule = IS_DEMO
  ? demo.deactivateSchedule
  : deactivateScheduleReal;

async function listRecordsReal(animalId: string): Promise<TreatmentRecord[]> {
  return orThrow<TreatmentRecord[]>(
    await supabase
      .from("records")
      .select("*")
      .eq("animal_id", animalId)
      .order("given_on", { ascending: false })
      .order("created_at", { ascending: false })
  );
}
export const listRecords = IS_DEMO ? demo.listRecords : listRecordsReal;

async function listAllRecordsReal(): Promise<TreatmentRecord[]> {
  return orThrow<TreatmentRecord[]>(
    await supabase
      .from("records")
      .select("*")
      .order("given_on", { ascending: false })
  );
}
export const listAllRecords = IS_DEMO ? demo.listAllRecords : listAllRecordsReal;

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
async function logDoseReal(input: NewRecord): Promise<TreatmentRecord> {
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
export const logDose = IS_DEMO ? demo.logDose : logDoseReal;

async function deleteRecordReal(id: string): Promise<void> {
  const { error } = await supabase.from("records").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
export const deleteRecord = IS_DEMO ? demo.deleteRecord : deleteRecordReal;
