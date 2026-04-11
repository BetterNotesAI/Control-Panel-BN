"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import type { ProjectDetailResponse } from "@/types/projects";

interface ProjectDetailViewProps {
  projectId: string;
}

const EVENTS_PAGE_SIZE = 20;

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toReadableType(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  return value.replace(/_/g, " ");
}

function readErrorMessage(response: Response, fallback: string): Promise<string> {
  return response
    .json()
    .then((body: { error?: string }) => body.error ?? fallback)
    .catch(() => fallback);
}

function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/35 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {caption ? <p className="mt-1 text-xs text-muted">{caption}</p> : null}
    </div>
  );
}

export function ProjectDetailView({ projectId }: ProjectDetailViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [eventsPage, setEventsPage] = useState(1);
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const detailType = searchParams.get("type") ?? "";
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";

  const fetchProjectDetail = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (detailType) {
        params.set("type", detailType);
      }

      if (startDate) {
        params.set("startDate", startDate);
      }

      if (endDate) {
        params.set("endDate", endDate);
      }

      params.set("page", String(eventsPage));
      params.set("pageSize", String(EVENTS_PAGE_SIZE));

      const response = await fetch(`/api/admin/projects/${projectId}?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load project details."));
      }

      const body = (await response.json()) as ProjectDetailResponse;
      setDetail(body);

      if (body.events.totalPages > 0 && eventsPage > body.events.totalPages) {
        setEventsPage(body.events.totalPages);
      }
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load project details.",
      );
    } finally {
      setLoading(false);
    }
  }, [detailType, endDate, eventsPage, projectId, startDate]);

  useEffect(() => {
    void fetchProjectDetail();
  }, [fetchProjectDetail]);

  const backHref = useMemo(() => {
    const params = new URLSearchParams();

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    if (detailType && detailType !== "document") {
      params.set("projectType", detailType);
    }

    const query = params.toString();
    return query ? `/projects?${query}` : "/projects";
  }, [detailType, endDate, startDate]);

  const seriesMaxTokens = useMemo(
    () => Math.max(...(detail?.series.map((point) => point.total_tokens) ?? [1]), 1),
    [detail],
  );
  const seriesMaxCredits = useMemo(
    () => Math.max(...(detail?.series.map((point) => point.total_credits) ?? [1]), 1),
    [detail],
  );

  if (loading && !detail) {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadingState message="Loading project details..." />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <ErrorState message={error} />
        <Button variant="secondary" size="sm" className="w-fit" onClick={() => router.push(backHref)}>
          Back to projects
        </Button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState message="Project not found." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          Back to projects
        </Button>
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => void fetchProjectDetail()}>
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-gradient-to-r from-info/10 via-surface to-success/10 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">
                {detail.project.title?.trim() || "Untitled project"}
              </h1>
              <p className="mt-1 text-sm text-muted">
                {detail.project.user_email ?? detail.project.user_id ?? "Unknown user"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {detail.project.project_id}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted capitalize">
                {toReadableType(detail.project.project_type)}
              </span>
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
                {detail.project.status ?? "unknown"}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total credits"
            value={formatCredits(detail.summary.totalCredits)}
          />
          <StatCard
            label="Total tokens"
            value={formatNumber(detail.summary.totalTokens)}
          />
          <StatCard
            label="Events"
            value={formatNumber(detail.summary.totalEvents)}
          />
          <StatCard
            label="Created at"
            value={formatDate(detail.project.created_at)}
            caption={`Updated: ${formatDate(detail.project.updated_at)}`}
          />
        </div>
      </Card>

      <Card
        title="Consumption Timeline"
        subtitle="Credits and tokens by day (UTC aggregation, local display)"
        className="space-y-3"
      >
        {detail.series.length === 0 ? (
          <EmptyState message="No usage events in the selected range." />
        ) : (
          <div className="space-y-3">
            {detail.series.map((point) => {
              const tokenWidth = `${(point.total_tokens / seriesMaxTokens) * 100}%`;
              const creditWidth = `${(point.total_credits / seriesMaxCredits) * 100}%`;

              return (
                <div key={point.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>{formatDate(point.date)}</span>
                    <span>
                      tokens: {formatNumber(point.total_tokens)} | credits: {formatCredits(point.total_credits)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded bg-surfaceMuted">
                      <div className="h-full rounded bg-info" style={{ width: tokenWidth }} />
                    </div>
                    <div className="h-2 rounded bg-surfaceMuted">
                      <div className="h-full rounded bg-success" style={{ width: creditWidth }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Breakdown by Feature">
          {detail.breakdownByFeature.length === 0 ? (
            <EmptyState message="No feature data for this project." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">Feature</th>
                    <th className="px-2 py-2">Events</th>
                    <th className="px-2 py-2">Tokens</th>
                    <th className="px-2 py-2">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.breakdownByFeature.map((row) => (
                    <tr key={row.feature ?? "__none__"} className="border-b border-border/70 last:border-none">
                      <td className="px-2 py-3 text-xs text-muted">{row.feature ?? "general"}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(row.event_count)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(row.total_tokens)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatCredits(row.total_credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Breakdown by Model / Provider">
          {detail.breakdownByModel.length === 0 ? (
            <EmptyState message="No model data for this project." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">Provider</th>
                    <th className="px-2 py-2">Model</th>
                    <th className="px-2 py-2">Events</th>
                    <th className="px-2 py-2">Tokens</th>
                    <th className="px-2 py-2">Credits</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.breakdownByModel.map((row) => (
                    <tr key={`${row.provider}:${row.model}`} className="border-b border-border/70 last:border-none">
                      <td className="px-2 py-3 text-xs text-muted">{row.provider}</td>
                      <td className="px-2 py-3 text-xs text-muted">{row.model}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(row.event_count)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(row.total_tokens)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatCredits(row.total_credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card title="AI Usage Events" subtitle="Detailed event trace">
        {detail.events.items.length === 0 ? (
          <EmptyState message="No events found for the selected filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">Created at</th>
                    <th className="px-2 py-2">Feature</th>
                    <th className="px-2 py-2">Provider</th>
                    <th className="px-2 py-2">Model</th>
                    <th className="px-2 py-2">Input tokens</th>
                    <th className="px-2 py-2">Output tokens</th>
                    <th className="px-2 py-2">Total tokens</th>
                    <th className="px-2 py-2">Total credits</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.events.items.map((event) => (
                    <tr key={event.usage_event_id} className="border-b border-border/70 last:border-none">
                      <td className="px-2 py-3 text-xs text-muted">{formatDateTime(event.created_at)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{event.feature ?? "general"}</td>
                      <td className="px-2 py-3 text-xs text-muted">{event.provider}</td>
                      <td className="px-2 py-3 text-xs text-muted">{event.model}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(event.input_tokens)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(event.output_tokens)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatNumber(event.total_tokens)}</td>
                      <td className="px-2 py-3 text-xs text-muted">{formatCredits(event.total_credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={eventsPage}
              totalPages={detail.events.totalPages}
              onPageChange={setEventsPage}
            />
          </>
        )}
      </Card>
    </div>
  );
}
