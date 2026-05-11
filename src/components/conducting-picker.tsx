"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { weeksSinceLabel } from "@/lib/dates";
import { sortBishopric } from "@/lib/rotation";
import { bishopricPositionLabel, type UnitType } from "@/lib/labels";
import type { Profile } from "@/lib/supabase/types";
import { useMemo } from "react";

export function ConductingPicker({
  bishopric,
  value,
  onChange,
  unitType = "branch",
}: {
  bishopric: Profile[];
  value: string | null;
  onChange: (id: string | null) => void;
  unitType?: UnitType;
}) {
  const sorted = useMemo(() => sortBishopric(bishopric), [bishopric]);
  const next = sorted[0];

  function labelFor(id: string | null): string {
    if (!id || id === "_none") return "Pick conductor…";
    const p = bishopric.find((x) => x.id === id);
    if (!p) return "—";
    return p.bishopric_position
      ? `${p.full_name} (${bishopricPositionLabel(p.bishopric_position, unitType)})`
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
            <SelectItem key={p.id} value={p.id}>
              {p.full_name}
              {p.bishopric_position && (
                <span className="text-muted-foreground ml-2">
                  ({bishopricPositionLabel(p.bishopric_position, unitType)})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {next && next.id !== value && (
        <p className="text-xs text-muted-foreground">
          Rotating to: <strong>{next.full_name}</strong> ({weeksSinceLabel(next.last_conducted_date)})
        </p>
      )}
    </div>
  );
}
