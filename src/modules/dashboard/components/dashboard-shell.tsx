"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/modules/dashboard/components/kpi-grid";
import { ActivityChart } from "@/modules/dashboard/components/activity-chart";
import { FeedbackFiltersBar } from "@/modules/feedback/components/feedback-filters";
import { FeedbackTable } from "@/modules/feedback/components/feedback-table";
import { FeedbackDetailPanel } from "@/modules/feedback/components/feedback-detail-panel";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import type { ActivityResponse, AdminKpis } from "@/types/admin";
import type {
  FeedbackFilters,
  FeedbackItem,
  FeedbackListResponse,
  FeedbackPatchPayload,
} from "@/types/feedback";

const DEFAULT_FILTERS: FeedbackFilters = {
  status: "all",
  source: "",
  query: "",
  startDate: "",
  endDate: "",
};

const PAGE_SIZE = 20;

function buildFilterParams(filters: FeedbackFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status !== "all") {
    params.set("status", filters.status);
  }

  if (filters.source.trim()) {
    params.set("source", filters.source.trim());
  }

  if (filters.query.trim()) {
    params.set("q", filters.query.trim());
  }

  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }

  return params;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export function DashboardShell({ userEmail }: { userEmail: string }) {
  const [kpis, setKpis] = useState<AdminKpis | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);

  const [range, setRange] = useState<"7d" | "30d">("7d");
  const [activityPoints, setActivityPoints] = useState<ActivityResponse["points"]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);

  const [draftFilters, setDraftFilters] = useState<FeedbackFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FeedbackFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const [feedbackData, setFeedbackData] = useState<FeedbackListResponse | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  const fetchKpis = useCallback(async () => {
    setKpiLoading(true);
    setKpiError(null);

    try {
      const response = await fetch("/api/admin/kpis", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load KPIs."));
      }

      const body = (await response.json()) as AdminKpis;
      setKpis(body);
    } catch (error) {
      setKpiError(error instanceof Error ? error.message : "Failed to load KPIs.");
    } finally {
      setKpiLoading(false);
    }
  }, []);

  const fetchActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);

    try {
      const response = await fetch(`/api/admin/activity?range=${range}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load activity."));
      }

      const body = (await response.json()) as ActivityResponse;
      setActivityPoints(body.points);
    } catch (error) {
      setActivityError(error instanceof Error ? error.message : "Failed to load activity.");
    } finally {
      setActivityLoading(false);
    }
  }, [range]);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const params = buildFilterParams(appliedFilters);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const response = await fetch(`/api/admin/feedback?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load feedback."));
      }

      const body = (await response.json()) as FeedbackListResponse;
      setFeedbackData(body);

      if (body.totalPages > 0 && page > body.totalPages) {
        setPage(body.totalPages);
      }
    } catch (error) {
      setFeedbackError(error instanceof Error ? error.message : "Failed to load feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }, [appliedFilters, page]);

  useEffect(() => {
    void fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    void fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    void fetchFeedback();
  }, [fetchFeedback]);

  const totalPages = feedbackData?.totalPages ?? 0;

  const summary = useMemo(() => {
    const current = feedbackData?.items.length ?? 0;
    const total = feedbackData?.total ?? 0;

    return `${current} visible of ${total}`;
  }, [feedbackData]);

  const handleApplyFilters = () => {
    setPage(1);
    setAppliedFilters(draftFilters);
  };

  const handleResetFilters = () => {
    setPage(1);
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleExportCsv = () => {
    const params = buildFilterParams(appliedFilters);
    const href = `/api/admin/feedback/export?${params.toString()}`;
    window.location.href = href;
  };

  const handleRefresh = async () => {
    await Promise.all([fetchKpis(), fetchActivity(), fetchFeedback()]);
  };

  const handleSaveFeedback = async (id: string, payload: FeedbackPatchPayload) => {
    setIsSavingFeedback(true);

    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to update feedback."));
      }

      const body = (await response.json()) as { item: FeedbackItem };
      setSelectedFeedback(body.item);
      await Promise.all([fetchFeedback(), fetchKpis()]);
    } finally {
      setIsSavingFeedback(false);
    }
  };

  return (
    <main className="min-h-screen bg-panel-grid bg-[size:16px_16px] px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-xl border border-border bg-surface/85 p-4 shadow-soft">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">BetterNotes internal admin</p>
              <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
              <p className="text-sm text-muted">Session: {userEmail}</p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => void handleRefresh()}>
                Refresh
              </Button>
              <LogoutButton />
            </div>
          </div>
        </header>

        <KpiGrid data={kpis} isLoading={kpiLoading} error={kpiError} />

        <ActivityChart
          range={range}
          onRangeChange={setRange}
          points={activityPoints}
          isLoading={activityLoading}
          error={activityError}
        />

        <FeedbackFiltersBar
          value={draftFilters}
          onChange={setDraftFilters}
          onApply={handleApplyFilters}
          onReset={handleResetFilters}
          onExport={handleExportCsv}
          isLoading={feedbackLoading}
        />

        <div className="text-xs text-muted">{summary}</div>

        <FeedbackTable
          items={feedbackData?.items ?? []}
          total={feedbackData?.total ?? 0}
          page={page}
          totalPages={totalPages}
          isLoading={feedbackLoading}
          error={feedbackError}
          onPageChange={setPage}
          onOpenDetails={setSelectedFeedback}
        />
      </div>

      <FeedbackDetailPanel
        item={selectedFeedback}
        isSaving={isSavingFeedback}
        onClose={() => setSelectedFeedback(null)}
        onSave={handleSaveFeedback}
      />
    </main>
  );
}
