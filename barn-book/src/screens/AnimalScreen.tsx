import { useCallback, useEffect, useState } from "react";
import { LogDoseSheet, type LogDosePrefill } from "../components/LogDoseSheet";
import {
  EmptyNote,
  Field,
  PrimaryButton,
  QuietButton,
  SectionHeading,
  TextArea,
  TextInput,
  inputClass,
} from "../components/ui";
import { latestRecords, pairKey } from "../lib/board";
import { speciesLabel, SPECIES } from "../lib/catalog";
import {
  deactivateSchedule,
  getAnimal,
  listRecords,
  listSchedules,
  updateAnimal,
  upsertSchedule,
} from "../lib/db";
import { dueState, statusLabel, todayLocal } from "../lib/due";
import { formatDate, STATUS_BORDER, STATUS_TEXT } from "../lib/format";
import { navigate } from "../lib/router";
import type { Animal, Schedule, Species, TreatmentRecord } from "../lib/types";

function EditAnimalForm({
  animal,
  onDone,
}: {
  animal: Animal;
  onDone: (changed: boolean) => void;
}) {
  const [name, setName] = useState(animal.name);
  const [species, setSpecies] = useState<Species>(animal.species);
  const [breed, setBreed] = useState(animal.breed ?? "");
  const [born, setBorn] = useState(animal.born ?? "");
  const [notes, setNotes] = useState(animal.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateAnimal(animal.id, {
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        born: born.trim() || null,
        notes: notes.trim() || null,
      });
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-line rounded-sm p-3 space-y-3">
      <Field label="Name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Species">
          <select
            value={species}
            onChange={(e) => setSpecies(e.target.value as Species)}
            className={inputClass}
          >
            {SPECIES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Born">
          <TextInput
            value={born}
            onChange={(e) => setBorn(e.target.value)}
            placeholder="e.g. 2019"
          />
        </Field>
      </div>
      <Field label="Breed">
        <TextInput value={breed} onChange={(e) => setBreed(e.target.value)} />
      </Field>
      <Field label="Notes">
        <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {error && <p className="text-sm text-overdue">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </PrimaryButton>
        <QuietButton onClick={() => onDone(false)}>Cancel</QuietButton>
      </div>
    </div>
  );
}

function AddTreatmentForm({
  animalId,
  onDone,
}: {
  animalId: string;
  onDone: (changed: boolean) => void;
}) {
  const [treatment, setTreatment] = useState("");
  const [interval, setInterval] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const days = interval.trim() === "" ? null : Number(interval);
    if (!treatment.trim() || (days !== null && (!Number.isInteger(days) || days <= 0))) {
      setError("Give the treatment a name; interval is whole days or blank.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await upsertSchedule(animalId, treatment.trim(), days);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="bg-card border border-line rounded-sm p-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Treatment">
          <TextInput
            value={treatment}
            onChange={(e) => setTreatment(e.target.value)}
            placeholder="e.g. Joint injection"
            autoFocus
          />
        </Field>
        <Field label="Repeat every (days)" hint="Blank = one-time">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            placeholder="—"
          />
        </Field>
      </div>
      {error && <p className="text-sm text-overdue">{error}</p>}
      <div className="flex gap-2">
        <PrimaryButton onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Track it"}
        </PrimaryButton>
        <QuietButton onClick={() => onDone(false)}>Cancel</QuietButton>
      </div>
    </div>
  );
}

function ScheduleIntervalEditor({
  schedule,
  onDone,
}: {
  schedule: Schedule;
  onDone: (changed: boolean) => void;
}) {
  const [interval, setInterval] = useState(
    schedule.interval_days == null ? "" : String(schedule.interval_days)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const days = interval.trim() === "" ? null : Number(interval);
    if (days !== null && (!Number.isInteger(days) || days <= 0)) {
      setError("Whole days, or blank for no reminder.");
      return;
    }
    setSaving(true);
    try {
      await upsertSchedule(schedule.animal_id, schedule.treatment, days);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function stopTracking() {
    setSaving(true);
    try {
      await deactivateSchedule(schedule.id);
      onDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <Field label="Repeat every (days)">
        <TextInput
          type="number"
          inputMode="numeric"
          min={1}
          value={interval}
          onChange={(e) => setInterval(e.target.value)}
          className="w-32"
          placeholder="—"
        />
      </Field>
      <PrimaryButton onClick={save} disabled={saving}>
        Save
      </PrimaryButton>
      <QuietButton onClick={() => onDone(false)} disabled={saving}>
        Cancel
      </QuietButton>
      <button
        onClick={stopTracking}
        disabled={saving}
        className="min-h-11 px-3 text-overdue underline underline-offset-2 ml-auto"
      >
        Stop tracking
      </button>
      {error && <p className="w-full text-sm text-overdue">{error}</p>}
    </div>
  );
}

export function AnimalScreen({ id }: { id: string }) {
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [records, setRecords] = useState<TreatmentRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [editing, setEditing] = useState(false);
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [logPrefill, setLogPrefill] = useState<LogDosePrefill | null>(null);

  const reload = useCallback(() => {
    Promise.all([getAnimal(id), listSchedules(id), listRecords(id)])
      .then(([a, s, r]) => {
        setAnimal(a);
        setSchedules(s);
        setRecords(r);
        setLoaded(true);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  useEffect(reload, [reload]);

  if (error) return <p className="text-overdue px-1 py-4">{error}</p>;
  if (!loaded || !animal) return <p className="text-soft px-1 py-4">Loading…</p>;

  const today = todayLocal();
  const latest = latestRecords(records);
  const scheduleStates = schedules
    .map((s) => ({
      schedule: s,
      state: dueState(latest.get(pairKey(s.animal_id, s.treatment)) ?? null, today),
    }))
    .sort(
      (a, b) =>
        a.schedule.treatment.localeCompare(b.schedule.treatment)
    );

  async function toggleArchive() {
    if (!animal) return;
    const verb = animal.archived ? "Bring back" : "Archive";
    if (!window.confirm(`${verb} ${animal.name}? History is kept either way.`)) return;
    try {
      await updateAnimal(animal.id, { archived: !animal.archived });
      navigate({ name: "board" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <button
        onClick={() => navigate({ name: "board" })}
        className="min-h-11 -ml-1 px-1 text-soft"
      >
        ‹ Back to the board
      </button>

      {editing ? (
        <EditAnimalForm
          animal={animal}
          onDone={(changed) => {
            setEditing(false);
            if (changed) reload();
          }}
        />
      ) : (
        <header className="mt-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-serif text-3xl text-ink">
                {animal.name}
                {animal.archived && (
                  <span className="ml-2 align-middle text-sm text-soft border border-line rounded-sm px-1.5 py-0.5">
                    Archived
                  </span>
                )}
              </h1>
              <p className="text-soft text-sm mt-0.5">
                {speciesLabel(animal.species)}
                {animal.breed && ` · ${animal.breed}`}
                {animal.born && ` · born ${animal.born}`}
              </p>
              {animal.notes && <p className="text-ink text-sm mt-1.5">{animal.notes}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="min-h-11 px-3 text-brass underline underline-offset-2"
              >
                Edit
              </button>
              <button
                onClick={toggleArchive}
                className="min-h-11 px-3 text-soft underline underline-offset-2"
              >
                {animal.archived ? "Unarchive" : "Archive"}
              </button>
            </div>
          </div>
        </header>
      )}

      <SectionHeading>Schedule</SectionHeading>
      {scheduleStates.length === 0 && (
        <EmptyNote>
          Not tracking any treatments yet — add one below, or log a dose and
          give it a repeat interval.
        </EmptyNote>
      )}
      <div className="space-y-2">
        {scheduleStates.map(({ schedule, state }) => (
          <div
            key={schedule.id}
            className={`bg-card border border-line rounded-sm border-l-4 ${STATUS_BORDER[state.status]} px-3 py-2.5`}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                className="text-left min-h-11 flex-1"
                onClick={() =>
                  setEditingScheduleId(
                    editingScheduleId === schedule.id ? null : schedule.id
                  )
                }
              >
                <span className="font-serif text-ink">{schedule.treatment}</span>
                <span className={`block text-sm ${STATUS_TEXT[state.status]}`}>
                  {statusLabel(state)}
                </span>
                <span className="block text-sm text-soft">
                  Last {formatDate(state.lastGiven)}
                  {state.nextDue && ` · next ${formatDate(state.nextDue)}`}
                  {schedule.interval_days != null &&
                    ` · every ${schedule.interval_days}d`}
                </span>
              </button>
              <PrimaryButton
                onClick={() =>
                  setLogPrefill({
                    treatment: schedule.treatment,
                    intervalDays: schedule.interval_days,
                  })
                }
              >
                Log a dose
              </PrimaryButton>
            </div>
            {editingScheduleId === schedule.id && (
              <ScheduleIntervalEditor
                schedule={schedule}
                onDone={(changed) => {
                  setEditingScheduleId(null);
                  if (changed) reload();
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        {addingTreatment ? (
          <AddTreatmentForm
            animalId={animal.id}
            onDone={(changed) => {
              setAddingTreatment(false);
              if (changed) reload();
            }}
          />
        ) : (
          <div className="flex gap-2">
            <QuietButton onClick={() => setAddingTreatment(true)}>
              Track another treatment
            </QuietButton>
            <QuietButton onClick={() => setLogPrefill({})}>
              Log something else
            </QuietButton>
          </div>
        )}
      </div>

      <SectionHeading>History</SectionHeading>
      {records.length === 0 ? (
        <EmptyNote>
          No doses logged yet. Tap “Log a dose” on a schedule row to start the
          record.
        </EmptyNote>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div
              key={r.id}
              className="bg-card border border-line rounded-sm px-3 py-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-serif text-ink">{r.treatment}</span>
                <span className="text-sm text-soft shrink-0">
                  {formatDate(r.given_on)}
                </span>
              </div>
              <p className="text-sm text-soft">
                {r.product && <>{r.product} · </>}
                {r.given_by && <>by {r.given_by} · </>}
                {r.next_due ? `next due ${formatDate(r.next_due)}` : "one-time"}
              </p>
              {r.notes && <p className="text-sm text-ink mt-1">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {logPrefill && (
        <LogDoseSheet
          animal={animal}
          schedules={schedules}
          prefill={logPrefill}
          onClose={() => setLogPrefill(null)}
          onSaved={() => {
            setLogPrefill(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
