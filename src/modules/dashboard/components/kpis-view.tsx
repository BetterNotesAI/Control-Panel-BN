"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/modules/dashboard/components/kpi-grid";
import { ActivityChart } from "@/modules/dashboard/components/activity-chart";
import type { ActivityResponse, AdminKpis } from "@/types/admin";

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function KpisView() {
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

  const handleRefresh = async () => {
    await Promise.all([fetchKpis(), fetchActivity()]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">KPIs</h1>
          <p className="text-sm text-muted">Key performance indicators</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void handleRefresh()}>
          Refresh
        </Button>
      </div>

      <KpiGrid data={kpis} isLoading={kpiLoading} error={kpiError} />

      <ActivityChart
        range={range}
        onRangeChange={setRange}
        points={activityPoints}
        isLoading={activityLoading}
        error={activityError}
      />
    </div>
  );
}
