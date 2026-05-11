import type { BishopricPosition } from "./supabase/types";

export type UnitType = "ward" | "branch";

/**
 * Centralized ward/branch wording so swapping unit type doesn't require a
 * find/replace across the UI. Use this everywhere you would otherwise type
 * "Ward", "Bishop", or "Bishopric" — it picks the right word for the unit.
 */
export function unitLabels(unitType: UnitType) {
  return unitType === "ward"
    ? {
        unit: "Ward",
        unitLower: "ward",
        leadership: "Bishopric",
        leaderRole: "Bishop", // long form used in lists/labels
        leaderTitle: "Bishop", // short form prefixed to last name
      }
    : {
        unit: "Branch",
        unitLower: "branch",
        leadership: "Branch Presidency",
        leaderRole: "Branch President",
        leaderTitle: "President",
      };
}

/** Display name for a bishopric position, ward/branch-aware. */
export function bishopricPositionLabel(
  position: BishopricPosition | null | undefined,
  unitType: UnitType = "branch",
): string {
  if (!position) return "";
  if (position === "bishop") return unitLabels(unitType).leaderRole;
  if (position === "first_counselor") return "1st Counselor";
  if (position === "second_counselor") return "2nd Counselor";
  return "";
}

/**
 * "Bishop Smith" (ward) or "President Smith" (branch) for someone in the senior
 * bishopric slot. Counselors fall back to their full name as-is — they're
 * usually referred to by full name in the printed program.
 */
export function leaderDisplayName(
  unitType: UnitType,
  person: { full_name: string; bishopric_position: BishopricPosition | null } | null,
): string {
  if (!person) return "—";
  if (person.bishopric_position === "bishop") {
    const { leaderTitle } = unitLabels(unitType);
    const parts = person.full_name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    return `${leaderTitle} ${last}`;
  }
  return person.full_name;
}
