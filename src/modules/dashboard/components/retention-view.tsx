"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { JourneySegment, JourneySegmentKey, JourneyUser, RetentionResponse } from "@/types/retention";

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

function segmentAccentClasses(key: JourneySegmentKey): {
  card: string;
  cardActive: string;
  bar: string;
} {
  switch (key) {
    case "unconfirmed":
      return {
        card: "border-warning/30 hover:border-warning/60",
        cardActive: "border-warning bg-warning/10",
        bar: "bg-warning",
      };
    case "no_content":
      return {
        card: "border-danger/30 hover:border-danger/60",
        cardActive: "border-danger bg-danger/10",
        bar: "bg-danger",
      };
    case "one_day":
      return {
        card: "border-muted/30 hover:border-muted/60",
        cardActive: "border-muted bg-surfaceMuted/60",
        bar: "bg-muted",
      };
    case "retained":
      return {
        card: "border-success/30 hover:border-success/60",
        cardActive: "border-success bg-success/10",
        bar: "bg-success",
      };
    case "premium":
      return {
        card: "border-info/30 hover:border-info/60",
        cardActive: "border-info bg-info/10",
        bar: "bg-info",
      };
  }
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
  const color = pct >= 40 ? "bg-success" : pct >= 20 ? "bg-warning" : "bg-danger";

  return (
    <section className="rounded-xl border border-border bg-surface/80 p-6 shadow-soft backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-widest text-muted">{label}</p>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
      <p className="mt-3 text-4xl font-semibold text-foreground">{pct}%</p>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surfaceMuted">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {formatNumber(returned)} of {formatNumber(cohortSize)} users returned
      </p>
    </section>
  );
}

function JourneyCard({
  segment,
  isActive,
  onClick,
}: {
  segment: JourneySegment;
  isActive: boolean;
  onClick: () => void;
}) {
  const accent = segmentAccentClasses(segment.key);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border bg-surface/80 p-5 text-left shadow-soft backdrop-blur transition-all ${
        isActive ? accent.cardActive : `border-border ${accent.card}`
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-muted">
        {segment.label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{segment.percentage}%</p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surfaceMuted">
        <div
          className={`h-full rounded-full ${accent.bar}`}
          style={{ width: `${segment.percentage}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {formatNumber(segment.count)} user{segment.count !== 1 ? "s" : ""}
      </p>
      <p className="mt-1 text-xs text-muted/70">{segment.description}</p>
    </button>
  );
}

function JourneyUserTable({ segment }: { segment: JourneySegment }) {
  const showActivityCols =
    segment.key === "one_day" || segment.key === "retained";
  const showSignupCol =
    segment.key === "unconfirmed" || segment.key === "no_content";

  return (
    <div className="rounded-xl border border-border bg-surface/80 p-5 shadow-soft">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{segment.label}</h2>
          <p className="text-xs text-muted">{segment.description}</p>
        </div>
        <span className="text-xs text-muted">{formatNumber(segment.users.length)} users</span>
      </div>

      {segment.users.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No users in this segment.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Phone</th>
                <th className="px-2 py-2">Plan</th>
                {showSignupCol ? <th className="px-2 py-2">Signed up</th> : null}
                {showActivityCols ? (
                  <>
                    <th className="px-2 py-2">Projects</th>
                    <th className="px-2 py-2">First active</th>
                    <th className="px-2 py-2">Last active</th>
                  </>
                ) : null}
                {segment.key === "premium" ? (
                  <>
                    <th className="px-2 py-2">Projects</th>
                    <th className="px-2 py-2">Last active</th>
                  </>
                ) : null}
                <th className="px-2 py-2">Days since</th>
              </tr>
            </thead>
            <tbody>
              {segment.users.map((user: JourneyUser) => (
                <tr
                  key={user.user_id}
                  className="border-b border-border/70 last:border-none"
                >
                  <td className="px-2 py-3">
                    <p className="font-medium text-foreground">{user.email ?? "—"}</p>
                    <p className="text-xs text-muted">{user.user_id}</p>
                  </td>
                  <td className="px-2 py-3 text-xs text-muted">
                    {user.phone_number ?? "—"}
                  </td>
                  <td className="px-2 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${planBadgeClasses(user.plan)}`}
                    >
                      {user.plan}
                    </span>
                  </td>
                  {showSignupCol ? (
                    <td className="px-2 py-3 text-xs text-muted">
                      {formatDate(user.signed_up_at)}
                    </td>
                  ) : null}
                  {showActivityCols ? (
                    <>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatNumber(user.total_projects)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDate(user.first_activity_at)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDate(user.last_activity_at)}
                      </td>
                    </>
                  ) : null}
                  {segment.key === "premium" ? (
                    <>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatNumber(user.total_projects)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDate(user.last_activity_at)}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-3 text-xs text-muted">
                    {user.days_since !== null ? `${user.days_since}d` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RetentionView() {
  const [data, setData] = useState<RetentionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSegment, setActiveSegment] = useState<JourneySegmentKey | null>(null);

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

  const selectedSegment =
    data?.journey.find((s) => s.key === activeSegment) ?? null;

  const handleSegmentClick = (key: JourneySegmentKey) => {
    setActiveSegment((prev) => (prev === key ? null : key));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Retention</h1>
          <p className="text-sm text-muted">Customer journey and engagement breakdown</p>
        </div>
        {data ? (
          <p className="text-xs text-muted">
            {formatNumber(data.totalUsers)} total users &middot; updated {formatDate(data.generatedAt)}
          </p>
        ) : null}
      </div>

      {loading ? <LoadingState message="Crunching retention data..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!loading && !error && data ? (
        <>
          {/* Customer journey blocks */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {data.journey.map((segment) => (
              <JourneyCard
                key={segment.key}
                segment={segment}
                isActive={activeSegment === segment.key}
                onClick={() => handleSegmentClick(segment.key)}
              />
            ))}
          </div>

          {/* Expanded user list */}
          {selectedSegment ? (
            <JourneyUserTable segment={selectedSegment} />
          ) : null}

          {/* Retention gauges */}
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

          {/* Most active users */}
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
                          <p className="font-medium text-foreground">{user.email ?? "—"}</p>
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
        </>
      ) : null}
    </div>
  );
}
