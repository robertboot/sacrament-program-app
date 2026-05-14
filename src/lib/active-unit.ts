import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  LeaderPosition,
  MemberRole,
  Profile,
  Unit,
} from "@/lib/supabase/types";

export type ActiveUnitContext = {
  userId: string;
  profile: Profile;
  unit: Unit;
  role: MemberRole;
  position: LeaderPosition | null;
};

/**
 * Server-only resolver: returns the signed-in user's currently active unit
 * along with their role/position in it. Returns null on any of:
 *   - not signed in
 *   - profile row missing (signup trigger hasn't fired)
 *   - active_unit_id is null (user hasn't created or joined a unit yet)
 *   - user is not (or no longer) a member of that unit
 *
 * Callers decide what to do with a null return (typically redirect to
 * /onboarding to create or accept an invite).
 */
export async function loadActiveUnit(): Promise<ActiveUnitContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();
  if (!profile) return null;

  if (!profile.active_unit_id) return null;

  const { data: unit } = await supabase
    .from("units")
    .select("*")
    .eq("id", profile.active_unit_id)
    .single<Unit>();
  if (!unit) return null;

  const { data: membership } = await supabase
    .from("unit_members")
    .select("role, position")
    .eq("unit_id", unit.id)
    .eq("user_id", user.id)
    .maybeSingle<{ role: MemberRole; position: LeaderPosition | null }>();
  if (!membership) return null;

  return {
    userId: user.id,
    profile,
    unit,
    role: membership.role,
    position: membership.position,
  };
}

/**
 * Returns every unit the signed-in user belongs to, for the unit switcher
 * dropdown in the nav.
 */
export async function loadUserUnits(): Promise<
  { id: string; name: string; type: Unit["type"]; role: MemberRole }[]
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("unit_members")
    .select("role, units(id, name, type)")
    .eq("user_id", user.id);
  if (!data) return [];

  return data
    .map((r) => {
      const u = Array.isArray(r.units) ? r.units[0] : r.units;
      if (!u) return null;
      return {
        id: u.id as string,
        name: u.name as string,
        type: u.type as Unit["type"],
        role: r.role as MemberRole,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
