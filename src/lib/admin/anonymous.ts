import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

/**
 * Returns the set of Supabase auth user IDs flagged `is_anonymous`.
 *
 * Anonymous users are created by the landing-page cheat-sheet flow via
 * `signInAnonymously()`. They get a `profiles` row like any other user, so any
 * "registered user" metric must exclude these IDs. Best-effort: returns an
 * empty set if the auth listing fails.
 */
export async function fetchAnonymousUserIds(): Promise<Set<string>> {
  const supabase = getSupabaseAdminClient();
  const ids = new Set<string>();

  try {
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.is_anonymous) ids.add(u.id);
      }
      if (data.users.length < 1000) break;
      page++;
    }
  } catch {
    // Best-effort enrichment — proceed without the exclusion list.
  }

  return ids;
}

/** Builds a Postgrest `not in (...)` value string, or null if the set is empty. */
export function anonExclusionFilter(anonIds: Set<string>): string | null {
  if (anonIds.size === 0) return null;
  return `(${[...anonIds].join(",")})`;
}
