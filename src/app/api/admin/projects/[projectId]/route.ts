import { NextResponse } from "next/server";
import {
  applyUtcDateRange,
  normalizeNullableString,
  parsePagination,
  parseProjectFilters,
  roundTo,
  toNumber,
  toUtcDateKey,
} from "@/lib/admin/projects";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { PROJECT_TYPES, type ProjectDetailResponse } from "@/types/projects";
import type { Database } from "@/types/database";

type ProjectMetadataRow = Database["public"]["Views"]["analytics_projects_v"]["Row"];
type ProjectEventRow = Pick<
  Database["public"]["Views"]["analytics_ai_usage_events_v"]["Row"],
  | "usage_event_id"
  | "created_at"
  | "user_id"
  | "user_email"
  | "user_display_name"
  | "project_type"
  | "project_id"
  | "project_title"
  | "project_status"
  | "project_subtype"
  | "project_source"
  | "provider"
  | "model"
  | "feature"
  | "input_tokens"
  | "output_tokens"
  | "total_tokens"
  | "total_credits"
>;

const AGGREGATE_PAGE_SIZE = 1000;

function applyDetailEventFilters<T extends {
  eq: (column: string, value: string) => T;
  in: (column: string, value: string[]) => T;
  gte: (column: string, value: string) => T;
  lt: (column: string, value: string) => T;
}>(
  query: T,
  params: {
    projectId: string;
    projectType: string;
    startDate: string;
    endDate: string;
  },
): T {
  let nextQuery = query.eq("project_id", params.projectId);

  if (params.projectType) {
    nextQuery = nextQuery.eq("project_type", params.projectType);
  } else {
    nextQuery = nextQuery.in("project_type", [...PROJECT_TYPES, "document"]);
  }

  nextQuery = applyUtcDateRange(nextQuery, "created_at", params.startDate, params.endDate);

  return nextQuery;
}

function normalizeDetailType(value: string | null): string {
  const normalized = normalizeNullableString(value)?.toLowerCase() ?? "";
  if (!normalized) {
    return "";
  }

  return normalized;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const { projectId } = await context.params;

  if (!projectId) {
    return NextResponse.json({ error: "Invalid project id." }, { status: 400 });
  }

  const url = new URL(request.url);
  const parsedFilters = parseProjectFilters(url.searchParams);
  const detailType = normalizeDetailType(url.searchParams.get("type"));

  if (
    detailType &&
    !PROJECT_TYPES.includes(detailType as (typeof PROJECT_TYPES)[number]) &&
    detailType !== "document"
  ) {
    return NextResponse.json({ error: "Invalid project type." }, { status: 400 });
  }

  const filters = {
    ...parsedFilters,
    projectType:
      PROJECT_TYPES.includes(detailType as (typeof PROJECT_TYPES)[number])
        ? (detailType as (typeof PROJECT_TYPES)[number])
        : parsedFilters.projectType,
  };

  const { page, pageSize, from, to } = parsePagination(url.searchParams, {
    defaultPageSize: 20,
  });

  const supabase = getSupabaseAdminClient();

  try {
    let metadataQuery = supabase
      .from("analytics_projects_v")
      .select(
        "project_type,project_id,user_id,title,status,subtype,source_table,created_at,updated_at",
      )
      .eq("project_id", projectId);

    if (detailType && detailType !== "document") {
      metadataQuery = metadataQuery.eq("project_type", detailType);
    }

    const { data: metadataRow, error: metadataError } = await metadataQuery.maybeSingle();

    if (metadataError) {
      throw metadataError;
    }

    let aggregateFrom = 0;
    const allEvents: ProjectEventRow[] = [];

    while (true) {
      let query = supabase
        .from("analytics_ai_usage_events_v")
        .select(
          "usage_event_id,created_at,user_id,user_email,user_display_name,project_type,project_id,project_title,project_status,project_subtype,project_source,provider,model,feature,input_tokens,output_tokens,total_tokens,total_credits",
        )
        .order("created_at", { ascending: true })
        .range(aggregateFrom, aggregateFrom + AGGREGATE_PAGE_SIZE - 1);

      query = applyDetailEventFilters(query, {
        projectId,
        projectType: detailType,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as ProjectEventRow[];

      if (rows.length === 0) {
        break;
      }

      allEvents.push(...rows);

      if (rows.length < AGGREGATE_PAGE_SIZE) {
        break;
      }

      aggregateFrom += AGGREGATE_PAGE_SIZE;
    }

    if (!metadataRow && allEvents.length === 0) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const featureMap = new Map<
      string,
      { feature: string | null; totalTokens: number; totalCredits: number; eventCount: number }
    >();
    const modelMap = new Map<
      string,
      {
        provider: string;
        model: string;
        totalTokens: number;
        totalCredits: number;
        eventCount: number;
      }
    >();
    const seriesMap = new Map<
      string,
      {
        totalTokens: number;
        totalCredits: number;
      }
    >();

    let totalCredits = 0;
    let totalTokens = 0;

    for (const event of allEvents) {
      const credits = toNumber(event.total_credits);
      const tokens = toNumber(event.total_tokens);

      totalCredits += credits;
      totalTokens += tokens;

      const seriesKey = toUtcDateKey(event.created_at);
      const seriesEntry = seriesMap.get(seriesKey) ?? { totalTokens: 0, totalCredits: 0 };
      seriesEntry.totalTokens += tokens;
      seriesEntry.totalCredits += credits;
      seriesMap.set(seriesKey, seriesEntry);

      const featureKey = event.feature ?? "__none__";
      const featureEntry = featureMap.get(featureKey) ?? {
        feature: event.feature ?? null,
        totalTokens: 0,
        totalCredits: 0,
        eventCount: 0,
      };
      featureEntry.totalTokens += tokens;
      featureEntry.totalCredits += credits;
      featureEntry.eventCount += 1;
      featureMap.set(featureKey, featureEntry);

      const modelKey = `${event.provider}:${event.model}`;
      const modelEntry = modelMap.get(modelKey) ?? {
        provider: event.provider,
        model: event.model,
        totalTokens: 0,
        totalCredits: 0,
        eventCount: 0,
      };
      modelEntry.totalTokens += tokens;
      modelEntry.totalCredits += credits;
      modelEntry.eventCount += 1;
      modelMap.set(modelKey, modelEntry);
    }

    const series = [...seriesMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, value]) => ({
        date,
        total_tokens: value.totalTokens,
        total_credits: roundTo(value.totalCredits, 6),
      }));

    const breakdownByFeature = [...featureMap.values()]
      .sort((a, b) => b.totalCredits - a.totalCredits)
      .map((value) => ({
        feature: value.feature,
        total_tokens: value.totalTokens,
        total_credits: roundTo(value.totalCredits, 6),
        event_count: value.eventCount,
      }));

    const breakdownByModel = [...modelMap.values()]
      .sort((a, b) => b.totalCredits - a.totalCredits)
      .map((value) => ({
        provider: value.provider,
        model: value.model,
        total_tokens: value.totalTokens,
        total_credits: roundTo(value.totalCredits, 6),
        event_count: value.eventCount,
      }));

    let eventsQuery = supabase
      .from("analytics_ai_usage_events_v")
      .select(
        "usage_event_id,created_at,feature,provider,model,input_tokens,output_tokens,total_tokens,total_credits",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    eventsQuery = applyDetailEventFilters(eventsQuery, {
      projectId,
      projectType: detailType,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const { data: eventRows, error: eventsError, count } = await eventsQuery;

    if (eventsError) {
      throw eventsError;
    }

    const events = (eventRows ?? []) as Pick<
      ProjectEventRow,
      | "usage_event_id"
      | "created_at"
      | "feature"
      | "provider"
      | "model"
      | "input_tokens"
      | "output_tokens"
      | "total_tokens"
      | "total_credits"
    >[];

    const firstEvent = allEvents[0];
    const projectTypeFromData =
      detailType ||
      metadataRow?.project_type ||
      normalizeNullableString(firstEvent?.project_type) ||
      "unknown";
    const projectIdFromData =
      metadataRow?.project_id ||
      normalizeNullableString(firstEvent?.project_id) ||
      projectId;

    const metadata = metadataRow as ProjectMetadataRow | null;

    let userEmail: string | null = null;
    let userDisplayName: string | null = null;
    let userId: string | null = null;

    if (metadata?.user_id) {
      const { data: profileRow, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,display_name")
        .eq("id", metadata.user_id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profileRow) {
        userId = profileRow.id;
        userEmail = profileRow.email ?? null;
        userDisplayName = profileRow.display_name ?? null;
      } else {
        userId = metadata.user_id;
      }
    } else if (firstEvent) {
      userId = firstEvent.user_id;
      userEmail = firstEvent.user_email ?? null;
      userDisplayName = firstEvent.user_display_name ?? null;
    }

    const response: ProjectDetailResponse = {
      filters,
      project: {
        project_id: projectIdFromData,
        project_type: projectTypeFromData,
        title: metadata?.title ?? firstEvent?.project_title ?? null,
        status: metadata?.status ?? firstEvent?.project_status ?? null,
        subtype: metadata?.subtype ?? firstEvent?.project_subtype ?? null,
        source_table: metadata?.source_table ?? firstEvent?.project_source ?? null,
        user_id: userId,
        user_email: userEmail,
        user_display_name: userDisplayName,
        created_at: metadata?.created_at ?? null,
        updated_at: metadata?.updated_at ?? null,
      },
      summary: {
        totalCredits: roundTo(totalCredits, 6),
        totalTokens,
        totalEvents: allEvents.length,
      },
      series,
      breakdownByFeature,
      breakdownByModel,
      events: {
        items: events.map((event) => ({
          usage_event_id: event.usage_event_id,
          created_at: event.created_at,
          feature: event.feature,
          provider: event.provider,
          model: event.model,
          input_tokens: event.input_tokens,
          output_tokens: event.output_tokens,
          total_tokens: event.total_tokens,
          total_credits: roundTo(toNumber(event.total_credits), 6),
        })),
        page,
        pageSize,
        total: count ?? 0,
        totalPages: !count || count === 0 ? 0 : Math.ceil(count / pageSize),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load project details.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
