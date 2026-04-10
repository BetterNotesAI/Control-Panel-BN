"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PlanBadge, UserAvatar } from "@/modules/dashboard/components/user-ui";
import type {
  AdminUserDetail,
  UserDetailResponse,
  UserUsageEventItem,
} from "@/types/users";

interface UserDetailViewProps {
  userId: string;
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

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function toReadableLabel(value: string | null): string {
  if (!value) {
    return "—";
  }

  return value.replace(/_/g, " ");
}

function StatCard({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/35 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted">{caption}</p>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 py-3 last:border-none last:pb-0">
      <span className="text-xs uppercase tracking-wide text-muted">{label}</span>
      <span className="text-right text-sm text-foreground">{value ?? "—"}</span>
    </div>
  );
}

function UsageEventsTable({ events }: { events: UserUsageEventItem[] }) {
  if (events.length === 0) {
    return <EmptyState message="No usage events for this user yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2">Feature</th>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Tokens</th>
            <th className="px-3 py-2">Cost</th>
            <th className="px-3 py-2">Date</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event) => (
            <tr key={event.id} className="border-b border-border/70 last:border-none">
              <td className="px-3 py-3">
                <p className="font-medium text-foreground">{event.feature ?? "General"}</p>
                <p className="text-xs text-muted">{event.provider}</p>
              </td>
              <td className="px-3 py-3 text-xs text-muted">{event.model}</td>
              <td className="px-3 py-3 text-xs text-muted">
                {new Intl.NumberFormat().format(event.total_tokens)}
              </td>
              <td className="px-3 py-3 text-xs text-muted">{formatUsd(event.total_cost_usd)}</td>
              <td className="px-3 py-3 text-xs text-muted">{formatDateTime(event.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UserDetailView({ userId }: UserDetailViewProps) {
  const router = useRouter();
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to load user details.");
      }

      const body = (await response.json()) as UserDetailResponse;
      setUser(body.user);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error ? fetchError.message : "Failed to load user details.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const usagePercent = useMemo(() => {
    if (!user || user.usage.credits_limit <= 0) {
      return 0;
    }

    return Math.min((user.usage.credits_used / user.usage.credits_limit) * 100, 100);
  }, [user]);

  if (loading && !user) {
    return (
      <div className="mx-auto max-w-7xl">
        <LoadingState message="Loading user details..." />
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <ErrorState message={error} />
        <Button
          variant="secondary"
          size="sm"
          className="w-fit"
          onClick={() => router.push("/dashboard/users")}
        >
          Back to users
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-7xl">
        <EmptyState message="User not found." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/users")}
        >
          Back to users
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => void fetchUser()}
        >
          {loading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-gradient-to-r from-info/10 via-surface to-success/10 px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                size="lg"
                avatarUrl={user.avatar_url}
                displayName={user.display_name}
                email={user.email}
              />
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  {user.display_name ?? user.email ?? "Unknown user"}
                </h1>
                <p className="mt-1 text-sm text-muted">{user.email ?? "No email available"}</p>
                {user.username ? (
                  <p className="mt-1 text-xs text-muted">@{user.username}</p>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <PlanBadge plan={user.plan} className="text-sm" />
              <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted capitalize">
                {toReadableLabel(user.subscription_status)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Credits Used"
              value={formatCredits(user.usage.credits_used)}
              caption={`of ${formatCredits(user.usage.credits_limit)}`}
            />
            <StatCard
              label="Credits Remaining"
              value={formatCredits(user.usage.credits_remaining)}
              caption="current month"
            />
            <StatCard
              label="USD Used"
              value={formatUsd(user.usage.usd_used)}
              caption={`of ${formatUsd(user.usage.usd_limit)}`}
            />
            <StatCard
              label="Billing Interval"
              value={toReadableLabel(user.billing_interval)}
              caption="subscription"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Monthly usage progress</span>
              <span>{usagePercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-surfaceMuted">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  usagePercent >= 90 ? "bg-warning" : "bg-info",
                )}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted">
              Period: {formatDate(user.usage.period_start)} - {formatDate(user.usage.period_end)}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Profile details" className="xl:col-span-1">
          <ProfileRow label="Bio" value={user.short_bio} />
          <ProfileRow label="University" value={user.university} />
          <ProfileRow label="Degree" value={user.degree} />
          <ProfileRow label="Visibility" value={toReadableLabel(user.profile_visibility)} />
          <ProfileRow label="Language" value={user.language?.toUpperCase() ?? null} />
          <ProfileRow label="Joined" value={formatDate(user.created_at)} />
          <ProfileRow label="Last sign in" value={formatDate(user.last_sign_in_at)} />
          <ProfileRow label="Updated" value={formatDate(user.updated_at)} />
        </Card>

        <Card
          title="Recent usage events"
          subtitle="Last 20 events with token and cost traceability"
          className="xl:col-span-2"
        >
          <UsageEventsTable events={user.recent_usage_events} />
        </Card>
      </div>
    </div>
  );
}
