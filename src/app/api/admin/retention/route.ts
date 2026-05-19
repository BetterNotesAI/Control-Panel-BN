import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type {
  RetentionChurnedUser,
  RetentionMetrics,
  RetentionNeverActiveUser,
  RetentionResponse,
  RetentionTopUser,
} from "@/types/retention";

const FETCH_PAGE_SIZE = 1000;
const TOP_USERS_LIMIT = 10;
const CHURNED_USERS_LIMIT = 100;
const NEVER_ACTIVE_USERS_LIMIT = 100;

interface UserActivity {
  userId: string;
  projectIds: Set<string>;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  totalTokens: number;
  totalCredits: number;
}

interface ProfileRow {
  id: string;
  email: string | null;
  plan: string;
  created_at: string | null;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

// Denominator is total profiles; numerator is users with AI activity in the recency window.
function computeRetentionMetrics(
  activeUsers: UserActivity[],
  totalUsers: number,
  windowStart: Date,
  windowLabel: "7d" | "30d",
): RetentionMetrics {
  const returned = activeUsers.filter(
    (u) => u.lastActivityAt && new Date(u.lastActivityAt) >= windowStart,
  );

  const retentionRate =
    totalUsers > 0 ? roundTo((returned.length / totalUsers) * 100, 1) : 0;

  return {
    window: windowLabel,
    cohortSize: totalUsers,
    returned: returned.length,
    retentionRate,
  };
}

async function fetchAllUserActivity(): Promise<Map<string, UserActivity>> {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, UserActivity>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("analytics_ai_usage_by_project_v")
      .select("user_id,project_id,first_event_at,last_event_at,total_tokens,total_credits")
      .order("user_id", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = data ?? [];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const existing = map.get(row.user_id) ?? {
        userId: row.user_id,
        projectIds: new Set<string>(),
        firstActivityAt: null,
        lastActivityAt: null,
        totalTokens: 0,
        totalCredits: 0,
      };

      if (row.project_id) {
        existing.projectIds.add(row.project_id);
      }

      if (
        row.first_event_at &&
        (!existing.firstActivityAt || row.first_event_at < existing.firstActivityAt)
      ) {
        existing.firstActivityAt = row.first_event_at;
      }

      if (
        row.last_event_at &&
        (!existing.lastActivityAt || row.last_event_at > existing.lastActivityAt)
      ) {
        existing.lastActivityAt = row.last_event_at;
      }

      existing.totalTokens += toNumber(row.total_tokens);
      existing.totalCredits += toNumber(row.total_credits);

      map.set(row.user_id, existing);
    }

    if (rows.length < FETCH_PAGE_SIZE) {
      break;
    }

    from += FETCH_PAGE_SIZE;
  }

  return map;
}

// Fetches ALL profiles — used both for enrichment and to find never-active users.
async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const supabase = getSupabaseAdminClient();
  const profiles: ProfileRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,plan,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as ProfileRow[];
    profiles.push(...rows);

    if (rows.length < FETCH_PAGE_SIZE) {
      break;
    }

    from += FETCH_PAGE_SIZE;
  }

  return profiles;
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const [activityMap, allProfiles] = await Promise.all([
      fetchAllUserActivity(),
      fetchAllProfiles(),
    ]);

    // Build a lookup map from all profiles for quick enrichment.
    const profileMap = new Map<string, ProfileRow>(
      allProfiles.map((p) => [p.id, p]),
    );

    const activeUsers = Array.from(activityMap.values()).filter(
      (u) => u.firstActivityAt && u.lastActivityAt,
    );

    const totalUsers = allProfiles.length;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const retention7d = computeRetentionMetrics(activeUsers, totalUsers, sevenDaysAgo, "7d");
    const retention30d = computeRetentionMetrics(activeUsers, totalUsers, thirtyDaysAgo, "30d");

    const topUsers: RetentionTopUser[] = [...activeUsers]
      .sort((a, b) => {
        const projectDiff = b.projectIds.size - a.projectIds.size;
        if (projectDiff !== 0) return projectDiff;
        return b.totalTokens - a.totalTokens;
      })
      .slice(0, TOP_USERS_LIMIT)
      .map((u) => {
        const profile = profileMap.get(u.userId);
        return {
          user_id: u.userId,
          email: profile?.email ?? null,
          plan: profile?.plan ?? "free",
          total_projects: u.projectIds.size,
          total_tokens: Math.round(u.totalTokens),
          first_activity_at: u.firstActivityAt!,
          last_activity_at: u.lastActivityAt!,
        };
      });

    // Signed up but never triggered any AI activity.
    const neverActiveUsers: RetentionNeverActiveUser[] = allProfiles
      .filter((p) => !activityMap.has(p.id))
      .map((p) => ({
        user_id: p.id,
        email: p.email,
        plan: p.plan ?? "free",
        signed_up_at: p.created_at ?? now.toISOString(),
        days_since_signup: daysBetween(new Date(p.created_at ?? now.toISOString()), now),
      }))
      .sort((a, b) => b.days_since_signup - a.days_since_signup)
      .slice(0, NEVER_ACTIVE_USERS_LIMIT);

    // Had AI activity but hasn't been back in 7+ days.
    const churnedUsers: RetentionChurnedUser[] = activeUsers
      .filter((u) => u.lastActivityAt && new Date(u.lastActivityAt) < sevenDaysAgo)
      .sort(
        (a, b) =>
          new Date(a.lastActivityAt!).getTime() - new Date(b.lastActivityAt!).getTime(),
      )
      .slice(0, CHURNED_USERS_LIMIT)
      .map((u) => {
        const profile = profileMap.get(u.userId);
        return {
          user_id: u.userId,
          email: profile?.email ?? null,
          plan: profile?.plan ?? "free",
          total_projects: u.projectIds.size,
          last_activity_at: u.lastActivityAt!,
          days_since: daysBetween(new Date(u.lastActivityAt!), now),
        };
      });

    const response: RetentionResponse = {
      generatedAt: now.toISOString(),
      totalUsers,
      retention7d,
      retention30d,
      topUsers,
      neverActiveUsers,
      churnedUsers,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load retention data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
