import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type {
  RetentionMetrics,
  RetentionOneTimeUser,
  RetentionResponse,
  RetentionTopUser,
} from "@/types/retention";

const FETCH_PAGE_SIZE = 1000;
const TOP_USERS_LIMIT = 25;
const ONE_TIME_USERS_LIMIT = 100;

interface UserActivity {
  userId: string;
  projectIds: Set<string>;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  totalTokens: number;
  totalCredits: number;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

// cohort = users first active >7 days ago (shared denominator for both windows)
// returned = how many of that cohort had activity within the recency window
function computeRetentionMetrics(
  cohort: UserActivity[],
  windowStart: Date,
  windowLabel: "7d" | "30d",
): RetentionMetrics {
  const returned = cohort.filter(
    (u) => u.lastActivityAt && new Date(u.lastActivityAt) >= windowStart,
  );

  const retentionRate =
    cohort.length > 0 ? roundTo((returned.length / cohort.length) * 100, 1) : 0;

  return {
    window: windowLabel,
    cohortSize: cohort.length,
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

async function fetchProfileMap(
  userIds: string[],
): Promise<Map<string, { email: string | null; plan: string }>> {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, { email: string | null; plan: string }>();

  if (userIds.length === 0) {
    return map;
  }

  const batchSize = 5000;

  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);

    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,plan")
      .in("id", batch);

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      map.set(row.id, {
        email: row.email ?? null,
        plan: typeof row.plan === "string" ? row.plan : "free",
      });
    }
  }

  return map;
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const activityMap = await fetchAllUserActivity();
    const users = Array.from(activityMap.values());
    const activeUsers = users.filter((u) => u.firstActivityAt && u.lastActivityAt);

    const profileMap = await fetchProfileMap(activeUsers.map((u) => u.userId));

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Cohort: all users who ever had AI activity (lifetime users).
    // 7d and 30d only change the recency window, so 30d% >= 7d% always.
    const retention7d = computeRetentionMetrics(activeUsers, sevenDaysAgo, "7d");
    const retention30d = computeRetentionMetrics(activeUsers, thirtyDaysAgo, "30d");

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

    const oneTimeUsers: RetentionOneTimeUser[] = activeUsers
      .filter(
        (u) =>
          u.projectIds.size === 1 &&
          u.lastActivityAt &&
          new Date(u.lastActivityAt) < sevenDaysAgo,
      )
      .sort(
        (a, b) =>
          new Date(a.lastActivityAt!).getTime() - new Date(b.lastActivityAt!).getTime(),
      )
      .slice(0, ONE_TIME_USERS_LIMIT)
      .map((u) => {
        const profile = profileMap.get(u.userId);
        return {
          user_id: u.userId,
          email: profile?.email ?? null,
          plan: profile?.plan ?? "free",
          only_activity_at: u.lastActivityAt!,
          days_since: daysBetween(new Date(u.lastActivityAt!), now),
        };
      });

    const response: RetentionResponse = {
      generatedAt: now.toISOString(),
      totalUsersWithActivity: activeUsers.length,
      retention7d,
      retention30d,
      topUsers,
      oneTimeUsers,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load retention data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
