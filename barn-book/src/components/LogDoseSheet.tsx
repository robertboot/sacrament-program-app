import { useEffect, useMemo, useState } from "react";
import { logDose } from "../lib/db";
import { computeNextDue, dueState, statusLabel, todayLocal } from "../lib/due";
import { formatDate } from "../lib/format";
import type { Animal, Schedule } from "../lib/types";
import { Field, PrimaryButton, QuietButton, TextArea, TextInput, inputClass } from "./ui";

export interface LogDosePrefill {
  treatment?: string;
  intervalDays?: number | null;
}

export function LogDoseSheet({
  animal,
  schedules,
  prefill,
  onClose,
  onSaved,
}: {
  animal: Animal;
  schedules: Schedule[];
  prefill: LogDosePrefill;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [treatment, setTreatment] = useState(prefill.treatment ?? "");
  const [givenOn, setGivenOn] = useState(todayLocal());
  const [interval, setInterval] = useState<string>(
    prefill.intervalDays == null ? "" : String(prefill.intervalDays)
  );
  const [product, setProduct] = useState("");
  const [givenBy, setGivenBy] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Picking a tracked treatment pulls in its interval, unless the user
  // was already editing the interval for this open of the sheet.
  const [intervalTouched, setIntervalTouched] = useState(
    prefill.intervalDays !== undefined
  );
  useEffect(() => {
    if (intervalTouched) return;
    const match = schedules.find((s) => s.treatment === treatment);
    if (match) setInterval(match.interval_days == null ? "" : String(match.interval_days));
  }, [treatment, schedules, intervalTouched]);

  const intervalDays = interval.trim() === "" ? null : Number(interval);
  const intervalValid =
    intervalDays === null || (Number.isInteger(intervalDays) && intervalDays > 0);
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(givenOn);

  const nextDue = useMemo(() => {
    if (!dateValid || !intervalValid) return null;
    return computeNextDue(givenOn, intervalDays);
  }, [givenOn, intervalDays, dateValid, intervalValid]);

  const preview = useMemo(() => {
    if (!dateValid) return null;
    return dueState({ given_on: givenOn, next_due: nextDue }, todayLocal());
  }, [givenOn, nextDue, dateValid]);

  async function save() {
    if (!treatment.trim() || !dateValid || !intervalValid) {
      setError("Treatment and a valid date are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await logDose({
        animal_id: animal.id,
        treatment: treatment.trim(),
        given_on: givenOn,
        interval_days: intervalDays,
        product: product.trim() || null,
        given_by: givenBy.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={`Log a dose for ${animal.name}`}
        className="relative bg-paper border-t border-line rounded-t-sm max-h-[90svh] overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-xl text-ink">
            Log a dose — {animal.name}
          </h2>
          <button
            className="min-h-11 px-3 text-soft"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>

        <div className="mt-2 space-y-3">
          <Field label="Treatment">
            <TextInput
              list="treatment-options"
              value={treatment}
              onChange={(e) => setTreatment(e.target.value)}
              placeholder="e.g. Rabies"
              autoFocus={!prefill.treatment}
            />
            <datalist id="treatment-options">
              {schedules.map((s) => (
                <option key={s.id} value={s.treatment} />
              ))}
            </datalist>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Date given">
              <input
                type="date"
                value={givenOn}
                onChange={(e) => setGivenOn(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Repeat every (days)" hint="Blank = one-time, no reminder">
              <TextInput
                type="number"
                inputMode="numeric"
                min={1}
                value={interval}
                onChange={(e) => {
                  setInterval(e.target.value);
                  setIntervalTouched(true);
                }}
                placeholder="—"
              />
            </Field>
          </div>

          <div className="border-l-4 border-l-brass bg-card border border-line rounded-sm px-3 py-2">
            {nextDue ? (
              <p className="text-ink">
                Next due <span className="font-medium">{formatDate(nextDue)}</span>
                {preview && preview.status !== "none" && (
                  <span className="text-soft"> — {statusLabel(preview)}</span>
                )}
              </p>
            ) : (
              <p className="text-soft">One-time — no reminder will be set.</p>
            )}
          </div>

          <Field label="Product / dose / lot">
            <TextInput
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="e.g. Nobivac 1ml, lot 4A22"
            />
          </Field>
          <Field label="Given by">
            <TextInput
              value={givenBy}
              onChange={(e) => setGivenBy(e.target.value)}
              placeholder="e.g. Dr. Reyes, or Owner"
            />
          </Field>
          <Field label="Notes">
            <TextArea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          {error && <p className="text-sm text-overdue">{error}</p>}

          <div className="flex gap-2 pt-1">
            <PrimaryButton className="flex-1" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save dose"}
            </PrimaryButton>
            <QuietButton onClick={onClose}>Cancel</QuietButton>
          </div>
        </div>
      </div>
    </div>
  );
}
