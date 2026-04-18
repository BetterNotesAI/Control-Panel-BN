"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PlanBadge, UserAvatar } from "@/modules/dashboard/components/user-ui";
import type { AdminUserItem, UsersListResponse } from "@/types/users";

const PAGE_SIZE = 20;
type UsersTab = "list" | "analytics";

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

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function toReadableProjectType(value: string): string {
  return value.replace(/_/g, " ");
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/35 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TypeBarsChart({
  title,
  rows,
  metric,
  barClassName,
  valueFormatter,
}: {
  title: string;
  rows: AdminUserItem["stats"]["project_type_breakdown"];
  metric: "project_count" | "total_tokens";
  barClassName: string;
  valueFormatter: (value: number) => string;
}) {
  const rowsWithData = rows
    .filter((row) => row[metric] > 0)
    .sort((left, right) => right[metric] - left[metric])
    .slice(0, 6);

  if (rowsWithData.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surfaceMuted/25 p-4">
        <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
        <p className="mt-2 text-xs text-muted">No data yet.</p>
      </div>
    );
  }

  const maxValue = Math.max(...rowsWithData.map((row) => row[metric]), 1);

  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/25 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <div className="mt-3 space-y-2.5">
        {rowsWithData.map((row) => {
          const value = row[metric];
          const width = `${(value / maxValue) * 100}%`;

          return (
            <div key={`${row.project_type}:${metric}`} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted">
                <span className="capitalize text-foreground">
                  {toReadableProjectType(row.project_type)}
                </span>
                <span>{valueFormatter(value)}</span>
              </div>
              <div className="h-2 rounded bg-surfaceMuted">
                <div
                  className={`h-full rounded transition-all ${barClassName}`}
                  style={{ width }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UsersListTable({ users }: { users: AdminUserItem[] }) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2">User</th>
            <th className="px-3 py-2">Plan</th>
            <th className="px-3 py-2">Joined</th>
            <th className="px-3 py-2">Last sign in</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr
              key={user.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/dashboard/users/${user.id}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  router.push(`/dashboard/users/${user.id}`);
                }
              }}
              className="cursor-pointer border-b border-border/70 transition-colors hover:bg-surfaceMuted/35 focus-visible:bg-surfaceMuted/35 focus-visible:outline-none last:border-none"
            >
              <td className="px-3 py-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    avatarUrl={user.avatar_url}
                    displayName={user.full_name}
                    email={user.email}
                  />
                  <div>
                    {user.full_name ? (
                      <p className="text-sm font-medium text-foreground">
                        {user.full_name}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted">
                      {user.email ?? "—"}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <PlanBadge plan={user.plan} />
              </td>
              <td className="px-3 py-3 text-xs text-muted">
                {formatDate(user.created_at)}
              </td>
              <td className="px-3 py-3 text-xs text-muted">
                {formatDate(user.last_sign_in_at)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserAnalyticsCard({ user }: { user: AdminUserItem }) {
  const router = useRouter();
  const displayName = user.full_name ?? user.email ?? "Unknown user";

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserAvatar
            size="lg"
            avatarUrl={user.avatar_url}
            displayName={user.full_name}
            email={user.email}
          />
          <div>
            <p className="text-lg font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted">{user.email ?? "No email available"}</p>
            <p className="mt-1 text-xs text-muted">
              Joined: {formatDate(user.created_at)} | Last sign in:{" "}
              {formatDate(user.last_sign_in_at)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PlanBadge plan={user.plan} />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.push(`/dashboard/users/${user.id}`)}
          >
            Open detail
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total tokens" value={formatNumber(user.stats.total_tokens)} />
        <MetricCard label="Total credits" value={formatCredits(user.stats.total_credits)} />
        <MetricCard label="Total projects" value={formatNumber(user.stats.total_projects)} />
      </div>

      <div className="rounded-lg border border-border bg-surfaceMuted/20 p-3">
        <p className="text-xs uppercase tracking-wide text-muted">Projects by type</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {user.stats.project_type_breakdown.length > 0 ? (
            user.stats.project_type_breakdown.map((entry) => (
              <span
                key={`chip:${entry.project_type}`}
                className="inline-flex rounded-full border border-border px-2.5 py-1 text-xs text-foreground"
              >
                <span className="capitalize">{toReadableProjectType(entry.project_type)}</span>
                <span className="ml-1 text-muted">({formatNumber(entry.project_count)})</span>
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">No projects yet.</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <TypeBarsChart
          title="Project count by type"
          rows={user.stats.project_type_breakdown}
          metric="project_count"
          barClassName="bg-info"
          valueFormatter={formatNumber}
        />
        <TypeBarsChart
          title="Token usage by type"
          rows={user.stats.project_type_breakdown}
          metric="total_tokens"
          barClassName="bg-success"
          valueFormatter={formatNumber}
        />
      </div>
    </Card>
  );
}

export function UsersView() {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeTab, setActiveTab] = useState<UsersTab>("list");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });

      if (appliedSearch) {
        params.set("q", appliedSearch);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error("Failed to load users.");
      }

      const body = (await res.json()) as UsersListResponse;
      setUsers(body.users);
      setTotal(body.total);
      setTotalPages(body.totalPages);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleClear = () => {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted">{total} registered users</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={handleKeyDown}
          className="max-w-sm"
        />
        <Button size="sm" onClick={handleSearch}>
          Search
        </Button>
        {appliedSearch ? (
          <Button size="sm" variant="ghost" onClick={handleClear}>
            Clear
          </Button>
        ) : null}
      </div>

      <div className="inline-flex rounded-lg border border-border bg-surface/70 p-1">
        <Button
          size="sm"
          variant={activeTab === "list" ? "primary" : "secondary"}
          onClick={() => setActiveTab("list")}
        >
          User list
        </Button>
        <Button
          size="sm"
          variant={activeTab === "analytics" ? "primary" : "secondary"}
          onClick={() => setActiveTab("analytics")}
        >
          User analytics
        </Button>
      </div>

      {loading ? <LoadingState message="Loading users..." /> : null}
      {error ? <ErrorState message={error} /> : null}
      {!loading && !error && users.length === 0 ? (
        <EmptyState message="No users found." />
      ) : null}

      {!loading && !error && users.length > 0 ? (
        <>
          {activeTab === "list" ? (
            <Card>
              <UsersListTable users={users} />
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {users.map((user) => (
                  <UserAnalyticsCard key={user.id} user={user} />
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
