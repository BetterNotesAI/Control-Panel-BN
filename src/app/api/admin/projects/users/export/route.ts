import { NextResponse } from "next/server";
import { applyUtcDateRange, escapeCsvValue, parseProjectFilters, roundTo, toNumber } from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { PROJECT_TYPES } from "@/types/projects";
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

const PAGE_SIZE = 1000;

function applyByUserViewFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  ilike: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectType: string;
    userEmail: string;
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

async function fetchAllFromByUserView(params: {
  projectType: string;
  userEmail: string;
}): Promise<
  Array<{
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
  }>
> {
  const supabase = getSupabaseAdminClient();
  const rows: Array<{
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
  }> = [];

  let from = 0;

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_by_user_feature_model_v")
      .select(
        "user_id,user_email,user_display_name,project_type,feature,provider,model,event_count,total_tokens,total_credits,first_event_at,last_event_at",
      )
      .order("total_credits", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    query = applyByUserViewFilters(query, params);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as UsageByUserRow[];

    if (chunk.length === 0) {
      break;
    }

    for (const row of chunk) {
      rows.push({
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
      });
    }

    if (chunk.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function fetchAllFromEvents(params: {
  projectType: string;
  userEmail: string;
  status: string;
  startDate: string;
  endDate: string;
}): Promise<
  Array<{
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
  }>
> {
  const supabase = getSupabaseAdminClient();
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

  let from = 0;

  while (true) {
    let query = supabase
      .from("analytics_ai_usage_events_v")
      .select(
        "created_at,user_id,user_email,user_display_name,project_type,feature,provider,model,total_tokens,total_credits",
      )
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    query = applyEventFilters(query, params);

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as UsageEventRow[];

    if (chunk.length === 0) {
      break;
    }

    for (const row of chunk) {
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

    if (chunk.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return [...grouped.values()]
    .map((row) => ({
      ...row,
      total_credits: roundTo(row.total_credits, 6),
    }))
    .sort((a, b) => {
      if (b.total_credits !== a.total_credits) {
        return b.total_credits - a.total_credits;
      }

      return (b.last_event_at ?? "").localeCompare(a.last_event_at ?? "");
    });
}

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const filters = parseProjectFilters(url.searchParams);
  const hasDateOrStatusFilter =
    Boolean(filters.startDate || filters.endDate) || Boolean(filters.status);

  try {
    const rows = hasDateOrStatusFilter
      ? await fetchAllFromEvents({
          projectType: filters.projectType,
          userEmail: filters.userEmail,
          status: filters.status,
          startDate: filters.startDate,
          endDate: filters.endDate,
        })
      : await fetchAllFromByUserView({
          projectType: filters.projectType,
          userEmail: filters.userEmail,
        });

    const header = [
      "user_id",
      "user_email",
      "user_display_name",
      "project_type",
      "feature",
      "provider",
      "model",
      "event_count",
      "total_tokens",
      "total_credits",
      "first_event_at",
      "last_event_at",
    ];

    const lines = [header.join(",")];

    for (const row of rows) {
      lines.push(
        [
          escapeCsvValue(row.user_id),
          escapeCsvValue(row.user_email),
          escapeCsvValue(row.user_display_name),
          escapeCsvValue(row.project_type),
          escapeCsvValue(row.feature),
          escapeCsvValue(row.provider),
          escapeCsvValue(row.model),
          escapeCsvValue(row.event_count),
          escapeCsvValue(row.total_tokens),
          escapeCsvValue(row.total_credits),
          escapeCsvValue(row.first_event_at),
          escapeCsvValue(row.last_event_at),
        ].join(","),
      );
    }

    const filename = `projects-user-usage-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(lines.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export usage by user.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
