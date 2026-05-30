import { NextResponse } from "next/server";
import { toNumber, roundTo } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { getStripeClient } from "@/lib/stripe";
import type { CostPeriod, CostsIncomeResponse, FeatureCost, RevenuePeriod } from "@/types/costs";

const PAGE_SIZE = 1000;

/** Sum total_cost_usd from ai_usage_events within an optional date range. */
async function fetchCostForPeriod(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  gte?: string,
  lt?: string,
): Promise<CostPeriod> {
  let from = 0;
  let totalCost = 0;
  let eventCount = 0;

  while (true) {
    let q = supabase
      .from("ai_usage_events")
      .select("total_cost_usd")
      .range(from, from + PAGE_SIZE - 1);

    if (gte) q = q.gte("created_at", gte);
    if (lt) q = q.lt("created_at", lt);

    const { data, error } = await q;
    if (error) throw error;

    const rows = data ?? [];
    for (const row of rows) {
      totalCost += toNumber(row.total_cost_usd);
      eventCount++;
    }

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return { cost_usd: roundTo(totalCost, 6), event_count: eventCount };
}

/** Fetch Stripe charges for a time window (unix timestamps). */
async function fetchStripeRevenue(
  stripe: ReturnType<typeof getStripeClient>,
  gteUnix: number,
  ltUnix: number,
): Promise<RevenuePeriod> {
  let grossCents = 0;
  let chargeCount = 0;
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const charges = await stripe.charges.list({
      created: { gte: gteUnix, lt: ltUnix },
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const charge of charges.data) {
      if (charge.paid && !charge.refunded && charge.status === "succeeded") {
        grossCents += charge.amount;
        chargeCount++;
      }
    }

    hasMore = charges.has_more;
    if (charges.data.length > 0) {
      startingAfter = charges.data[charges.data.length - 1].id;
    } else {
      break;
    }
  }

  return { gross_usd: roundTo(grossCents / 100, 2), charge_count: chargeCount };
}

export async function GET() {
  const authResult = await requireAdminForApi();
  if ("error" in authResult) return authResult.error;

  try {
    const supabase = getSupabaseAdminClient();
    const stripe = getStripeClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const sevenDaysAgoIso = sevenDaysAgo.toISOString();
    const thirtyDaysAgoIso = thirtyDaysAgo.toISOString();
    const thisMonthStartIso = thisMonthStart.toISOString();

    const sevenDaysAgoUnix = Math.floor(sevenDaysAgo.getTime() / 1000);
    const thirtyDaysAgoUnix = Math.floor(thirtyDaysAgo.getTime() / 1000);
    const thisMonthStartUnix = Math.floor(thisMonthStart.getTime() / 1000);
    const nowUnix = Math.floor(now.getTime() / 1000);

    // ── Collect anonymous user IDs ─────────────────────────────────────────
    const anonIds: string[] = [];
    let authPage = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: authPage, perPage: 1000 });
      if (error || !data?.users?.length) break;
      for (const u of data.users) {
        if (u.is_anonymous) anonIds.push(u.id);
      }
      if (data.users.length < 1000) break;
      authPage++;
    }

    // ── Fetch all costs in parallel ────────────────────────────────────────
    const [
      costAllTime,
      costLast7d,
      costLast30d,
      costThisMonth,
      rev7d,
      rev30d,
      revThisMonth,
    ] = await Promise.all([
      fetchCostForPeriod(supabase),
      fetchCostForPeriod(supabase, sevenDaysAgoIso),
      fetchCostForPeriod(supabase, thirtyDaysAgoIso),
      fetchCostForPeriod(supabase, thisMonthStartIso),
      fetchStripeRevenue(stripe, sevenDaysAgoUnix, nowUnix),
      fetchStripeRevenue(stripe, thirtyDaysAgoUnix, nowUnix),
      fetchStripeRevenue(stripe, thisMonthStartUnix, nowUnix),
    ]);

    // ── Anonymous vs registered cost split ────────────────────────────────
    let anonCostTotal = 0;
    let anonEventCount = 0;

    if (anonIds.length > 0) {
      const BATCH = 500;
      for (let i = 0; i < anonIds.length; i += BATCH) {
        const batch = anonIds.slice(i, i + BATCH);
        const { data } = await supabase
          .from("analytics_ai_usage_by_user_feature_model_v")
          .select("total_cost_usd,event_count")
          .in("user_id", batch);
        for (const row of data ?? []) {
          anonCostTotal += toNumber(row.total_cost_usd);
          anonEventCount += toNumber(row.event_count);
        }
      }
    }

    const costAnonymous: CostPeriod = {
      cost_usd: roundTo(anonCostTotal, 6),
      event_count: anonEventCount,
    };
    const costRegistered: CostPeriod = {
      cost_usd: roundTo(costAllTime.cost_usd - anonCostTotal, 6),
      event_count: costAllTime.event_count - anonEventCount,
    };

    // ── Feature cost breakdown ─────────────────────────────────────────────
    const featureMap = new Map<string, { cost: number; events: number }>();
    let fFrom = 0;
    while (true) {
      const { data, error } = await supabase
        .from("analytics_ai_usage_by_user_feature_model_v")
        .select("feature,total_cost_usd,event_count")
        .range(fFrom, fFrom + PAGE_SIZE - 1);
      if (error) throw error;
      const rows = data ?? [];
      for (const row of rows) {
        const key = typeof row.feature === "string" && row.feature.trim() ? row.feature.trim() : "(unknown)";
        const entry = featureMap.get(key) ?? { cost: 0, events: 0 };
        entry.cost += toNumber(row.total_cost_usd);
        entry.events += toNumber(row.event_count);
        featureMap.set(key, entry);
      }
      if (rows.length < PAGE_SIZE) break;
      fFrom += PAGE_SIZE;
    }

    const ANON_FEATURES = new Set(["latex_converter_free"]);
    const byFeature: FeatureCost[] = Array.from(featureMap.entries())
      .map(([feature, entry]) => ({
        feature,
        cost_usd: roundTo(entry.cost, 6),
        event_count: entry.events,
        is_anonymous: ANON_FEATURES.has(feature),
      }))
      .sort((a, b) => b.cost_usd - a.cost_usd);

    // ── Stripe MRR ────────────────────────────────────────────────────────
    let mrrCents = 0;
    let activeSubs = 0;
    let subHasMore = true;
    let subStartingAfter: string | undefined;

    while (subHasMore) {
      const subs = await stripe.subscriptions.list({
        status: "active",
        limit: 100,
        expand: ["data.items.data.price"],
        ...(subStartingAfter ? { starting_after: subStartingAfter } : {}),
      });

      for (const sub of subs.data) {
        activeSubs++;
        for (const item of sub.items.data) {
          const price = item.price;
          if (!price?.unit_amount) continue;
          const interval = price.recurring?.interval ?? "month";
          const intervalCount = price.recurring?.interval_count ?? 1;
          if (interval === "year") {
            mrrCents += Math.round(price.unit_amount / 12 / intervalCount);
          } else if (interval === "month") {
            mrrCents += Math.round(price.unit_amount / intervalCount);
          } else {
            mrrCents += price.unit_amount;
          }
        }
      }

      subHasMore = subs.has_more;
      if (subs.data.length > 0) subStartingAfter = subs.data[subs.data.length - 1].id;
      else break;
    }

    const response: CostsIncomeResponse = {
      generatedAt: now.toISOString(),
      costs: {
        allTime: costAllTime,
        last7d: costLast7d,
        last30d: costLast30d,
        thisMonth: costThisMonth,
        byFeature,
        anonymous: costAnonymous,
        registered: costRegistered,
      },
      revenue: {
        last7d: rev7d,
        last30d: rev30d,
        thisMonth: revThisMonth,
        mrrCents,
        activeSubscriptions: activeSubs,
      },
      margin: {
        last7d: roundTo(rev7d.gross_usd - costLast7d.cost_usd, 2),
        last30d: roundTo(rev30d.gross_usd - costLast30d.cost_usd, 2),
        thisMonth: roundTo(revThisMonth.gross_usd - costThisMonth.cost_usd, 2),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load costs data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
