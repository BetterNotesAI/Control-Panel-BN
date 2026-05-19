"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { RetentionResponse } from "@/types/retention";

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function planBadgeClasses(plan: string): string {
  switch (plan.toLowerCase()) {
    case "best":
      return "border-warning/40 bg-warning/15 text-warning";
    case "better":
    case "pro":
      return "border-info/40 bg-info/15 text-info";
    default:
      return "border-border bg-surfaceMuted/50 text-muted";
  }
}

function daysBadgeClasses(days: number): string {
  if (days >= 30) return "text-danger";
  if (days >= 14) return "text-warning";
  return "text-muted";
}

function RetentionGauge({
  label,
  subtitle,
  rate,
  returned,
  cohortSize,
}: {
  label: string;
  subtitle: string;
  rate: number;
  returned: number;
  cohortSize: number;
}) {
  const pct = Math.min(100, Math.max(0, rate));
  const color =
    pct >= 40 ? "bg-success" : pct >= 20 ? "bg-warning" : "bg-danger";

  return (
    <section className="rounded-xl border border-border bg-surface/80 p-6 shadow-soft backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      <p className="mt-3 text-4xl font-semibold text-foreground">{pct}%</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surfaceMuted">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {formatNumber(returned)} of {formatNumber(cohortSize)} users returned
      </p>
    </section>
  );
}

export function RetentionView() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRetention = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/retention", { cache: "no-store" });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to load retention data.");
      }

      setData((await res.json()) as RetentionResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load retention data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRetention();
  }, [fetchRetention]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Retention</h1>
          <p className="text-sm text-muted">
            Track whether users come back after their first session
          </p>
        </div>
        {data ? (
          <p className="text-xs text-muted">
            {formatNumber(data.totalUsers)} total users &middot; updated{" "}
            {formatDate(data.generatedAt)}
          </p>
        ) : null}
      </div>

      {loading ? <LoadingState message="Crunching retention data..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <RetentionGauge
              label="7-day retention"
              subtitle="Of all lifetime users, % who came back in the last 7 days"
              rate={data.retention7d.retentionRate}
              returned={data.retention7d.returned}
              cohortSize={data.retention7d.cohortSize}
            />
            <RetentionGauge
              label="30-day retention"
              subtitle="Of all lifetime users, % who came back in the last 30 days"
              rate={data.retention30d.retentionRate}
              returned={data.retention30d.returned}
              cohortSize={data.retention30d.cohortSize}
            />
          </div>

          <Card
            title="Most active users"
            subtitle={`Top ${data.topUsers.length} by project count`}
          >
            {data.topUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Projects</th>
                      <th className="px-2 py-2">Tokens</th>
                      <th className="px-2 py-2">First active</th>
                      <th className="px-2 py-2">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topUsers.map((user, index) => (
                      <tr
                        key={user.user_id}
                        className="border-b border-border/70 last:border-none"
                      >
                        <td className="px-2 py-3 text-xs text-muted">{index + 1}</td>
                        <td className="px-2 py-3">
                          <p className="font-medium text-foreground">
                            {user.email ?? "—"}
                          </p>
                          <p className="text-xs text-muted">{user.user_id}</p>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${planBadgeClasses(user.plan)}`}
                          >
                            {user.plan}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-sm font-semibold text-foreground">
                          {formatNumber(user.total_projects)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatNumber(user.total_tokens)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(user.first_activity_at)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(user.last_activity_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="Never activated"
            subtitle={`${formatNumber(data.neverActiveUsers.length)} users who signed up but never created anything`}
          >
            {data.neverActiveUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No users in this group.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Signed up</th>
                      <th className="px-2 py-2">Days since signup</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.neverActiveUsers.map((user) => (
                      <tr
                        key={user.user_id}
                        className="border-b border-border/70 last:border-none"
                      >
                        <td className="px-2 py-3">
                          <p className="font-medium text-foreground">
                            {user.email ?? "—"}
                          </p>
                          <p className="text-xs text-muted">{user.user_id}</p>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${planBadgeClasses(user.plan)}`}
                          >
                            {user.plan}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(user.signed_up_at)}
                        </td>
                        <td className="px-2 py-3">
                          <span className={`text-sm font-semibold ${daysBadgeClasses(user.days_since_signup)}`}>
                            {user.days_since_signup}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            title="One-time users"
            subtitle={`${formatNumber(data.churnedUsers.length)} users who created content but haven't returned in 7+ days`}
          >
            {data.churnedUsers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">No users in this group.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <th className="px-2 py-2">User</th>
                      <th className="px-2 py-2">Plan</th>
                      <th className="px-2 py-2">Projects</th>
                      <th className="px-2 py-2">Last active</th>
                      <th className="px-2 py-2">Days since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.churnedUsers.map((user) => (
                      <tr
                        key={user.user_id}
                        className="border-b border-border/70 last:border-none"
                      >
                        <td className="px-2 py-3">
                          <p className="font-medium text-foreground">
                            {user.email ?? "—"}
                          </p>
                          <p className="text-xs text-muted">{user.user_id}</p>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${planBadgeClasses(user.plan)}`}
                          >
                            {user.plan}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatNumber(user.total_projects)}
                        </td>
                        <td className="px-2 py-3 text-xs text-muted">
                          {formatDate(user.last_activity_at)}
                        </td>
                        <td className="px-2 py-3">
                          <span className={`text-sm font-semibold ${daysBadgeClasses(user.days_since)}`}>
                            {user.days_since}d
                          </span>
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
