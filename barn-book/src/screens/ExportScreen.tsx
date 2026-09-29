import { useEffect, useState } from "react";
import { EmptyNote, PrimaryButton, SectionHeading } from "../components/ui";
import { speciesLabel } from "../lib/catalog";
import { buildRecordsCsv } from "../lib/csv";
import { listAllRecords, listAnimals } from "../lib/db";
import { todayLocal } from "../lib/due";
import { navigate } from "../lib/router";
import type { Animal } from "../lib/types";

export function ExportScreen() {
  const [animals, setAnimals] = useState<Animal[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    listAnimals(true)
      .then(setAnimals)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function downloadCsv() {
    setDownloading(true);
    setError(null);
    try {
      const [all, records] = await Promise.all([listAnimals(true), listAllRecords()]);
      const csv = buildRecordsCsv(all, records);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `barn-book-${todayLocal()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDownloading(false);
    }
  }

  if (error && animals === null) return <p className="text-overdue px-1 py-4">{error}</p>;
  if (animals === null) return <p className="text-soft px-1 py-4">Loading…</p>;

  return (
    <div>
      <button
        onClick={() => navigate({ name: "board" })}
        className="min-h-11 -ml-1 px-1 text-soft"
      >
        ‹ Back to the board
      </button>
      <h1 className="font-serif text-2xl text-ink mt-1">Export</h1>

      <SectionHeading>Everything as a spreadsheet</SectionHeading>
      <p className="text-sm text-soft mb-3">
        One CSV row per dose ever logged — animal, species, treatment, date
        given, next due, product, given by, notes. Opens in Excel, Numbers, or
        Sheets.
      </p>
      <PrimaryButton onClick={downloadCsv} disabled={downloading}>
        {downloading ? "Preparing…" : "Download CSV"}
      </PrimaryButton>
      {error && <p className="mt-2 text-sm text-overdue">{error}</p>}

      <SectionHeading>Printable record, one animal</SectionHeading>
      <p className="text-sm text-soft mb-3">
        A clean page to hand to a vet or bring to a Coggins check.
      </p>
      {animals.length === 0 ? (
        <EmptyNote>
          Start with one animal — once something is logged there will be a
          record to print.
        </EmptyNote>
      ) : (
        <div className="space-y-2">
          {animals.map((a) => (
            <button
              key={a.id}
              onClick={() => navigate({ name: "print", id: a.id })}
              className="w-full text-left bg-card border border-line rounded-sm px-3 py-2.5 min-h-11 flex items-center justify-between gap-3"
            >
              <span>
                <span className="font-serif text-ink">{a.name}</span>
                <span className="text-soft text-sm">
                  {" "}
                  · {speciesLabel(a.species)}
                  {a.archived && " · archived"}
                </span>
              </span>
              <span className="text-soft text-sm shrink-0">Printable record ›</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
