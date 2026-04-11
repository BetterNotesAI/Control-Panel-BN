"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import {
  PROJECT_TYPES,
  type ProjectFilters,
  type ProjectListItem,
  type ProjectsKpis,
  type ProjectsListResponse,
  type ProjectUserUsageResponse,
} from "@/types/projects";

const DEFAULT_FILTERS: ProjectFilters = {
  startDate: "",
  endDate: "",
  projectType: "all",
  userEmail: "",
  status: "",
};

const PAGE_SIZE = 20;

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatCredits(value: number): string {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

function toReadableType(value: string | null): string {
  if (!value) {
    return "Unknown";
  }

  return value.replace(/_/g, " ");
}

function readErrorMessage(response: Response, fallback: string): Promise<string> {
  return response
    .json()
    .then((body: { error?: string }) => body.error ?? fallback)
    .catch(() => fallback);
}

function buildFilterParams(filters: ProjectFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }

  if (filters.projectType !== "all") {
    params.set("projectType", filters.projectType);
  }

  if (filters.userEmail.trim()) {
    params.set("userEmail", filters.userEmail.trim());
  }

  if (filters.status.trim()) {
    params.set("status", filters.status.trim().toLowerCase());
  }

  return params;
}

function normalizeFilters(value: ProjectFilters): ProjectFilters {
  return {
    startDate: value.startDate,
    endDate: value.endDate,
    projectType: value.projectType,
    userEmail: value.userEmail.trim(),
    status: value.status.trim().toLowerCase(),
  };
}

function buildModelsSummary(item: ProjectListItem): string {
  if (item.models_used.length > 0) {
    const visibleModels = item.models_used.slice(0, 2);
    const extra = item.models_used.length - visibleModels.length;

    if (extra > 0) {
      return `${visibleModels.join(", ")} +${extra}`;
    }

    return visibleModels.join(", ");
  }

  if (item.models_used_count > 0) {
    return `${item.models_used_count} models`;
  }

  return "—";
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-5 shadow-soft backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
    </section>
  );
}

export function ProjectsView() {
  const router = useRouter();
  const [draftFilters, setDraftFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ProjectFilters>(DEFAULT_FILTERS);

  const [projectsPage, setProjectsPage] = useState(1);
  const [usagePage, setUsagePage] = useState(1);

  const [projectsData, setProjectsData] = useState<ProjectsListResponse | null>(null);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [userUsageData, setUserUsageData] = useState<ProjectUserUsageResponse | null>(null);
  const [userUsageLoading, setUserUsageLoading] = useState(true);
  const [userUsageError, setUserUsageError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const params = buildFilterParams(appliedFilters);
      params.set("page", String(projectsPage));
      params.set("pageSize", String(PAGE_SIZE));

      const response = await fetch(`/api/admin/projects?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load projects."));
      }

      const body = (await response.json()) as ProjectsListResponse;
      setProjectsData(body);

      if (body.totalPages > 0 && projectsPage > body.totalPages) {
        setProjectsPage(body.totalPages);
      }
    } catch (error) {
      setProjectsError(
        error instanceof Error ? error.message : "Failed to load projects.",
      );
    } finally {
      setProjectsLoading(false);
    }
  }, [appliedFilters, projectsPage]);

  const fetchUserUsage = useCallback(async () => {
    setUserUsageLoading(true);
    setUserUsageError(null);

    try {
      const params = buildFilterParams(appliedFilters);
      params.set("page", String(usagePage));
      params.set("pageSize", String(PAGE_SIZE));

      const response = await fetch(`/api/admin/projects/users?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to load usage by user."));
      }

      const body = (await response.json()) as ProjectUserUsageResponse;
      setUserUsageData(body);

      if (body.totalPages > 0 && usagePage > body.totalPages) {
        setUsagePage(body.totalPages);
      }
    } catch (error) {
      setUserUsageError(
        error instanceof Error ? error.message : "Failed to load usage by user.",
      );
    } finally {
      setUserUsageLoading(false);
    }
  }, [appliedFilters, usagePage]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    void fetchUserUsage();
  }, [fetchUserUsage]);

  const kpis: ProjectsKpis = useMemo(
    () =>
      projectsData?.kpis ?? {
        totalProjects: 0,
        totalCreditsConsumed: 0,
        totalTokens: 0,
        activeUsers: 0,
      },
    [projectsData],
  );

  const handleApplyFilters = () => {
    const normalized = normalizeFilters(draftFilters);
    setProjectsPage(1);
    setUsagePage(1);
    setAppliedFilters(normalized);
    setDraftFilters(normalized);
  };

  const handleResetFilters = () => {
    setProjectsPage(1);
    setUsagePage(1);
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
  };

  const handleExportCsv = () => {
    const params = buildFilterParams(appliedFilters);
    window.location.href = `/api/admin/projects/users/export?${params.toString()}`;
  };

  const handleOpenProject = (project: ProjectListItem) => {
    if (!project.project_id) {
      return;
    }

    const detailParams = new URLSearchParams();
    detailParams.set("type", project.project_type);

    if (appliedFilters.startDate) {
      detailParams.set("startDate", appliedFilters.startDate);
    }

    if (appliedFilters.endDate) {
      detailParams.set("endDate", appliedFilters.endDate);
    }

    router.push(`/projects/${project.project_id}?${detailParams.toString()}`);
  };

  const projectSummary = useMemo(() => {
    const visible = projectsData?.projects.length ?? 0;
    const total = projectsData?.total ?? 0;
    return `${visible} visible of ${total}`;
  }, [projectsData]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="text-sm text-muted">Project management and AI usage analytics</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            void Promise.all([fetchProjects(), fetchUserUsage()]);
          }}
          disabled={projectsLoading || userUsageLoading}
        >
          Refresh
        </Button>
      </div>

      <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-soft">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-1">
            <label className="text-xs text-muted">Start date</label>
            <Input
              type="date"
              value={draftFilters.startDate}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  startDate: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">End date</label>
            <Input
              type="date"
              value={draftFilters.endDate}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  endDate: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Project type</label>
            <Select
              value={draftFilters.projectType}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  projectType: event.target.value as ProjectFilters["projectType"],
                }))
              }
            >
              <option value="all">All</option>
              {PROJECT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {toReadableType(type)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">User email</label>
            <Input
              placeholder="Search email..."
              value={draftFilters.userEmail}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  userEmail: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted">Status</label>
            <Input
              placeholder="pending, done, error..."
              value={draftFilters.status}
              onChange={(event) =>
                setDraftFilters((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={handleApplyFilters} disabled={projectsLoading || userUsageLoading}>
            Apply filters
          </Button>
          <Button
            variant="secondary"
            onClick={handleResetFilters}
            disabled={projectsLoading || userUsageLoading}
          >
            Reset
          </Button>
          <Button variant="ghost" onClick={handleExportCsv} disabled={userUsageLoading}>
            Export user usage CSV
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total projects" value={formatNumber(kpis.totalProjects)} />
        <StatCard
          label="Total credits consumed"
          value={formatCredits(kpis.totalCreditsConsumed)}
        />
        <StatCard label="Total tokens" value={formatNumber(kpis.totalTokens)} />
        <StatCard label="Active users" value={formatNumber(kpis.activeUsers)} />
      </div>

      <Card title="Projects" subtitle={projectSummary}>
        {projectsLoading ? <LoadingState message="Loading projects..." /> : null}
        {projectsError ? <ErrorState message={projectsError} /> : null}
        {!projectsLoading && !projectsError && (projectsData?.projects.length ?? 0) === 0 ? (
          <EmptyState message="No projects match the current filters." />
        ) : null}

        {!projectsLoading && !projectsError && (projectsData?.projects.length ?? 0) > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">Project type</th>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Created at</th>
                    <th className="px-2 py-2">Credits</th>
                    <th className="px-2 py-2">Tokens</th>
                    <th className="px-2 py-2">Models used</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsData?.projects.map((project) => (
                    <tr
                      key={`${project.project_type}:${project.project_id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenProject(project)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleOpenProject(project);
                        }
                      }}
                      className="cursor-pointer border-b border-border/70 transition-colors hover:bg-surfaceMuted/35 focus-visible:bg-surfaceMuted/35 focus-visible:outline-none last:border-none"
                    >
                      <td className="px-2 py-3 text-xs text-muted capitalize">
                        {toReadableType(project.project_type)}
                      </td>
                      <td className="px-2 py-3">
                        <p className="font-medium text-foreground">
                          {project.title?.trim() || "Untitled project"}
                        </p>
                        <p className="text-xs text-muted">{project.project_id}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {project.user_email ?? "—"}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {project.status ?? "—"}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDate(project.created_at)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatCredits(project.total_credits)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatNumber(project.total_tokens)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {buildModelsSummary(project)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={projectsPage}
              totalPages={projectsData?.totalPages ?? 0}
              onPageChange={setProjectsPage}
            />
          </>
        ) : null}
      </Card>

      <Card title="Usage by User / Feature / Model" subtitle="AI consumption segmentation">
        {userUsageLoading ? <LoadingState message="Loading user usage..." /> : null}
        {userUsageError ? <ErrorState message={userUsageError} /> : null}
        {!userUsageLoading && !userUsageError && (userUsageData?.items.length ?? 0) === 0 ? (
          <EmptyState message="No usage rows match the current filters." />
        ) : null}

        {!userUsageLoading && !userUsageError && (userUsageData?.items.length ?? 0) > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Project type</th>
                    <th className="px-2 py-2">Feature</th>
                    <th className="px-2 py-2">Provider / Model</th>
                    <th className="px-2 py-2">Events</th>
                    <th className="px-2 py-2">Tokens</th>
                    <th className="px-2 py-2">Credits</th>
                    <th className="px-2 py-2">First event</th>
                    <th className="px-2 py-2">Last event</th>
                  </tr>
                </thead>
                <tbody>
                  {userUsageData?.items.map((item, index) => (
                    <tr
                      key={[
                        item.user_id,
                        item.project_type ?? "",
                        item.feature ?? "",
                        item.provider,
                        item.model,
                        index,
                      ].join(":")}
                      className="border-b border-border/70 last:border-none"
                    >
                      <td className="px-2 py-3 text-xs text-muted">
                        <p className="text-foreground">
                          {item.user_display_name ?? item.user_email ?? item.user_id}
                        </p>
                        <p>{item.user_email ?? "—"}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted capitalize">
                        {toReadableType(item.project_type)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {item.feature ?? "general"}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        <p>{item.provider}</p>
                        <p>{item.model}</p>
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatNumber(item.event_count)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatNumber(item.total_tokens)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatCredits(item.total_credits)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDateTime(item.first_event_at)}
                      </td>
                      <td className="px-2 py-3 text-xs text-muted">
                        {formatDateTime(item.last_event_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={usagePage}
              totalPages={userUsageData?.totalPages ?? 0}
              onPageChange={setUsagePage}
            />
          </>
        ) : null}
      </Card>
    </div>
  );
}
