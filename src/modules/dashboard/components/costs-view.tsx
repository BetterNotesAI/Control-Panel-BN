"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { CostsIncomeResponse, FeatureCost } from "@/types/costs";

// ── Formatters ────────────────────────────────────────────────────────────────

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatUsdRounded(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Feature display names ─────────────────────────────────────────────────────

interface FeatureMeta {
  label: string;
  badge?: string;
  badgeClass?: string;
  showKey?: boolean;
}

const FEATURE_META: Record<string, FeatureMeta> = {
  latex_converter_free: {
    label: "LaTeX Converter",
    badge: "Landing page",
    badgeClass: "border-border bg-surfaceMuted/50 text-muted",
    showKey: true,
  },
  latex_converter_product: {
    label: "LaTeX Converter",
    badge: "In-app",
    badgeClass: "border-info/40 bg-info/15 text-info",
    showKey: true,
  },
  latex_converter: {
    label: "LaTeX Converter",
    showKey: false,
  },
};

function prettify(raw: string): string {
  const base = raw.includes(":") ? raw.split(":")[0] : raw;
  return base
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function featureMeta(key: string): FeatureMeta {
  if (FEATURE_META[key]) return FEATURE_META[key];
  return { label: prettify(key), showKey: false };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CostBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surfaceMuted">
        <div className="h-full rounded-full bg-danger/70" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">{pct}%</span>
    </div>
  );
}

interface PnLCardProps {
  label: string;
  revenue: number;
  cost: number;
  margin: number;
}

function PnLCard({ label, revenue, cost, margin }: PnLCardProps) {
  const isProfit = margin >= 0;
  return (
    <div className="rounded-xl border border-border bg-surface/80 p-5 shadow-soft">
      <p className="mb-4 text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">Revenue</span>
          <span className="text-sm font-semibold text-success">{formatUsdRounded(revenue)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted">AI cost</span>
          <span className="text-sm font-semibold text-danger">{formatUsdRounded(cost)}</span>
        </div>
        <div className="border-t border-border/60 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Net margin</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${isProfit ? "text-success" : "text-danger"}`}>
                {formatUsdRounded(margin)}
              </span>
              <span
                className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                  isProfit
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-danger/30 bg-danger/10 text-danger"
                }`}
              >
                {isProfit ? "Profit" : "Loss"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CostsView() {
  const [data, setData] = useState<CostsIncomeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/costs", { cache: "no-store" });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load costs data.");
      }

      setData((await res.json()) as CostsIncomeResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load costs data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const maxFeatureCost = data?.costs.byFeature[0]?.cost_usd ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Costs &amp; Income</h1>
          <p className="text-sm text-muted">AI spend vs subscription revenue</p>
        </div>
        {data ? (
          <p className="text-xs text-muted">Updated {formatDate(data.generatedAt)}</p>
        ) : null}
      </div>

      {loading ? <LoadingState message="Loading costs & income data..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <>
          {/* Stripe not configured notice */}
          {!data.stripeAvailable ? (
            <div className="rounded-xl border border-warning/40 bg-warning/10 px-5 py-4 text-sm text-warning">
              <span className="font-medium">Stripe not connected</span>
              <span className="ml-2 text-warning/80">— add <code className="font-mono">STRIPE_SECRET_KEY</code> to Vercel environment variables to see revenue and MRR.</span>
            </div>
          ) : null}

          {/* MRR & Subscriptions banner */}
          {data.stripeAvailable ? (
            <div className="rounded-xl border border-border bg-surface/80 p-6">
              <div className="flex flex-wrap gap-10">
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted">
                    Estimated MRR
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {formatUsdRounded(data.revenue.mrrCents / 100)}
                    <span className="ml-1 text-base font-normal text-muted">/ mo</span>
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-widest text-muted">
                    Active Subscriptions
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">
                    {formatNumber(data.revenue.activeSubscriptions)}
                    <span className="ml-1 text-base font-normal text-muted">subscribers</span>
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* P&L grid */}
          <div className="grid gap-4 md:grid-cols-3">
            <PnLCard
              label="This month"
              revenue={data.revenue.thisMonth.gross_usd}
              cost={data.costs.thisMonth.cost_usd}
              margin={data.margin.thisMonth}
            />
            <PnLCard
              label="Last 7 days"
              revenue={data.revenue.last7d.gross_usd}
              cost={data.costs.last7d.cost_usd}
              margin={data.margin.last7d}
            />
            <PnLCard
              label="Last 30 days"
              revenue={data.revenue.last30d.gross_usd}
              cost={data.costs.last30d.cost_usd}
              margin={data.margin.last30d}
            />
          </div>

          {/* Cost split section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-info/30 bg-surface/80 p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Registered users (all-time)
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatUsd(data.costs.registered.cost_usd)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatNumber(data.costs.registered.event_count)} AI events
              </p>
            </div>
            <div className="rounded-xl border border-warning/30 bg-surface/80 p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted">
                Anonymous / Landing page (all-time)
              </p>
              <p className="mt-2 text-2xl font-semibold text-foreground">
                {formatUsd(data.costs.anonymous.cost_usd)}
              </p>
              <p className="mt-1 text-sm text-muted">
                {formatNumber(data.costs.anonymous.event_count)} AI events
              </p>
            </div>
          </div>

          {/* Feature cost breakdown table */}
          <Card
            title="AI cost by feature (all-time)"
            subtitle={`${data.costs.byFeature.length} features ranked by cost`}
          >
            {data.costs.byFeature.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No feature cost data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">Feature</th>
                      <th className="px-2 py-2">Cost (USD)</th>
                      <th className="px-2 py-2">Events</th>
                      <th className="px-2 py-2">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.costs.byFeature.map((item: FeatureCost) => (
                      <tr
                        key={item.feature}
                        className="border-b border-border/70 last:border-none"
                      >
                        <td className="px-2 py-3">
                          {(() => {
                            const meta = featureMeta(item.feature);
                            return (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{meta.label}</span>
                                  {item.is_anonymous ? (
                                    <span className="inline-flex rounded-full border border-border bg-surfaceMuted/50 px-2 py-0.5 text-xs font-medium text-muted">
                                      Landing page
                                    </span>
                                  ) : meta.badge ? (
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badgeClass ?? ""}`}
                                    >
                                      {meta.badge}
                                    </span>
                                  ) : null}
                                </div>
                                <span className="text-xs text-muted/60">{item.feature}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-3 text-sm font-semibold text-foreground">
                          {formatUsd(item.cost_usd)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatNumber(item.event_count)}
                        </td>
                        <td className="px-2 py-3">
                          <CostBar value={item.cost_usd} max={maxFeatureCost} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
