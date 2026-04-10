import { NextResponse } from "next/server";
import {
  getPlanCreditLimit,
  readNumber,
  readString,
  resolveEffectivePlan,
  roundTo,
} from "@/lib/admin/users";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { UserDetailResponse, UserUsageEventItem } from "@/types/users";

function getMonthRange(date = new Date()): { startIso: string; endIso: string } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { data: activeSubscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan,status,billing_interval,current_period_end,updated_at,created_at")
      .eq("user_id", id)
      .in("status", ["active", "trialing", "past_due"])
      .order("current_period_end", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      throw subscriptionError;
    }

    let authMetadata: {
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
      username: string | null;
      last_sign_in_at: string | null;
    } | null = null;

    try {
      const { data, error } = await supabase.auth.admin.getUserById(id);

      if (!error && data.user) {
        authMetadata = {
          email: data.user.email ?? null,
          full_name: readString(data.user.user_metadata?.full_name),
          avatar_url: readString(data.user.user_metadata?.avatar_url),
          username: readString(data.user.user_metadata?.user_name),
          last_sign_in_at: data.user.last_sign_in_at ?? null,
        };
      }
    } catch {
      // Auth enrichment is optional for this endpoint.
    }

    const { startIso, endIso } = getMonthRange();

    const { data: monthUsageRows, error: monthUsageError } = await supabase
      .from("ai_usage_events")
      .select("total_cost_usd")
      .eq("user_id", id)
      .gte("created_at", startIso)
      .lt("created_at", endIso);

    if (monthUsageError) {
      throw monthUsageError;
    }

    const { data: recentUsageRows, error: recentUsageError } = await supabase
      .from("ai_usage_events")
      .select(
        "id,provider,model,feature,input_tokens,cached_input_tokens,output_tokens,total_cost_usd,created_at",
      )
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (recentUsageError) {
      throw recentUsageError;
    }

    const periodUsdUsed = roundTo(
      (monthUsageRows ?? []).reduce((sum, row) => sum + readNumber(row.total_cost_usd), 0),
      8,
    );

    const profileRecord = profile as Record<string, unknown>;
    const subscriptionRecord = (activeSubscription ?? null) as Record<string, unknown> | null;

    const plan = resolveEffectivePlan({
      subscriptionPlan: readString(subscriptionRecord?.plan),
      profilePlan: readString(profileRecord.plan),
    });

    const creditsLimit = getPlanCreditLimit(plan);
    const usdLimit = roundTo(creditsLimit * 0.01, 8);
    const usdRemaining = roundTo(Math.max(usdLimit - periodUsdUsed, 0), 8);
    const creditsUsed = roundTo(periodUsdUsed / 0.01, 4);
    const creditsRemaining = roundTo(usdRemaining / 0.01, 4);

    const recentUsageEvents: UserUsageEventItem[] = (recentUsageRows ?? []).map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      feature: row.feature,
      input_tokens: row.input_tokens,
      cached_input_tokens: row.cached_input_tokens,
      output_tokens: row.output_tokens,
      total_tokens: row.input_tokens + row.cached_input_tokens + row.output_tokens,
      total_cost_usd: roundTo(readNumber(row.total_cost_usd), 8),
      created_at: row.created_at,
    }));

    const response: UserDetailResponse = {
      user: {
        id: profile.id,
        email: profile.email ?? authMetadata?.email ?? null,
        display_name:
          readString(profileRecord.display_name) ??
          readString(profileRecord.full_name) ??
          authMetadata?.full_name ??
          null,
        username: readString(profileRecord.username) ?? authMetadata?.username ?? null,
        avatar_url: readString(profileRecord.avatar_url) ?? authMetadata?.avatar_url ?? null,
        short_bio: readString(profileRecord.short_bio),
        university: readString(profileRecord.university),
        degree: readString(profileRecord.degree),
        profile_visibility: readString(profileRecord.profile_visibility),
        language: readString(profileRecord.language),
        plan,
        subscription_status: readString(subscriptionRecord?.status),
        billing_interval: readString(subscriptionRecord?.billing_interval),
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        last_sign_in_at: authMetadata?.last_sign_in_at ?? null,
        usage: {
          credits_used: creditsUsed,
          credits_limit: creditsLimit,
          credits_remaining: creditsRemaining,
          usd_used: roundTo(periodUsdUsed, 6),
          usd_limit: roundTo(usdLimit, 6),
          usd_remaining: roundTo(usdRemaining, 6),
          period_start: startIso,
          period_end: endIso,
        },
        recent_usage_events: recentUsageEvents,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load user details.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
