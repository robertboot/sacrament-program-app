"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  Minus,
  OctagonXIcon,
  Plus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Data model — stored in localStorage only; nothing leaves the phone. */
/* ------------------------------------------------------------------ */

type TimeOfDay = "morning" | "evening";

type Entry = {
  id: string;
  date: string; // yyyy-MM-dd
  time: TimeOfDay;
  peakFlow: number | null; // L/min
  symptoms: string[];
  relieverPuffs: number;
  preventerTaken: boolean;
  triggers: string;
  notes: string;
  createdAt: string; // ISO
};

type Store = {
  entries: Entry[];
  personalBest: number | null; // L/min
};

const STORAGE_KEY = "annelies-asthma-tracker:v1";

const SYMPTOMS = [
  "Cough",
  "Wheeze",
  "Short of breath",
  "Chest tightness",
  "Woke at night",
] as const;

const EMPTY_STORE: Store = { entries: [], personalBest: null };

function parseStore(raw: string | null): Store {
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      personalBest:
        typeof parsed.personalBest === "number" ? parsed.personalBest : null,
    };
  } catch {
    return EMPTY_STORE;
  }
}

/* The store lives in localStorage; React reads it through
   useSyncExternalStore so first paint matches the server render and
   cross-tab edits stay in sync. */
const storeListeners = new Set<() => void>();
let storeCache: { raw: string | null; store: Store } = {
  raw: null,
  store: EMPTY_STORE,
};

function readStore(): Store {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (storeCache.raw !== raw) storeCache = { raw, store: parseStore(raw) };
  return storeCache.store;
}

function subscribeStore(cb: () => void) {
  storeListeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    storeListeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function writeStore(next: Store) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  storeListeners.forEach((cb) => cb());
}

/** Sort key: date, then morning before evening, then log order. */
function entryOrder(a: Entry, b: Entry) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time !== b.time) return a.time === "morning" ? -1 : 1;
  return a.createdAt < b.createdAt ? -1 : 1;
}

/* ------------------------------------------------------- */
/* Peak-flow zones (relative to personal best): 80% / 50%.  */
/* ------------------------------------------------------- */

type Zone = "green" | "yellow" | "red";

function zoneFor(peakFlow: number, personalBest: number): Zone {
  const pct = peakFlow / personalBest;
  if (pct >= 0.8) return "green";
  if (pct >= 0.5) return "yellow";
  return "red";
}

const ZONE_META: Record<
  Zone,
  { label: string; hint: string; Icon: typeof CheckCircle2; className: string }
> = {
  green: {
    label: "Green zone",
    hint: "Doing well — keep up the usual routine.",
    Icon: CheckCircle2,
    className: "text-[#006300] dark:text-[#0ca30c]",
  },
  yellow: {
    label: "Yellow zone",
    hint: "Below 80% of best — follow the action plan.",
    Icon: AlertTriangle,
    className: "text-[#8a5a00] dark:text-[#fab219]",
  },
  red: {
    label: "Red zone",
    hint: "Below 50% of best — use reliever and get help.",
    Icon: OctagonXIcon,
    className: "text-[#b02a2a] dark:text-[#e66767]",
  },
};

function ZoneBadge({ zone, compact }: { zone: Zone; compact?: boolean }) {
  const { label, hint, Icon, className } = ZONE_META[zone];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="text-sm font-medium">{label}</span>
      {!compact && (
        <span className="text-sm text-muted-foreground">— {hint}</span>
      )}
    </span>
  );
}

/* -------------------------------------------------- */
/* Peak-flow trend chart (single series, last 30 pts) */
/* -------------------------------------------------- */

type ChartPoint = { entry: Entry; value: number };

const CHART = {
  w: 640,
  h: 240,
  left: 44,
  right: 14,
  top: 14,
  bottom: 26,
};

function niceStep(range: number) {
  const raw = range / 4;
  for (const s of [10, 20, 25, 50, 100, 200]) if (raw <= s) return s;
  return 500;
}

function PeakFlowChart({
  points,
  personalBest,
}: {
  points: ChartPoint[];
  personalBest: number | null;
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const { w, h, left, right, top, bottom } = CHART;
  const plotW = w - left - right;
  const plotH = h - top - bottom;

  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (personalBest) {
    lo = Math.min(lo, personalBest * 0.5);
    hi = Math.max(hi, personalBest);
  }
  lo = Math.floor((lo - 10) / 50) * 50;
  hi = Math.ceil((hi + 10) / 50) * 50;
  if (hi <= lo) hi = lo + 50;

  const x = (i: number) =>
    left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => top + plotH - ((v - lo) / (hi - lo)) * plotH;

  const step = niceStep(hi - lo);
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);

  // Sparse x labels: first, last, and up to two evenly spaced between.
  const labelIdx = new Set<number>([0, points.length - 1]);
  if (points.length > 4) {
    labelIdx.add(Math.round((points.length - 1) / 3));
    labelIdx.add(Math.round(((points.length - 1) * 2) / 3));
  }

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(" ");

  const thresholds =
    personalBest == null
      ? []
      : [
          { v: personalBest, label: `Best ${personalBest}` },
          { v: personalBest * 0.8, label: "80%" },
          { v: personalBest * 0.5, label: "50%" },
        ].filter((t) => t.v >= lo && t.v <= hi);

  const pick = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const vx = ((clientX - rect.left) / rect.width) * w;
    let best = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(x(i) - vx) < Math.abs(x(best) - vx)) best = i;
    setHover(best);
  };

  const hovered = hover != null ? points[hover] : null;

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="block w-full touch-pan-y select-none"
        role="img"
        aria-label="Peak flow readings over time, in litres per minute"
        onMouseMove={(e) => pick(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => pick(e.touches[0].clientX)}
        onTouchMove={(e) => pick(e.touches[0].clientX)}
      >
        {/* gridlines + y ticks */}
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={left}
              x2={w - right}
              y1={y(v)}
              y2={y(v)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={left - 8}
              y={y(v)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {v}
            </text>
          </g>
        ))}

        {/* personal-best / 80% / 50% thresholds */}
        {thresholds.map((t) => (
          <g key={t.label}>
            <line
              x1={left}
              x2={w - right}
              y1={y(t.v)}
              y2={y(t.v)}
              className="stroke-muted-foreground/60"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={w - right}
              y={y(t.v) - 4}
              textAnchor="end"
              className="fill-muted-foreground text-[10px]"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* x labels */}
        {points.map((p, i) =>
          labelIdx.has(i) ? (
            <text
              key={p.entry.id}
              x={x(i)}
              y={h - 8}
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[11px]"
            >
              {format(parseISO(p.entry.date), "d MMM")}
            </text>
          ) : null,
        )}

        {/* crosshair */}
        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={top}
            y2={top + plotH}
            className="stroke-muted-foreground/50"
            strokeWidth={1}
          />
        )}

        {/* series */}
        <path
          d={path}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
        />
        {points.map((p, i) => (
          <circle
            key={p.entry.id}
            cx={x(i)}
            cy={y(p.value)}
            r={hover === i ? 5 : 4}
            strokeWidth={2}
            className="fill-[#2a78d6] stroke-card dark:fill-[#3987e5]"
          />
        ))}
      </svg>

      {hovered && hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            left: `${(x(hover) / w) * 100}%`,
            top: `calc(${(y(hovered.value) / h) * 100}% - 44px)`,
          }}
        >
          <div className="font-medium tabular-nums">{hovered.value} L/min</div>
          <div className="text-muted-foreground">
            {format(parseISO(hovered.entry.date), "EEE d MMM")} ·{" "}
            {hovered.entry.time === "morning" ? "Morning" : "Evening"}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------- */
/* CSV download  */
/* ------------- */

function csvField(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv(entries: Entry[]) {
  const header =
    "date,time,peak_flow_l_min,symptoms,reliever_puffs,preventer_taken,triggers,notes";
  const rows = [...entries].sort(entryOrder).map((e) =>
    [
      e.date,
      e.time,
      e.peakFlow ?? "",
      csvField(e.symptoms.join("; ")),
      e.relieverPuffs,
      e.preventerTaken ? "yes" : "no",
      csvField(e.triggers),
      csvField(e.notes),
    ].join(","),
  );
  const blob = new Blob([[header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "annelies-asthma-diary.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ------------- */
/* Main tracker  */
/* ------------- */

function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}

function defaultTime(): TimeOfDay {
  return new Date().getHours() < 12 ? "morning" : "evening";
}

export function AsthmaTracker() {
  const store = React.useSyncExternalStore(
    subscribeStore,
    readStore,
    () => EMPTY_STORE,
  );

  // Form state
  const [date, setDate] = React.useState(todayIso);
  const [time, setTime] = React.useState<TimeOfDay>(defaultTime);
  const [peakFlow, setPeakFlow] = React.useState("");
  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [relieverPuffs, setRelieverPuffs] = React.useState(0);
  const [preventerTaken, setPreventerTaken] = React.useState(false);
  const [triggers, setTriggers] = React.useState("");
  const [notes, setNotes] = React.useState("");
  // null = no unsaved edit; the field then mirrors the stored personal best.
  const [bestDraft, setBestDraft] = React.useState<string | null>(null);

  const personalBest = store.personalBest;
  const bestInput =
    bestDraft ?? (personalBest != null ? String(personalBest) : "");
  const peakFlowNum = peakFlow.trim() === "" ? null : Number(peakFlow);
  const peakFlowValid =
    peakFlowNum == null || (Number.isFinite(peakFlowNum) && peakFlowNum > 0);
  const liveZone =
    peakFlowNum != null && peakFlowValid && personalBest
      ? zoneFor(peakFlowNum, personalBest)
      : null;

  function toggleSymptom(s: string) {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  function saveEntry() {
    if (!date) {
      toast.error("Pick a date first.");
      return;
    }
    if (!peakFlowValid) {
      toast.error("Peak flow must be a positive number.");
      return;
    }
    const empty =
      peakFlowNum == null &&
      symptoms.length === 0 &&
      relieverPuffs === 0 &&
      !preventerTaken &&
      !triggers.trim() &&
      !notes.trim();
    if (empty) {
      toast.error("Nothing to save yet — add a reading or a symptom.");
      return;
    }
    const entry: Entry = {
      id: crypto.randomUUID(),
      date,
      time,
      peakFlow: peakFlowNum,
      symptoms,
      relieverPuffs,
      preventerTaken,
      triggers: triggers.trim(),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };
    writeStore({ ...store, entries: [...store.entries, entry] });
    // Reset the transient fields; keep date so a second entry is quick.
    setPeakFlow("");
    setSymptoms([]);
    setRelieverPuffs(0);
    setPreventerTaken(false);
    setTriggers("");
    setNotes("");
    toast.success("Entry saved.");
  }

  function deleteEntry(id: string) {
    writeStore({ ...store, entries: store.entries.filter((e) => e.id !== id) });
  }

  function savePersonalBest() {
    const n = bestInput.trim() === "" ? null : Number(bestInput);
    if (n != null && (!Number.isFinite(n) || n <= 0)) {
      toast.error("Personal best must be a positive number.");
      return;
    }
    writeStore({ ...store, personalBest: n });
    setBestDraft(null);
    toast.success(n ? `Personal best set to ${n} L/min.` : "Personal best cleared.");
  }

  const sorted = React.useMemo(
    () => [...store.entries].sort(entryOrder),
    [store],
  );
  const chartPoints: ChartPoint[] = React.useMemo(
    () =>
      sorted
        .filter((e) => e.peakFlow != null)
        .map((e) => ({ entry: e, value: e.peakFlow as number }))
        .slice(-30),
    [sorted],
  );

  // History grouped by date, newest first.
  const grouped = React.useMemo(() => {
    const byDate = new Map<string, Entry[]>();
    for (const e of [...sorted].reverse()) {
      const list = byDate.get(e.date) ?? [];
      list.push(e);
      byDate.set(e.date, list);
    }
    return [...byDate.entries()];
  }, [sorted]);

  return (
    <div className="flex-1 bg-[#fefaf4]">
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
      <header className="space-y-2 text-center">
        <h1 className="sr-only">Annelies&rsquo;s Asthma Tracker</h1>
        <Image
          src="/asthma/logo.webp"
          alt="Annelies's Asthma Tracker"
          width={640}
          height={696}
          priority
          className="mx-auto w-56 sm:w-64"
        />
        <p className="text-sm text-muted-foreground">
          A private diary of peak flow, symptoms and inhaler use. Everything is
          saved on this device only.
        </p>
      </header>

      {/* ------------------------ Log an entry ------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>Log an entry</CardTitle>
          <CardDescription>
            Morning and evening readings give the clearest trend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="entry-date">Date</Label>
              <Input
                id="entry-date"
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time of day</Label>
              <div className="grid grid-cols-2 gap-1 rounded-lg border border-input p-1">
                {(["morning", "evening"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-md px-2 py-1 text-sm capitalize transition-colors",
                      time === t
                        ? "bg-primary font-medium text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="peak-flow">Peak flow (L/min)</Label>
            <Input
              id="peak-flow"
              type="number"
              inputMode="numeric"
              min={0}
              step={10}
              placeholder={personalBest ? `Best is ${personalBest}` : "e.g. 380"}
              value={peakFlow}
              onChange={(e) => setPeakFlow(e.target.value)}
              aria-invalid={!peakFlowValid || undefined}
            />
            {liveZone && <ZoneBadge zone={liveZone} />}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Symptoms</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SYMPTOMS.map((s) => (
                <Label key={s} className="font-normal">
                  <Checkbox
                    checked={symptoms.includes(s)}
                    onCheckedChange={() => toggleSymptom(s)}
                  />
                  {s}
                </Label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Reliever (blue inhaler) puffs</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Fewer puffs"
                  disabled={relieverPuffs === 0}
                  onClick={() => setRelieverPuffs((n) => Math.max(0, n - 1))}
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center text-sm font-medium tabular-nums">
                  {relieverPuffs}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="More puffs"
                  onClick={() => setRelieverPuffs((n) => n + 1)}
                >
                  <Plus />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Preventer</Label>
              <Label className="h-8 font-normal">
                <Checkbox
                  checked={preventerTaken}
                  onCheckedChange={(v) => setPreventerTaken(v === true)}
                />
                Preventer inhaler taken
              </Label>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="triggers">Possible triggers</Label>
            <Input
              id="triggers"
              placeholder="e.g. pollen, exercise, cold air"
              value={triggers}
              onChange={(e) => setTriggers(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Anything else worth remembering"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <Button className="w-full" onClick={saveEntry}>
            Save entry
          </Button>
        </CardContent>
      </Card>

      {/* ------------------------ Trend chart ------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-muted-foreground" aria-hidden />
            Peak flow trend
          </CardTitle>
          <CardDescription>
            {chartPoints.length > 0
              ? `Last ${chartPoints.length} reading${chartPoints.length === 1 ? "" : "s"}, in L/min.`
              : "Readings will chart here once logged."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {chartPoints.length > 0 && (
            <PeakFlowChart points={chartPoints} personalBest={personalBest} />
          )}
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="personal-best">Personal best (L/min)</Label>
              <Input
                id="personal-best"
                type="number"
                inputMode="numeric"
                min={0}
                step={10}
                className="w-36"
                placeholder="e.g. 480"
                value={bestInput}
                onChange={(e) => setBestDraft(e.target.value)}
              />
            </div>
            <Button variant="outline" onClick={savePersonalBest}>
              Save best
            </Button>
            <p className="basis-full text-xs text-muted-foreground">
              The 80% and 50% lines — the yellow- and red-zone limits — come
              from this number.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ------------------------ History ------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            {sorted.length === 0
              ? "No entries yet."
              : `${sorted.length} entr${sorted.length === 1 ? "y" : "ies"}.`}
          </CardDescription>
          {sorted.length > 0 && (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadCsv(sorted)}
              >
                <Download data-icon="inline-start" />
                Export CSV
              </Button>
            </CardAction>
          )}
        </CardHeader>
        {sorted.length > 0 && (
          <CardContent className="space-y-4">
            {grouped.map(([day, entries]) => (
              <div key={day} className="space-y-2">
                <h3 className="text-sm font-medium">
                  {format(parseISO(day), "EEEE d MMMM yyyy")}
                </h3>
                {entries.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-medium capitalize">{e.time}</span>
                        {e.peakFlow != null && (
                          <span className="tabular-nums">
                            {e.peakFlow} L/min
                          </span>
                        )}
                        {e.peakFlow != null && personalBest && (
                          <ZoneBadge
                            zone={zoneFor(e.peakFlow, personalBest)}
                            compact
                          />
                        )}
                      </div>
                      {e.symptoms.length > 0 && (
                        <p className="text-muted-foreground">
                          Symptoms: {e.symptoms.join(", ")}
                        </p>
                      )}
                      {(e.relieverPuffs > 0 || e.preventerTaken) && (
                        <p className="text-muted-foreground">
                          {[
                            e.relieverPuffs > 0
                              ? `Reliever ×${e.relieverPuffs}`
                              : null,
                            e.preventerTaken ? "Preventer taken" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                      {e.triggers && (
                        <p className="text-muted-foreground">
                          Triggers: {e.triggers}
                        </p>
                      )}
                      {e.notes && (
                        <p className="text-muted-foreground">{e.notes}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete entry"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (window.confirm("Delete this entry?")) deleteEntry(e.id);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      <p className="pb-4 text-center text-xs text-muted-foreground">
        This diary is a memory aid, not medical advice. If breathing is hard,
        follow the asthma action plan or call for help.
      </p>
    </main>
    </div>
  );
}
