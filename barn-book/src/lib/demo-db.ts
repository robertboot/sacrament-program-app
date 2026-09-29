/**
 * Demo backend: same surface as db.ts, but everything lives in
 * localStorage on the device. Used when VITE_DEMO=1 — lets someone try
 * the app with no Supabase project and no sign-in. Not multi-device.
 */
import { computeNextDue } from "./due";
import type { Animal, Schedule, TreatmentRecord } from "./types";
import type { NewAnimal, NewRecord } from "./db";

interface Store {
  animals: Animal[];
  schedules: Schedule[];
  records: TreatmentRecord[];
}

const KEY = "barn-book-demo";

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    // fall through to a fresh store
  }
  return { animals: [], schedules: [], records: [] };
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage unavailable — the session still works in memory
  }
}

let store = load();

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function listAnimals(includeArchived = false): Promise<Animal[]> {
  return store.animals
    .filter((a) => includeArchived || !a.archived)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAnimal(id: string): Promise<Animal> {
  const animal = store.animals.find((a) => a.id === id);
  if (!animal) throw new Error("Animal not found");
  return animal;
}

export async function createAnimal(
  input: NewAnimal,
  treatments: { treatment: string; intervalDays: number | null }[]
): Promise<Animal> {
  const animal: Animal = {
    id: uid(),
    user_id: "demo",
    name: input.name,
    species: input.species,
    breed: input.breed ?? null,
    born: input.born ?? null,
    notes: input.notes ?? null,
    archived: false,
    created_at: new Date().toISOString(),
  };
  store.animals.push(animal);
  for (const t of treatments) {
    store.schedules.push({
      id: uid(),
      animal_id: animal.id,
      treatment: t.treatment,
      interval_days: t.intervalDays,
      active: true,
    });
  }
  save(store);
  return animal;
}

export async function updateAnimal(
  id: string,
  patch: Partial<NewAnimal> & { archived?: boolean }
): Promise<void> {
  const animal = store.animals.find((a) => a.id === id);
  if (animal) Object.assign(animal, patch);
  save(store);
}

export async function listSchedules(animalId: string): Promise<Schedule[]> {
  return store.schedules
    .filter((s) => s.animal_id === animalId && s.active)
    .sort((a, b) => a.treatment.localeCompare(b.treatment));
}

export async function listAllSchedules(): Promise<Schedule[]> {
  return store.schedules.filter((s) => s.active);
}

export async function upsertSchedule(
  animalId: string,
  treatment: string,
  intervalDays: number | null
): Promise<void> {
  const existing = store.schedules.find(
    (s) => s.animal_id === animalId && s.treatment === treatment
  );
  if (existing) {
    existing.interval_days = intervalDays;
    existing.active = true;
  } else {
    store.schedules.push({
      id: uid(),
      animal_id: animalId,
      treatment,
      interval_days: intervalDays,
      active: true,
    });
  }
  save(store);
}

export async function deactivateSchedule(id: string): Promise<void> {
  const s = store.schedules.find((x) => x.id === id);
  if (s) s.active = false;
  save(store);
}

export async function listRecords(animalId: string): Promise<TreatmentRecord[]> {
  return store.records
    .filter((r) => r.animal_id === animalId)
    .sort(
      (a, b) =>
        b.given_on.localeCompare(a.given_on) ||
        b.created_at.localeCompare(a.created_at)
    );
}

export async function listAllRecords(): Promise<TreatmentRecord[]> {
  return [...store.records].sort((a, b) => b.given_on.localeCompare(a.given_on));
}

export async function logDose(input: NewRecord): Promise<TreatmentRecord> {
  const record: TreatmentRecord = {
    id: uid(),
    animal_id: input.animal_id,
    treatment: input.treatment,
    given_on: input.given_on,
    next_due: computeNextDue(input.given_on, input.interval_days),
    product: input.product ?? null,
    given_by: input.given_by ?? null,
    notes: input.notes ?? null,
    created_at: new Date().toISOString(),
  };
  store.records.push(record);
  save(store);
  await upsertSchedule(input.animal_id, input.treatment, input.interval_days);
  return record;
}

export async function deleteRecord(id: string): Promise<void> {
  store.records = store.records.filter((r) => r.id !== id);
  save(store);
}
