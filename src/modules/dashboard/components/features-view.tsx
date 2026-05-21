"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { FeatureUsageItem, FeaturesResponse } from "@/types/features";

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
// Maps raw database feature keys to human-readable labels and optional badges.
// Add new entries here whenever a new feature key appears in the analytics view.

interface FeatureMeta {
  label: string;
  badge?: string; // short tag shown beside the label, e.g. "Free" | "Pro"
  badgeClass?: string; // Tailwind classes for the badge
}

const FEATURE_META: Record<string, FeatureMeta> = {
  latex_converter_free: {
    label: "LaTeX Converter",
    badge: "Free",
    badgeClass: "border-border bg-surfaceMuted/50 text-muted",
  },
  latex_converter_product: {
    label: "LaTeX Converter",
    badge: "Pro",
    badgeClass: "border-info/40 bg-info/15 text-info",
  },
};

function featureMeta(key: string): FeatureMeta {
  if (FEATURE_META[key]) return FEATURE_META[key];
  // Fallback: convert snake_case → Title Case
  const label = key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { label };
}

function UsageBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surfaceMuted">
        <div className="h-full rounded-full bg-info" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">{pct}%</span>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-6 shadow-soft backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </section>
  );
}

export function FeaturesView() {
  const [data, setData] = useState<FeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/features", { cache: "no-store" });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load feature usage.");
      }

      setData((await res.json()) as FeaturesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load feature usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFeatures();
  }, [fetchFeatures]);

  const maxEvents = data?.features[0]?.event_count ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Features</h1>
          <p className="text-sm text-muted">AI usage broken down by product feature</p>
        </div>
        {data ? (
          <p className="text-xs text-muted">Updated {formatDate(data.generatedAt)}</p>
        ) : null}
      </div>

      {loading ? <LoadingState message="Loading feature usage..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              label="Total features"
              value={formatNumber(data.features.length)}
            />
            <SummaryCard
              label="Total AI events"
              value={formatNumber(data.totalEvents)}
            />
            <SummaryCard
              label="Total tokens"
              value={formatNumber(data.totalTokens)}
            />
          </div>

          <Card
            title="Feature usage"
            subtitle={`${data.features.length} features ranked by event count`}
          >
            {data.features.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No feature data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">Feature</th>
                      <th className="px-2 py-2">Events</th>
                      <th className="px-2 py-2">Share</th>
                      <th className="px-2 py-2">Users</th>
                      <th className="px-2 py-2">Tokens</th>
                      <th className="px-2 py-2">First used</th>
                      <th className="px-2 py-2">Last used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.features.map((item: FeatureUsageItem) => (
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
                                  {meta.badge ? (
                                    <span
                                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${meta.badgeClass ?? ""}`}
                                    >
                                      {meta.badge}
                                    </span>
                                  ) : null}
                                </div>
                                {meta.label !== item.feature ? (
                                  <span className="text-xs text-muted/60">{item.feature}</span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-2 py-3 text-sm font-semibold text-foreground">
                          {formatNumber(item.event_count)}
                        </td>
                        <td className="px-2 py-3">
                          <UsageBar value={item.event_count} max={maxEvents} />
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatNumber(item.unique_users)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatNumber(item.total_tokens)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(item.first_used_at)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(item.last_used_at)}
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
