"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FeedbackFiltersBar } from "@/modules/feedback/components/feedback-filters";
import { FeedbackTable } from "@/modules/feedback/components/feedback-table";
import { FeedbackDetailPanel } from "@/modules/feedback/components/feedback-detail-panel";
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

export function FeedbackView() {
  const [draftFilters, setDraftFilters] = useState<FeedbackFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<FeedbackFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);

  const [feedbackData, setFeedbackData] = useState<FeedbackListResponse | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    setFeedbackError(null);

    try {
      const params = buildFilterParams(appliedFilters);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));

      const response = await fetch(`/api/admin/feedback?${params.toString()}`, {
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
      setFeedbackError(
        error instanceof Error ? error.message : "Failed to load feedback.",
      );
    } finally {
      setFeedbackLoading(false);
    }
  }, [appliedFilters, page]);

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
    window.location.href = `/api/admin/feedback/export?${params.toString()}`;
  };

  const handleSaveFeedback = async (id: string, payload: FeedbackPatchPayload) => {
    setIsSavingFeedback(true);

    try {
      const response = await fetch(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Failed to update feedback."),
        );
      }

      const body = (await response.json()) as { item: FeedbackItem };
      setSelectedFeedback(body.item);
      await fetchFeedback();
    } finally {
      setIsSavingFeedback(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Feedback</h1>
        <p className="text-sm text-muted">User feedback and suggestions</p>
      </div>

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

      <FeedbackDetailPanel
        item={selectedFeedback}
        isSaving={isSavingFeedback}
        onClose={() => setSelectedFeedback(null)}
        onSave={handleSaveFeedback}
      />
    </div>
  );
}
