"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { weeksSinceLabel } from "@/lib/dates";
import { leaderPositionLabel, type UnitType } from "@/lib/labels";
import type { LeaderPosition } from "@/lib/supabase/types";
import { useMemo } from "react";

/**
 * Conductor picker — choose from the unit's leaders (president + counselors
 * + clerk). The caller passes the hydrated leader list from unit_members
 * + profiles join.
 */
export type ConductorOption = {
  user_id: string;
  full_name: string;
  position: LeaderPosition | null;
  last_conducted_date: string | null;
};

const POSITION_ORDER: Record<LeaderPosition, number> = {
  president: 0,
  first_counselor: 1,
  second_counselor: 2,
  clerk: 3,
};

function sortByConductingRotation(list: ConductorOption[]): ConductorOption[] {
  // Longest gap since last conducted floats to the top — same rule as v1.
  // Ties broken by position seniority.
  return [...list].sort((a, b) => {
    if (a.last_conducted_date === b.last_conducted_date) {
      return (POSITION_ORDER[a.position!] ?? 9) - (POSITION_ORDER[b.position!] ?? 9);
    }
    if (a.last_conducted_date === null) return -1;
    if (b.last_conducted_date === null) return 1;
    return a.last_conducted_date.localeCompare(b.last_conducted_date);
  });
}

export function ConductingPicker({
  leaders,
  value,
  onChange,
  unitType = "branch",
}: {
  leaders: ConductorOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  unitType?: UnitType;
}) {
  const sorted = useMemo(() => sortByConductingRotation(leaders), [leaders]);
  const next = sorted[0];

  function labelFor(id: string | null): string {
    if (!id || id === "_none") return "Pick conductor…";
    const p = leaders.find((x) => x.user_id === id);
    if (!p) return "—";
    return p.position
      ? `${p.full_name} (${leaderPositionLabel(p.position, unitType)})`
      : p.full_name;
  }

  return (
    <div className="space-y-1.5">
      <Select value={value ?? "_none"} onValueChange={(v) => onChange(v === "_none" ? null : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Pick conductor…">{labelFor(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_none">— None —</SelectItem>
          {sorted.map((p) => (
            <SelectItem key={p.user_id} value={p.user_id}>
              {p.full_name}
              {p.position && (
                <span className="text-muted-foreground ml-2">
                  ({leaderPositionLabel(p.position, unitType)})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {next && next.user_id !== value && (
        <p className="text-xs text-muted-foreground">
          Rotating to: <strong>{next.full_name}</strong> ({weeksSinceLabel(next.last_conducted_date)})
        </p>
      )}
    </div>
  );
}
