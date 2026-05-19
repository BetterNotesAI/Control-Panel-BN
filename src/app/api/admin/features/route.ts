import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { FeatureUsageItem, FeaturesResponse } from "@/types/features";

const FETCH_PAGE_SIZE = 1000;
const UNKNOWN_FEATURE = "(unknown)";

interface FeatureAccumulator {
  userIds: Set<string>;
  eventCount: number;
  totalTokens: number;
  totalCredits: number;
  firstUsedAt: string | null;
  lastUsedAt: string | null;
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const featureMap = new Map<string, FeatureAccumulator>();
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from("analytics_ai_usage_by_user_feature_model_v")
        .select(
          "user_id,feature,event_count,total_tokens,total_credits,first_event_at,last_event_at",
        )
        .order("feature", { ascending: true })
        .range(from, from + FETCH_PAGE_SIZE - 1);

      if (error) {
        throw error;
      }

      const rows = data ?? [];

      if (rows.length === 0) {
        break;
      }

      for (const row of rows) {
        const key =
          typeof row.feature === "string" && row.feature.trim()
            ? row.feature.trim()
            : UNKNOWN_FEATURE;

        const existing = featureMap.get(key) ?? {
          userIds: new Set<string>(),
          eventCount: 0,
          totalTokens: 0,
          totalCredits: 0,
          firstUsedAt: null,
          lastUsedAt: null,
        };

        existing.userIds.add(row.user_id);
        existing.eventCount += toNumber(row.event_count);
        existing.totalTokens += toNumber(row.total_tokens);
        existing.totalCredits += toNumber(row.total_credits);

        if (
          row.first_event_at &&
          (!existing.firstUsedAt || row.first_event_at < existing.firstUsedAt)
        ) {
          existing.firstUsedAt = row.first_event_at;
        }

        if (
          row.last_event_at &&
          (!existing.lastUsedAt || row.last_event_at > existing.lastUsedAt)
        ) {
          existing.lastUsedAt = row.last_event_at;
        }

        featureMap.set(key, existing);
      }

      if (rows.length < FETCH_PAGE_SIZE) {
        break;
      }

      from += FETCH_PAGE_SIZE;
    }

    const features: FeatureUsageItem[] = Array.from(featureMap.entries())
      .map(([feature, acc]) => ({
        feature,
        event_count: acc.eventCount,
        unique_users: acc.userIds.size,
        total_tokens: Math.round(acc.totalTokens),
        total_credits: roundTo(acc.totalCredits, 4),
        first_used_at: acc.firstUsedAt,
        last_used_at: acc.lastUsedAt,
      }))
      .sort((a, b) => b.event_count - a.event_count);

    const totalEvents = features.reduce((sum, f) => sum + f.event_count, 0);
    const totalTokens = features.reduce((sum, f) => sum + f.total_tokens, 0);

    const response: FeaturesResponse = {
      generatedAt: new Date().toISOString(),
      totalEvents,
      totalTokens,
      features,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load feature usage.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
