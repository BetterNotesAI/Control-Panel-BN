"use client";

import { useCallback, useEffect, useState } from "react";
import { ActivityChart } from "@/modules/dashboard/components/activity-chart";
import { SupabaseUsageSection } from "@/modules/dashboard/components/supabase-usage-section";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { ActivityResponse, AdminKpis } from "@/types/admin";

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: number;
  subtitle?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-6 shadow-soft backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-foreground">
        {formatNumber(value)}
      </p>
      {subtitle ? (
        <p className="mt-1 text-xs text-success">{subtitle}</p>
      ) : null}
    </section>
  );
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function OverviewView() {
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [activityPoints, setActivityPoints] = useState<ActivityResponse["points"]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);
    try {
      const res = await fetch("/api/admin/kpis", { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Failed to load KPIs."));
      setKpis((await res.json()) as AdminKpis);
    } catch (e) {
      setKpiError(e instanceof Error ? e.message : "Failed to load KPIs.");
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = await fetch(`/api/admin/activity?range=${range}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await readError(res, "Failed to load activity."));
      const body = (await res.json()) as ActivityResponse;
      setActivityPoints(body.points);
    } catch (e) {
      setActivityError(e instanceof Error ? e.message : "Failed to load activity.");
    } finally {
      setActivityLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Overview</h1>
        <p className="text-sm text-muted">General platform statistics</p>
      </div>

      {kpiLoading ? <LoadingState message="Loading statistics..." /> : null}
      {kpiError ? <ErrorState message={kpiError} /> : null}

      {!kpiLoading && !kpiError && kpis ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total users"
            value={kpis.totalUsers}
            subtitle={kpis.usersLast7Days > 0 ? `+${kpis.usersLast7Days} this week` : undefined}
          />
          <StatCard label="Total documents" value={kpis.totalDocuments} />
          <StatCard
            label="Problem solver sessions"
            value={kpis.totalProblemSolverSessions}
          />
          <StatCard
            label="Feedback"
            value={kpis.feedbackTotal}
            subtitle={kpis.feedbackNew > 0 ? `${kpis.feedbackNew} new` : undefined}
          />
        </div>
      ) : null}

      <ActivityChart
        range={range}
        onRangeChange={setRange}
        points={activityPoints}
        isLoading={activityLoading}
        error={activityError}
      />

      <SupabaseUsageSection />
    </div>
  );
}
