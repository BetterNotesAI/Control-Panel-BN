import { NextResponse } from "next/server";
import { applyUtcDateRange, getExclusiveEndDate, parsePagination, parseProjectFilters, roundTo, toNumber } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { PROJECT_TYPES, type ProjectUserUsageItem, type ProjectUserUsageResponse } from "@/types/projects";
import type { Database } from "@/types/database";

type UsageByUserRow = Database["public"]["Views"]["analytics_ai_usage_by_user_feature_model_v"]["Row"];
type UsageEventRow = Pick<
  Database["public"]["Views"]["analytics_ai_usage_events_v"]["Row"],
  | "created_at"
  | "user_id"
  | "user_email"
  | "user_display_name"
  | "project_type"
  | "feature"
  | "provider"
  | "model"
  | "total_tokens"
  | "total_credits"
>;

const AGGREGATE_PAGE_SIZE = 1000;

function applyByUserViewFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  ilike: (column: string, value: string) => T;
  gte: (column: string, value: string) => T;
  lt: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectType: string;
    userEmail: string;
    startDate: string;
    endDate: string;
  },
): T {
  let nextQuery = query;

  if (params.projectType !== "all") {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  } else {
    nextQuery = nextQuery.in("project_type", [...PROJECT_TYPES]);
  }

  if (params.userEmail) {
    nextQuery = nextQuery.ilike("user_email", `%${params.userEmail}%`);
  }

  if (params.startDate) {
    nextQuery = nextQuery.gte("last_event_at", `${params.startDate}T00:00:00.000Z`);
  }

  if (params.endDate) {
    nextQuery = nextQuery.lt("first_event_at", getExclusiveEndDate(params.endDate));
  }

  return nextQuery;
}

function applyEventFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  ilike: (column: string, value: string) => T;
  gte: (column: string, value: string) => T;
  lt: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectType: string;
    userEmail: string;
    status: string;
    startDate: string;
    endDate: string;
  },
): T {
  let nextQuery = query;

  if (params.projectType !== "all") {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  } else {
    nextQuery = nextQuery.in("project_type", [...PROJECT_TYPES]);
  }

  if (params.userEmail) {
    nextQuery = nextQuery.ilike("user_email", `%${params.userEmail}%`);
  }

  if (params.status) {
    nextQuery = nextQuery.eq("project_status", params.status);
  }

  nextQuery = applyUtcDateRange(nextQuery, "created_at", params.startDate, params.endDate);

  return nextQuery;
}

async function fetchUsageFromEvents(params: {
  projectType: string;
  userEmail: string;
  status: string;
  startDate: string;
  endDate: string;
  from: number;
  to: number;
}): Promise<{ items: ProjectUserUsageItem[]; total: number }> {
  const supabase = getSupabaseAdminClient();
  let pageFrom = 0;

  const grouped = new Map<
    string,
    {
      user_id: string;
      user_email: string | null;
      user_display_name: string | null;
      project_type: string | null;
      feature: string | null;
      provider: string;
      model: string;
      event_count: number;
      total_tokens: number;
      total_credits: number;
      first_event_at: string | null;
      last_event_at: string | null;
    }
  >();

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_events_v")
      .select(
        "created_at,user_id,user_email,user_display_name,project_type,feature,provider,model,total_tokens,total_credits",
      )
      .order("created_at", { ascending: true })
      .range(pageFrom, pageFrom + AGGREGATE_PAGE_SIZE - 1);

    query = applyEventFilters(query, params);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = (data ?? []) as UsageEventRow[];

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const key = [
        row.user_id,
        row.project_type ?? "",
        row.feature ?? "",
        row.provider,
        row.model,
      ].join("|");

      const existing = grouped.get(key) ?? {
        user_id: row.user_id,
        user_email: row.user_email ?? null,
        user_display_name: row.user_display_name ?? null,
        project_type: row.project_type ?? null,
        feature: row.feature ?? null,
        provider: row.provider,
        model: row.model,
        event_count: 0,
        total_tokens: 0,
        total_credits: 0,
        first_event_at: row.created_at,
        last_event_at: row.created_at,
      };

      existing.event_count += 1;
      existing.total_tokens += toNumber(row.total_tokens);
      existing.total_credits += toNumber(row.total_credits);

      if (!existing.first_event_at || row.created_at < existing.first_event_at) {
        existing.first_event_at = row.created_at;
      }

      if (!existing.last_event_at || row.created_at > existing.last_event_at) {
        existing.last_event_at = row.created_at;
      }

      grouped.set(key, existing);
    }

    if (rows.length < AGGREGATE_PAGE_SIZE) {
      break;
    }

    pageFrom += AGGREGATE_PAGE_SIZE;
  }

  const sortedItems: ProjectUserUsageItem[] = [...grouped.values()]
    .map((row) => ({
      ...row,
      total_credits: roundTo(row.total_credits, 6),
    }))
    .sort((a, b) => {
      if (b.total_credits !== a.total_credits) {
        return b.total_credits - a.total_credits;
      }

      const left = a.last_event_at ?? "";
      const right = b.last_event_at ?? "";
      return right.localeCompare(left);
    });

  return {
    items: sortedItems.slice(params.from, params.to + 1),
    total: sortedItems.length,
  };
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

  const hasDateOrStatusFilter =
    Boolean(filters.startDate || filters.endDate) || Boolean(filters.status);

  try {
    if (hasDateOrStatusFilter) {
      const aggregated = await fetchUsageFromEvents({
        projectType: filters.projectType,
        userEmail: filters.userEmail,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        from,
        to,
      });

      const response: ProjectUserUsageResponse = {
        filters,
        items: aggregated.items,
        page,
        pageSize,
        total: aggregated.total,
        totalPages: aggregated.total === 0 ? 0 : Math.ceil(aggregated.total / pageSize),
      };

      return NextResponse.json(response);
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("analytics_ai_usage_by_user_feature_model_v")
      .select(
        "user_id,user_email,user_display_name,project_type,feature,provider,model,event_count,total_tokens,total_credits,first_event_at,last_event_at",
        { count: "exact" },
      )
      .order("total_credits", { ascending: false })
      .range(from, to);

    query = applyByUserViewFilters(query, {
      projectType: filters.projectType,
      userEmail: filters.userEmail,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    const items: ProjectUserUsageItem[] = ((data ?? []) as UsageByUserRow[]).map((row) => ({
      user_id: row.user_id,
      user_email: row.user_email ?? null,
      user_display_name: row.user_display_name ?? null,
      project_type: row.project_type ?? null,
      feature: row.feature ?? null,
      provider: row.provider,
      model: row.model,
      event_count: row.event_count,
      total_tokens: toNumber(row.total_tokens),
      total_credits: roundTo(toNumber(row.total_credits), 6),
      first_event_at: row.first_event_at,
      last_event_at: row.last_event_at,
    }));

    const total = count ?? 0;
    const response: ProjectUserUsageResponse = {
      filters,
      items,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load usage by user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
