import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type {
  JourneySegment,
  JourneyUser,
  RetentionMetrics,
  RetentionResponse,
  RetentionTopUser,
} from "@/types/retention";

const FETCH_PAGE_SIZE = 1000;
const TOP_USERS_LIMIT = 10;
const PREMIUM_PLANS = new Set(["better", "best", "pro"]);

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
  phone_number: string | null;
  plan: string;
  created_at: string | null;
}

function daysBetween(earlier: Date, later: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / (1000 * 60 * 60 * 24));
}

function isSameCalendarDay(a: string, b: string): boolean {
  return (
    new Date(a).toISOString().slice(0, 10) === new Date(b).toISOString().slice(0, 10)
  );
}

function toJourneyUser(
  profile: ProfileRow,
  activity: UserActivity | undefined,
  now: Date,
): JourneyUser {
  const lastAt = activity?.lastActivityAt ?? null;
  const signedUpAt = profile.created_at;

  return {
    user_id: profile.id,
    email: profile.email,
    phone_number: profile.phone_number ?? null,
    plan: profile.plan ?? "free",
    signed_up_at: signedUpAt,
    first_activity_at: activity?.firstActivityAt ?? null,
    last_activity_at: lastAt,
    total_projects: activity?.projectIds.size ?? 0,
    days_since: lastAt
      ? daysBetween(new Date(lastAt), now)
      : signedUpAt
        ? daysBetween(new Date(signedUpAt), now)
        : null,
  };
}

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

function getOrCreateActivity(map: Map<string, UserActivity>, userId: string): UserActivity {
  const existing = map.get(userId);
  if (existing) return existing;
  const created: UserActivity = {
    userId,
    projectIds: new Set<string>(),
    firstActivityAt: null,
    lastActivityAt: null,
    totalTokens: 0,
    totalCredits: 0,
  };
  map.set(userId, created);
  return created;
}

async function fetchAllUserActivity(): Promise<Map<string, UserActivity>> {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, UserActivity>();

  // 1. Primary activity signal — ALL AI usage, including features that aren't
  //    tied to a project (e.g. cheat-sheet / exam_helper). The by-project view
  //    misses these, which previously mislabeled active users as "no content".
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("analytics_ai_usage_by_user_feature_model_v")
      .select("user_id,first_event_at,last_event_at,total_tokens,total_credits")
      .order("user_id", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const existing = getOrCreateActivity(map, row.user_id);

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
    }

    if (rows.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  // 2. Project counts — from the by-project view, only to populate the project
  //    count used for display and the "most active users" ranking. Timestamps
  //    and token totals already came from the (broader) view above.
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("analytics_ai_usage_by_project_v")
      .select("user_id,project_id")
      .order("user_id", { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.project_id) continue;
      const existing = getOrCreateActivity(map, row.user_id);
      existing.projectIds.add(row.project_id);
    }

    if (rows.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return map;
}

async function fetchAllProfiles(): Promise<ProfileRow[]> {
  const supabase = getSupabaseAdminClient();
  const profiles: ProfileRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,phone_number,plan,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + FETCH_PAGE_SIZE - 1);

    if (error) throw error;

    const rows = (data ?? []) as ProfileRow[];
    profiles.push(...rows);

    if (rows.length < FETCH_PAGE_SIZE) break;
    from += FETCH_PAGE_SIZE;
  }

  return profiles;
}

// Returns a map of user_id → whether email is confirmed.
// Fails silently — email confirmation is optional enrichment.
async function fetchEmailConfirmationMap(): Promise<Map<string, boolean>> {
  const supabase = getSupabaseAdminClient();
  const map = new Map<string, boolean>();

  try {
    let page = 1;

    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (error) break;

      const users = data?.users ?? [];

      for (const user of users) {
        map.set(user.id, Boolean(user.email_confirmed_at));
      }

      if (users.length < 1000) break;
      page++;
    }
  } catch {
    // Optional enrichment — proceed without confirmation data.
  }

  return map;
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const [activityMap, allProfiles, confirmationMap] = await Promise.all([
      fetchAllUserActivity(),
      fetchAllProfiles(),
      fetchEmailConfirmationMap(),
    ]);

    const profileMap = new Map<string, ProfileRow>(allProfiles.map((p) => [p.id, p]));

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
        const d = b.projectIds.size - a.projectIds.size;
        return d !== 0 ? d : b.totalTokens - a.totalTokens;
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

    // ── Journey segments ──────────────────────────────────────────────────────

    // 1. Unconfirmed email
    const unconfirmedProfiles = allProfiles.filter(
      (p) => confirmationMap.size > 0 && confirmationMap.get(p.id) === false,
    );

    // 2. No content — confirmed (or confirmation unknown) and no AI activity
    const noContentProfiles = allProfiles.filter(
      (p) => !activityMap.has(p.id) && confirmationMap.get(p.id) !== false,
    );

    // 3. One-day users — all activity falls on a single calendar day
    const oneDayUsers = activeUsers.filter(
      (u) =>
        u.firstActivityAt &&
        u.lastActivityAt &&
        isSameCalendarDay(u.firstActivityAt, u.lastActivityAt),
    );

    // 4. Retained — activity spans more than one calendar day
    const retainedUsers = activeUsers.filter(
      (u) =>
        u.firstActivityAt &&
        u.lastActivityAt &&
        !isSameCalendarDay(u.firstActivityAt, u.lastActivityAt),
    );

    // 5. Premium — plan is not free
    const premiumProfiles = allProfiles.filter((p) =>
      PREMIUM_PLANS.has((p.plan ?? "").toLowerCase()),
    );

    function pct(count: number): number {
      return totalUsers > 0 ? roundTo((count / totalUsers) * 100, 1) : 0;
    }

    const journey: JourneySegment[] = [
      {
        key: "unconfirmed",
        label: "Unconfirmed email",
        description: "Signed up but never verified their email address",
        count: unconfirmedProfiles.length,
        percentage: pct(unconfirmedProfiles.length),
        users: unconfirmedProfiles.map((p) =>
          toJourneyUser(p, activityMap.get(p.id), now),
        ),
      },
      {
        key: "no_content",
        label: "No content created",
        description: "Confirmed account but never created any AI content",
        count: noContentProfiles.length,
        percentage: pct(noContentProfiles.length),
        users: noContentProfiles.map((p) =>
          toJourneyUser(p, activityMap.get(p.id), now),
        ),
      },
      {
        key: "one_day",
        label: "One-day users",
        description: "Created content on a single day only",
        count: oneDayUsers.length,
        percentage: pct(oneDayUsers.length),
        users: oneDayUsers.map((u) =>
          toJourneyUser(profileMap.get(u.userId) ?? { id: u.userId, email: null, phone_number: null, plan: "free", created_at: null }, u, now),
        ),
      },
      {
        key: "retained",
        label: "Retained",
        description: "Came back on more than one day after first use",
        count: retainedUsers.length,
        percentage: pct(retainedUsers.length),
        users: retainedUsers
          .sort((a, b) => b.projectIds.size - a.projectIds.size)
          .map((u) =>
            toJourneyUser(profileMap.get(u.userId) ?? { id: u.userId, email: null, phone_number: null, plan: "free", created_at: null }, u, now),
          ),
      },
      {
        key: "premium",
        label: "Premium",
        description: "On a paid plan (Better or Best)",
        count: premiumProfiles.length,
        percentage: pct(premiumProfiles.length),
        users: premiumProfiles.map((p) =>
          toJourneyUser(p, activityMap.get(p.id), now),
        ),
      },
    ];

    const response: RetentionResponse = {
      generatedAt: now.toISOString(),
      totalUsers,
      retention7d,
      retention30d,
      journey,
      topUsers,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load retention data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
