import { useState } from "react";
import {
  Field,
  PrimaryButton,
  QuietButton,
  SectionHeading,
  TextArea,
  TextInput,
  inputClass,
} from "../components/ui";
import { CATALOG, SPECIES } from "../lib/catalog";
import { createAnimal } from "../lib/db";
import { navigate } from "../lib/router";
import type { Species } from "../lib/types";

interface Chip {
  treatment: string;
  intervalDays: number | null;
  selected: boolean;
  custom: boolean;
}

function chipsFor(species: Species, prev: Chip[]): Chip[] {
  const catalog: Chip[] = CATALOG[species].map((c) => ({
    treatment: c.treatment,
    intervalDays: c.intervalDays,
    selected: true,
    custom: false,
  }));
  // Carry user-added treatments across a species switch.
  return [...catalog, ...prev.filter((c) => c.custom)];
}

export function AddAnimal() {
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("horse");
  const [breed, setBreed] = useState("");
  const [born, setBorn] = useState("");
  const [notes, setNotes] = useState("");
  const [chips, setChips] = useState<Chip[]>(() => chipsFor("horse", []));
  const [customName, setCustomName] = useState("");
  const [customInterval, setCustomInterval] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function switchSpecies(next: Species) {
    setSpecies(next);
    setChips((prev) => chipsFor(next, prev));
  }

  function toggleChip(treatment: string) {
    setChips((prev) =>
      prev.map((c) =>
        c.treatment === treatment ? { ...c, selected: !c.selected } : c
      )
    );
  }

  function addCustom() {
    const t = customName.trim();
    const days = customInterval.trim() === "" ? null : Number(customInterval);
    if (!t) return;
    if (days !== null && (!Number.isInteger(days) || days <= 0)) {
      setError("Custom interval must be whole days, or blank for one-time.");
      return;
    }
    setError(null);
    setChips((prev) =>
      prev.some((c) => c.treatment.toLowerCase() === t.toLowerCase())
        ? prev
        : [...prev, { treatment: t, intervalDays: days, selected: true, custom: true }]
    );
    setCustomName("");
    setCustomInterval("");
  }

  async function save() {
    if (!name.trim()) {
      setError("A name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const animal = await createAnimal(
        {
          name: name.trim(),
          species,
          breed: breed.trim() || null,
          born: born.trim() || null,
          notes: notes.trim() || null,
        },
        chips
          .filter((c) => c.selected)
          .map((c) => ({ treatment: c.treatment, intervalDays: c.intervalDays }))
      );
      navigate({ name: "animal", id: animal.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
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
      <h1 className="font-serif text-2xl text-ink mt-1">Add an animal</h1>

      <div className="mt-3 space-y-3">
        <Field label="Name">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Species">
            <select
              value={species}
              onChange={(e) => switchSpecies(e.target.value as Species)}
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
      </div>

      <SectionHeading>Treatments to track</SectionHeading>
      <p className="text-sm text-soft -mt-1 mb-2">
        Tap to include or leave out. Intervals are defaults — change them any
        time on the animal.
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.treatment}
            onClick={() => toggleChip(c.treatment)}
            aria-pressed={c.selected}
            className={`min-h-11 px-3 rounded-sm border text-left ${
              c.selected
                ? "border-brass bg-card text-ink"
                : "border-line bg-paper text-soft"
            }`}
          >
            <span className="font-serif">{c.treatment}</span>
            <span className="text-xs text-soft">
              {" "}
              {c.intervalDays == null ? "one-time" : `${c.intervalDays}d`}
              {c.selected ? " ✓" : ""}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field label="Add your own">
          <TextInput
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="e.g. Joint injection"
            className="w-48"
          />
        </Field>
        <Field label="Every (days)">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            value={customInterval}
            onChange={(e) => setCustomInterval(e.target.value)}
            placeholder="—"
            className="w-28"
          />
        </Field>
        <QuietButton onClick={addCustom}>Add</QuietButton>
      </div>

      {error && <p className="mt-3 text-sm text-overdue">{error}</p>}

      <div className="mt-6 flex gap-2">
        <PrimaryButton className="flex-1" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Add to the barn"}
        </PrimaryButton>
        <QuietButton onClick={() => navigate({ name: "board" })}>Cancel</QuietButton>
      </div>
    </div>
  );
}
