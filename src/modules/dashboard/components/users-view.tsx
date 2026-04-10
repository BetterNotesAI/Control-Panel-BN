"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { PlanBadge, UserAvatar } from "@/modules/dashboard/components/user-ui";
import type { AdminUserItem, UsersListResponse } from "@/types/users";

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UsersView() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, appliedSearch]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSearch = () => {
    setPage(1);
    setAppliedSearch(search);
  };

  const handleClear = () => {
    setSearch("");
    setAppliedSearch("");
    setPage(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Users</h1>
        <p className="text-sm text-muted">{total} registered users</p>
      </div>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      <Card>
        {loading ? <LoadingState message="Loading users..." /> : null}
        {error ? <ErrorState message={error} /> : null}
        {!loading && !error && users.length === 0 ? (
          <EmptyState message="No users found." />
        ) : null}

        {!loading && !error && users.length > 0 ? (
          <>
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
                        {user.last_sign_in_at
                          ? formatDate(user.last_sign_in_at)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}
