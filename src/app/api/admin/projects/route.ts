import { NextResponse } from "next/server";
import {
  applyUtcDateRange,
  buildProjectKey,
  fetchUserEmailMap,
  parsePagination,
  parseProjectFilters,
  resolveUserIdsByEmailFilter,
  roundTo,
  toNumber,
} from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { PROJECT_TYPES, type ProjectListItem, type ProjectsKpis, type ProjectsListResponse } from "@/types/projects";
import type { Database } from "@/types/database";

type ProjectRow = Database["public"]["Views"]["analytics_projects_v"]["Row"];
type ProjectUsageRow = Database["public"]["Views"]["analytics_ai_usage_by_project_v"]["Row"];
type UsageEventRow = Pick<
  Database["public"]["Views"]["analytics_ai_usage_events_v"]["Row"],
  "user_id" | "project_type" | "project_id" | "model" | "total_tokens" | "total_credits"
>;

interface ProjectUsageAccumulator {
  totalCredits: number;
  totalTokens: number;
  modelCount: number;
  models: Set<string>;
}

const AGGREGATE_PAGE_SIZE = 1000;

function applyProjectMetadataFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  gte: (column: string, value: string) => T;
  lt: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectType: string;
    status: string;
    startDate: string;
    endDate: string;
    userIds: string[] | null;
  },
): T {
  let nextQuery = query;

  if (params.projectType !== "all") {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  }

  if (params.status) {
    nextQuery = nextQuery.eq("status", params.status);
  }

  if (params.userIds && params.userIds.length > 0) {
    nextQuery = nextQuery.in("user_id", params.userIds);
  }

  nextQuery = applyUtcDateRange(nextQuery, "created_at", params.startDate, params.endDate);

  return nextQuery;
}

function applyProjectUsageFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
}>(
  query: T,
  params: {
    projectType: string;
    status: string;
    userIds: string[] | null;
  },
): T {
  let nextQuery = query;

  if (params.projectType !== "all") {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  } else {
    nextQuery = nextQuery.in("project_type", [...PROJECT_TYPES]);
  }

  if (params.status) {
    nextQuery = nextQuery.eq("project_status", params.status);
  }

  if (params.userIds && params.userIds.length > 0) {
    nextQuery = nextQuery.in("user_id", params.userIds);
  }

  return nextQuery;
}

function applyProjectEventFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  gte: (column: string, value: string) => T;
  lt: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectType: string;
    status: string;
    startDate: string;
    endDate: string;
    userIds: string[] | null;
  },
): T {
  let nextQuery = query;

  if (params.projectType !== "all") {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  } else {
    nextQuery = nextQuery.in("project_type", [...PROJECT_TYPES]);
  }

  if (params.status) {
    nextQuery = nextQuery.eq("project_status", params.status);
  }

  if (params.userIds && params.userIds.length > 0) {
    nextQuery = nextQuery.in("user_id", params.userIds);
  }

  nextQuery = applyUtcDateRange(nextQuery, "created_at", params.startDate, params.endDate);

  return nextQuery;
}

async function buildKpisWithDateRange(params: {
  projectType: string;
  status: string;
  startDate: string;
  endDate: string;
  userIds: string[] | null;
}): Promise<Pick<ProjectsKpis, "totalCreditsConsumed" | "totalTokens" | "activeUsers">> {
  const supabase = getSupabaseAdminClient();
  const activeUserCredits = new Map<string, number>();

  let from = 0;
  let totalCredits = 0;
  let totalTokens = 0;

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_events_v")
      .select("user_id,total_tokens,total_credits")
      .order("created_at", { ascending: true })
      .range(from, from + AGGREGATE_PAGE_SIZE - 1);

    query = applyProjectEventFilters(query, params);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as UsageEventRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const credits = toNumber(row.total_credits);
      const tokens = toNumber(row.total_tokens);

      totalCredits += credits;
      totalTokens += tokens;

      if (credits > 0) {
        activeUserCredits.set(row.user_id, (activeUserCredits.get(row.user_id) ?? 0) + credits);
      }
    }

    if (rows.length < AGGREGATE_PAGE_SIZE) {
      break;
    }

    from += AGGREGATE_PAGE_SIZE;
  }

  return {
    totalCreditsConsumed: roundTo(totalCredits, 6),
    totalTokens,
    activeUsers: activeUserCredits.size,
  };
}

async function buildKpisAllTime(params: {
  projectType: string;
  status: string;
  userIds: string[] | null;
}): Promise<Pick<ProjectsKpis, "totalCreditsConsumed" | "totalTokens" | "activeUsers">> {
  const supabase = getSupabaseAdminClient();
  const creditsByUser = new Map<string, number>();

  let from = 0;
  let totalCredits = 0;
  let totalTokens = 0;

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_by_project_v")
      .select("user_id,total_tokens,total_credits")
      .order("last_event_at", { ascending: false, nullsFirst: false })
      .range(from, from + AGGREGATE_PAGE_SIZE - 1);

    query = applyProjectUsageFilters(query, params);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Pick<ProjectUsageRow, "user_id" | "total_tokens" | "total_credits">[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const credits = toNumber(row.total_credits);
      totalCredits += credits;
      totalTokens += toNumber(row.total_tokens);

      if (credits > 0) {
        creditsByUser.set(row.user_id, (creditsByUser.get(row.user_id) ?? 0) + credits);
      }
    }

    if (rows.length < AGGREGATE_PAGE_SIZE) {
      break;
    }

    from += AGGREGATE_PAGE_SIZE;
  }

  return {
    totalCreditsConsumed: roundTo(totalCredits, 6),
    totalTokens,
    activeUsers: creditsByUser.size,
  };
}

async function fetchUsageByProjectForPage(params: {
  projectRows: ProjectRow[];
  filters: {
    projectType: string;
    status: string;
    startDate: string;
    endDate: string;
    userIds: string[] | null;
  };
}): Promise<Map<string, ProjectUsageAccumulator>> {
  const usageByProjectKey = new Map<string, ProjectUsageAccumulator>();
  const projectIds = [...new Set(params.projectRows.map((row) => row.project_id).filter(Boolean))];

  if (projectIds.length === 0) {
    return usageByProjectKey;
  }

  const hasDateRange = Boolean(params.filters.startDate || params.filters.endDate);
  const supabase = getSupabaseAdminClient();

  if (!hasDateRange) {
    let query = supabase
      .from("analytics_ai_usage_by_project_v")
      .select("project_type,project_id,total_tokens,total_credits,model_count")
      .in("project_id", projectIds);

    query = applyProjectUsageFilters(query, params.filters);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as Pick<
      ProjectUsageRow,
      "project_type" | "project_id" | "total_tokens" | "total_credits" | "model_count"
    >[];

    for (const row of rows) {
      const key = buildProjectKey(row.project_type, row.project_id);
      if (!key) {
        continue;
      }

      usageByProjectKey.set(key, {
        totalCredits: roundTo(toNumber(row.total_credits), 6),
        totalTokens: toNumber(row.total_tokens),
        modelCount: Math.max(0, Math.floor(toNumber(row.model_count))),
        models: new Set<string>(),
      });
    }

    return usageByProjectKey;
  }

  let from = 0;

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_events_v")
      .select("project_type,project_id,model,total_tokens,total_credits")
      .in("project_id", projectIds)
      .order("created_at", { ascending: true })
      .range(from, from + AGGREGATE_PAGE_SIZE - 1);

    query = applyProjectEventFilters(query, params.filters);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as UsageEventRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const key = buildProjectKey(row.project_type, row.project_id);
      if (!key) {
        continue;
      }

      const existing = usageByProjectKey.get(key) ?? {
        totalCredits: 0,
        totalTokens: 0,
        modelCount: 0,
        models: new Set<string>(),
      };

      existing.totalCredits += toNumber(row.total_credits);
      existing.totalTokens += toNumber(row.total_tokens);

      if (row.model) {
        existing.models.add(row.model);
      }

      usageByProjectKey.set(key, existing);
    }

    if (rows.length < AGGREGATE_PAGE_SIZE) {
      break;
    }

    from += AGGREGATE_PAGE_SIZE;
  }

  for (const value of usageByProjectKey.values()) {
    value.modelCount = value.models.size;
    value.totalCredits = roundTo(value.totalCredits, 6);
  }

  return usageByProjectKey;
}

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const filters = parseProjectFilters(url.searchParams);
  const { page, pageSize, from, to } = parsePagination(url.searchParams, {
    defaultPageSize: 20,
  });

  const supabase = getSupabaseAdminClient();
  const hasDateRange = Boolean(filters.startDate || filters.endDate);

  try {
    const userIds = await resolveUserIdsByEmailFilter(supabase, filters.userEmail);

    if (userIds && userIds.length === 0) {
      const emptyResponse: ProjectsListResponse = {
        filters,
        kpis: {
          totalProjects: 0,
          totalCreditsConsumed: 0,
          totalTokens: 0,
          activeUsers: 0,
        },
        projects: [],
        page,
        pageSize,
        total: 0,
        totalPages: 0,
      };

      return NextResponse.json(emptyResponse);
    }

    let projectsQuery = supabase
      .from("analytics_projects_v")
      .select("project_type,project_id,user_id,title,status,created_at", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(from, to);

    projectsQuery = applyProjectMetadataFilters(projectsQuery, {
      projectType: filters.projectType,
      status: filters.status,
      startDate: filters.startDate,
      endDate: filters.endDate,
      userIds,
    });

    const { data: projectData, error: projectsError, count } = await projectsQuery;

    if (projectsError) {
      throw projectsError;
    }

    const projectRows = (projectData ?? []) as ProjectRow[];
    const total = count ?? 0;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

    const userEmailMap = await fetchUserEmailMap(
      supabase,
      [...new Set(projectRows.map((row) => row.user_id).filter(Boolean))],
    );

    const usageByProject = await fetchUsageByProjectForPage({
      projectRows,
      filters: {
        projectType: filters.projectType,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        userIds,
      },
    });

    const projects: ProjectListItem[] = projectRows.map((row) => {
      const key = buildProjectKey(row.project_type, row.project_id);
      const usage = key ? usageByProject.get(key) : null;
      const modelsUsed = usage ? [...usage.models].sort((a, b) => a.localeCompare(b)) : [];

      return {
        project_id: row.project_id,
        project_type: row.project_type,
        title: row.title,
        user_email: userEmailMap.get(row.user_id) ?? null,
        status: row.status,
        created_at: row.created_at,
        total_credits: usage ? roundTo(usage.totalCredits, 6) : 0,
        total_tokens: usage ? usage.totalTokens : 0,
        models_used_count: usage ? usage.modelCount : 0,
        models_used: modelsUsed,
      };
    });

    const kpiMetrics = hasDateRange
      ? await buildKpisWithDateRange({
          projectType: filters.projectType,
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
          userIds,
        })
      : await buildKpisAllTime({
          projectType: filters.projectType,
          status: filters.status,
          userIds,
        });

    const response: ProjectsListResponse = {
      filters,
      kpis: {
        totalProjects: total,
        totalCreditsConsumed: kpiMetrics.totalCreditsConsumed,
        totalTokens: kpiMetrics.totalTokens,
        activeUsers: kpiMetrics.activeUsers,
      },
      projects,
      page,
      pageSize,
      total,
      totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load projects.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
