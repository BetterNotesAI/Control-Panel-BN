"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { SupabaseQuotaMetric, SupabaseUsageResponse } from "@/types/admin";

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const base = 1024;
  const index = Math.min(Math.floor(Math.log(value) / Math.log(base)), units.length - 1);
  const normalized = value / base ** index;
  const decimals = index === 0 ? 0 : normalized >= 100 ? 0 : 2;

  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(normalized)} ${units[index]}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getQuotaBarTone(usagePercent: number): string {
  if (usagePercent >= 90) {
    return "bg-danger";
  }

  if (usagePercent >= 70) {
    return "bg-warning";
  }

  return "bg-success";
}

function QuotaProgress({
  metric,
  metricLabel,
}: {
  metric: SupabaseQuotaMetric;
  metricLabel: string;
}) {
  if (metric.limitBytes === null) {
    return (
      <p className="mt-2 text-xs text-muted">
        {metricLabel} limit not configured (`SUPABASE_*_LIMIT_BYTES`).
      </p>
    );
  }

  if (metric.usedBytes === null || metric.usagePercent === null) {
    return (
      <p className="mt-2 text-xs text-muted">
        {metricLabel} usage is not available yet.
      </p>
    );
  }

  const clampedPercent = Math.max(0, Math.min(100, metric.usagePercent));
  const toneClass = getQuotaBarTone(metric.usagePercent);

  return (
    <div className="mt-3 space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-surfaceMuted/80">
        <div
          className={`h-full rounded-full ${toneClass}`}
          style={{ width: `${clampedPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        {formatPercentage(metric.usagePercent)}% used
        {metric.remainingBytes !== null ? ` • ${formatBytes(metric.remainingBytes)} left` : ""}
      </p>
    </div>
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

export function SupabaseUsageSection() {
  const [usage, setUsage] = useState<SupabaseUsageResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/supabase-usage", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(await readError(res, "Failed to load Supabase usage."));
      }

      setUsage((await res.json()) as SupabaseUsageResponse);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load Supabase usage.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsage();
  }, [fetchUsage]);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Supabase capacity</h2>
          <p className="text-sm text-muted">
            Storage and database usage against configured plan limits.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void fetchUsage()}>
          Refresh
        </Button>
      </div>

      {isLoading ? <LoadingState message="Loading Supabase usage..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && usage ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="p-4" title="Plan">
              <p className="text-2xl font-semibold text-foreground">{usage.plan.name}</p>
              <p className="mt-1 text-xs text-muted">
                Source: {usage.plan.source === "env" ? "environment" : "not configured"}
              </p>
              <p className="mt-3 text-xs text-muted">Updated: {formatDateTime(usage.generatedAt)}</p>
            </Card>

            <Card className="p-4" title="Storage (all buckets)">
              <p className="text-2xl font-semibold text-foreground">
                {formatBytes(usage.storage.totalUsedBytes)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(usage.storage.totalObjects)} files in{" "}
                {formatNumber(usage.storage.totalBuckets)} buckets
              </p>
              <QuotaProgress metric={usage.quotas.storage} metricLabel="Storage" />
            </Card>

            <Card className="p-4" title="Documents storage">
              <p className="text-2xl font-semibold text-foreground">
                {formatBytes(usage.storage.documentsUsedBytes)}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(usage.storage.documentsObjectCount)} files
              </p>
              <p className="mt-2 text-xs text-muted">
                Buckets:{" "}
                {usage.storage.documentBucketIds.length > 0
                  ? usage.storage.documentBucketIds.join(", ")
                  : "all buckets (fallback)"}
              </p>
            </Card>

            <Card className="p-4" title="Database">
              <p className="text-2xl font-semibold text-foreground">
                {usage.quotas.database.usedBytes !== null
                  ? formatBytes(usage.quotas.database.usedBytes)
                  : "N/A"}
              </p>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(usage.records.total)} records across core tables
              </p>
              <QuotaProgress metric={usage.quotas.database} metricLabel="Database" />
            </Card>
          </div>

          <Card
            className="p-4"
            title="Top storage buckets"
            subtitle="Sorted by used bytes (within scanned objects)"
          >
            {usage.storage.topBuckets.length === 0 ? (
              <p className="text-sm text-muted">No bucket usage available.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {usage.storage.topBuckets.map((bucket) => (
                  <div
                    key={bucket.bucketId}
                    className="rounded-lg border border-border bg-surfaceMuted/40 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{bucket.bucketName}</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatBytes(bucket.usedBytes)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatNumber(bucket.objectCount)} files •{" "}
                      {formatPercentage(bucket.usedSharePercent)}% of scanned storage
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4" title="Reference stats">
            <div className="grid gap-2 text-sm text-muted md:grid-cols-2">
              <p>Profiles: {formatNumber(usage.records.profiles)}</p>
              <p>Documents: {formatNumber(usage.records.documents)}</p>
              <p>Problem solver sessions: {formatNumber(usage.records.problemSolverSessions)}</p>
              <p>Feedback: {formatNumber(usage.records.userFeedback)}</p>
              {usage.storage.scanTruncated ? (
                <p className="text-warning md:col-span-2">
                  Storage scan was truncated to {formatNumber(usage.storage.scannedObjects)} objects.
                </p>
              ) : null}
            </div>
          </Card>

          {usage.notes.length > 0 ? (
            <Card className="p-4" title="Notes">
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                {usage.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
