"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { LandingFeatureStat, LandingPageResponse, LandingRecentSession } from "@/types/landing";

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
      <p className="mt-2 text-4xl font-semibold text-foreground">{value}</p>
    </section>
  );
}

function ConversionCard({
  label,
  signups,
  anonSessions,
}: {
  label: string;
  signups: number;
  anonSessions: number;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-6 shadow-soft backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted">Anon sessions</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{formatNumber(anonSessions)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">New signups</p>
          <p className="mt-1 text-3xl font-semibold text-foreground">{formatNumber(signups)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted/60">
        Signups include all new accounts, not only those from anonymous sessions.
      </p>
    </section>
  );
}

export function LandingView() {
  const [data, setData] = useState<LandingPageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/landing", { cache: "no-store" });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load landing page data.");
      }

      setData((await res.json()) as LandingPageResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load landing page data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const maxEvents = data?.contentGenerated.featureBreakdown[0]?.event_count ?? 1;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Landing Page &amp; Conversion</h1>
          <p className="text-sm text-muted">Anonymous session analytics and signup funnel</p>
        </div>
        {data ? (
          <p className="text-xs text-muted">Updated {formatDate(data.generatedAt)}</p>
        ) : null}
      </div>

      {loading ? <LoadingState message="Loading landing page analytics..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <>
          {/* Summary stat cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Anon sessions (all-time)"
              value={formatNumber(data.anonymousSessions.total)}
            />
            <SummaryCard
              label="Sessions this week"
              value={formatNumber(data.anonymousSessions.last7d)}
            />
            <SummaryCard
              label="Sessions this month"
              value={formatNumber(data.anonymousSessions.last30d)}
            />
            <SummaryCard
              label="Today"
              value={formatNumber(data.anonymousSessions.today)}
            />
          </div>

          {/* Conversion section */}
          <div className="grid gap-4 md:grid-cols-2">
            <ConversionCard
              label="Last 7 days"
              signups={data.conversion.newRealSignups7d}
              anonSessions={data.anonymousSessions.last7d}
            />
            <ConversionCard
              label="Last 30 days"
              signups={data.conversion.newRealSignups30d}
              anonSessions={data.anonymousSessions.last30d}
            />
          </div>

          {/* Feature usage table */}
          <Card
            title="Feature usage by anonymous users"
            subtitle={`${data.contentGenerated.featureBreakdown.length} feature${data.contentGenerated.featureBreakdown.length !== 1 ? "s" : ""} · ${formatNumber(data.contentGenerated.totalEvents)} total events · ${formatNumber(data.contentGenerated.uniqueActiveUsers)} active users`}
          >
            {data.contentGenerated.featureBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No feature usage data yet.</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {data.contentGenerated.featureBreakdown.map((item: LandingFeatureStat) => {
                      const meta = featureMeta(item.feature);
                      return (
                        <tr
                          key={item.feature}
                          className="border-b border-border/70 last:border-none"
                        >
                          <td className="px-2 py-3">
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
                              <span className="text-xs text-muted/60">{item.feature}</span>
                            </div>
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Recent sessions table */}
          <Card
            title="Recent anonymous sessions"
            subtitle="Last 50 sessions"
          >
            {data.recentSessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">Session ID</th>
                      <th className="px-2 py-2">Features</th>
                      <th className="px-2 py-2">Events</th>
                      <th className="px-2 py-2">Tokens</th>
                      <th className="px-2 py-2">Started</th>
                      <th className="px-2 py-2">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentSessions.map((session: LandingRecentSession) => (
                      <tr
                        key={session.user_id}
                        className="border-b border-border/70 last:border-none"
                      >
                        <td className="px-2 py-3">
                          <span className="font-mono text-xs text-muted/70">
                            {session.user_id.slice(0, 8)}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {session.features.length > 0
                            ? session.features.map((f) => featureMeta(f).label).join(", ")
                            : <span className="text-muted/50">—</span>}
                        </td>
                        <td className="px-2 py-3 text-xs">
                          {session.event_count > 0 ? (
                            <span className="text-foreground">{formatNumber(session.event_count)}</span>
                          ) : (
                            <span className="text-muted/50">—</span>
                          )}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {session.total_tokens > 0 ? formatNumber(session.total_tokens) : <span className="text-muted/50">—</span>}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(session.created_at)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(session.last_event_at)}
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
