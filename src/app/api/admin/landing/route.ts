import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { LandingFeatureStat, LandingPageResponse, LandingRecentSession } from "@/types/landing";

const BATCH_SIZE = 500;
const RECENT_SESSIONS_LIMIT = 50;

export async function GET() {
  const authResult = await requireAdminForApi();
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // ── 1. Collect all anonymous auth users ───────────────────────────────────
    const anonUsers: Array<{ id: string; created_at: string }> = [];
    let authPage = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: authPage, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.is_anonymous) {
          anonUsers.push({ id: u.id, created_at: u.created_at });
        }
      }
      if (data.users.length < 1000) break;
      authPage++;
    }

    // ── 2. Time-bucket counts ────────────────────────────────────────────────
    let anonToday = 0, anon7d = 0, anon30d = 0;
    for (const u of anonUsers) {
      const t = new Date(u.created_at);
      if (t >= todayStart) anonToday++;
      if (t >= sevenDaysAgo) anon7d++;
      if (t >= thirtyDaysAgo) anon30d++;
    }

    // ── 3. Fetch AI activity for anonymous users ─────────────────────────────
    const anonIds = anonUsers.map((u) => u.id);

    // feature → { event_count, userIds, total_tokens }
    const featureMap = new Map<string, { eventCount: number; userIds: Set<string>; totalTokens: number }>();
    // user_id → { event_count, features, total_tokens, last_event_at }
    const userActivityMap = new Map<string, { eventCount: number; features: Set<string>; totalTokens: number; lastEventAt: string | null }>();

    for (let i = 0; i < anonIds.length; i += BATCH_SIZE) {
      const batch = anonIds.slice(i, i + BATCH_SIZE);
      const { data: rows } = await supabase
        .from("analytics_ai_usage_by_user_feature_model_v")
        .select("user_id,feature,event_count,total_tokens,last_event_at")
        .in("user_id", batch);

      for (const row of rows ?? []) {
        const feature = typeof row.feature === "string" && row.feature.trim() ? row.feature.trim() : "(unknown)";
        const eventCount = toNumber(row.event_count);
        const totalTokens = toNumber(row.total_tokens);

        // Per-feature aggregation
        const fEntry = featureMap.get(feature) ?? { eventCount: 0, userIds: new Set<string>(), totalTokens: 0 };
        fEntry.eventCount += eventCount;
        fEntry.userIds.add(row.user_id as string);
        fEntry.totalTokens += totalTokens;
        featureMap.set(feature, fEntry);

        // Per-user aggregation
        const uEntry = userActivityMap.get(row.user_id as string) ?? { eventCount: 0, features: new Set<string>(), totalTokens: 0, lastEventAt: null };
        uEntry.eventCount += eventCount;
        uEntry.features.add(feature);
        uEntry.totalTokens += totalTokens;
        if (row.last_event_at && (!uEntry.lastEventAt || (row.last_event_at as string) > uEntry.lastEventAt)) {
          uEntry.lastEventAt = row.last_event_at as string;
        }
        userActivityMap.set(row.user_id as string, uEntry);
      }
    }

    // ── 4. Feature breakdown ─────────────────────────────────────────────────
    const featureBreakdown: LandingFeatureStat[] = Array.from(featureMap.entries())
      .map(([feature, entry]) => ({
        feature,
        event_count: entry.eventCount,
        unique_users: entry.userIds.size,
        total_tokens: Math.round(entry.totalTokens),
      }))
      .sort((a, b) => b.event_count - a.event_count);

    const totalEvents = featureBreakdown.reduce((s, f) => s + f.event_count, 0);
    const uniqueActiveUsers = new Set(Array.from(userActivityMap.keys())).size;

    // ── 5. Conversion: count new real signups from profiles ───────────────────
    const [signups7dResult, signups30dResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString()),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thirtyDaysAgo.toISOString()),
    ]);

    const newRealSignups7d = signups7dResult.count ?? 0;
    const newRealSignups30d = signups30dResult.count ?? 0;
    const estimatedRate7d = anon7d > 0 ? roundTo((newRealSignups7d / anon7d) * 100, 1) : null;
    const estimatedRate30d = anon30d > 0 ? roundTo((newRealSignups30d / anon30d) * 100, 1) : null;

    // ── 6. Recent sessions ────────────────────────────────────────────────────
    const recentSessions: LandingRecentSession[] = anonUsers
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, RECENT_SESSIONS_LIMIT)
      .map((u) => {
        const activity = userActivityMap.get(u.id);
        return {
          user_id: u.id,
          created_at: u.created_at,
          event_count: activity?.eventCount ?? 0,
          features: activity ? Array.from(activity.features) : [],
          total_tokens: activity ? Math.round(activity.totalTokens) : 0,
          last_event_at: activity?.lastEventAt ?? null,
        };
      });

    const response: LandingPageResponse = {
      generatedAt: now.toISOString(),
      anonymousSessions: { total: anonUsers.length, today: anonToday, last7d: anon7d, last30d: anon30d },
      contentGenerated: { totalEvents, uniqueActiveUsers, featureBreakdown },
      conversion: { newRealSignups7d, newRealSignups30d, estimatedRate7d, estimatedRate30d },
      recentSessions,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load landing page data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
