import type { LeaderPosition, UnitType } from "./supabase/types";

export type { UnitType };

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

/** Display name for a leader position, ward/branch-aware. */
export function leaderPositionLabel(
  position: LeaderPosition | null | undefined,
  unitType: UnitType = "branch",
): string {
  if (!position) return "";
  if (position === "president") return unitLabels(unitType).leaderRole;
  if (position === "first_counselor") return "1st Counselor";
  if (position === "second_counselor") return "2nd Counselor";
  if (position === "clerk") return "Clerk";
  return "";
}

// Back-compat alias for v1 call sites still using "bishopricPositionLabel".
export const bishopricPositionLabel = leaderPositionLabel;

/**
 * "Bishop Smith" (ward) or "President Smith" (branch) for the senior leader
 * (`position === 'president'`). Counselors and clerks fall back to their
 * full name as-is.
 */
export function leaderDisplayName(
  unitType: UnitType,
  person: { full_name: string; position: LeaderPosition | null } | null,
): string {
  if (!person) return "—";
  if (person.position === "president") {
    const { leaderTitle } = unitLabels(unitType);
    const parts = person.full_name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    return `${leaderTitle} ${last}`;
  }
  return person.full_name;
}
