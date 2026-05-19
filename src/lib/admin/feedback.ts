import {
  FACULTY_FEEDBACK_SOURCE,
  FEEDBACK_STATUSES,
  FEEDBACK_TYPES,
  getFeedbackTypeFromSource,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackType,
} from "@/types/feedback";
import type { Database } from "@/types/database";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

const FEEDBACK_STATUS_SET = new Set(FEEDBACK_STATUSES);
const FEEDBACK_TYPE_SET = new Set(FEEDBACK_TYPES);

export interface FeedbackQueryFilters {
  status?: FeedbackStatus;
  type?: FeedbackType;
  query?: string;
  startDate?: string;
  endDate?: string;
}

export type FeedbackRow = Database["public"]["Tables"]["user_feedback"]["Row"];

interface FeedbackFilterQuery {
  eq: (column: string, value: string) => FeedbackFilterQuery;
  neq: (column: string, value: string) => FeedbackFilterQuery;
  ilike: (column: string, pattern: string) => FeedbackFilterQuery;
  gte: (column: string, value: string) => FeedbackFilterQuery;
  lt: (column: string, value: string) => FeedbackFilterQuery;
}

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export function parseFeedbackFilters(searchParams: URLSearchParams): FeedbackQueryFilters {
  const statusRaw = searchParams.get("status")?.trim().toLowerCase();
  const typeRaw = searchParams.get("type")?.trim().toLowerCase();
  const queryRaw = searchParams.get("q")?.trim();
  const startDateRaw = searchParams.get("startDate")?.trim();
  const endDateRaw = searchParams.get("endDate")?.trim();

  return {
    status:
      statusRaw && FEEDBACK_STATUS_SET.has(statusRaw as FeedbackStatus)
        ? (statusRaw as FeedbackStatus)
        : undefined,
    type:
      typeRaw && FEEDBACK_TYPE_SET.has(typeRaw as FeedbackType)
        ? (typeRaw as FeedbackType)
        : undefined,
    query: queryRaw || undefined,
    startDate: normalizeDateInput(startDateRaw),
    endDate: normalizeDateInput(endDateRaw),
  };
}

export function parsePagination(searchParams: URLSearchParams): {
  page: number;
  pageSize: number;
  from: number;
  to: number;
} {
  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? "20");

  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(100, Math.floor(pageSizeRaw))
      : 20;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function applyFeedbackFilters<T extends FeedbackFilterQuery>(
  query: T,
  filters: FeedbackQueryFilters,
): T {
  let nextQuery: FeedbackFilterQuery = query;

  if (filters.status) {
    nextQuery = nextQuery.eq("status", filters.status);
  }

  if (filters.type === "faculty") {
    nextQuery = nextQuery.eq("source", FACULTY_FEEDBACK_SOURCE);
  }

  if (filters.type === "suggestion") {
    nextQuery = nextQuery.neq("source", FACULTY_FEEDBACK_SOURCE);
  }

  if (filters.query) {
    nextQuery = nextQuery.ilike("message", `%${filters.query}%`);
  }

  if (filters.startDate) {
    nextQuery = nextQuery.gte("created_at", `${filters.startDate}T00:00:00.000Z`);
  }

  if (filters.endDate) {
    nextQuery = nextQuery.lt("created_at", getExclusiveEndDate(filters.endDate));
  }

  return nextQuery as T;
}

export async function fetchAllFeedbackRows(
  supabase: AdminClient,
  filters: FeedbackQueryFilters,
): Promise<FeedbackRow[]> {
  const chunkSize = 1000;
  const rows: FeedbackRow[] = [];
  let from = 0;

  while (true) {
    const baseQuery = supabase
      .from("user_feedback")
      .select(
        "id,user_id,message,page_path,source,status,admin_note,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .range(from, from + chunkSize - 1);

    const { data, error } = await applyFeedbackFilters(baseQuery, filters);

    if (error) {
      throw error;
    }

    const chunk = (data ?? []) as FeedbackRow[];

    if (chunk.length === 0) {
      break;
    }

    rows.push(...chunk);

    if (chunk.length < chunkSize) {
      break;
    }

    from += chunkSize;
  }

  return rows;
}

export async function enrichFeedbackRowsWithEmail(
  supabase: AdminClient,
  rows: FeedbackRow[],
): Promise<FeedbackItem[]> {
  if (rows.length === 0) {
    return [];
  }

  const uniqueUserIds = [...new Set(rows.map((row) => row.user_id))];
  const profileByUserId = new Map<string, { email: string | null; phone: string | null }>();

  // Try to select phone; fall back gracefully if the column doesn't exist yet.
  const { data: profilesWithPhone, error: phoneError } = await supabase
    .from("profiles")
    .select("id,email,phone")
    .in("id", uniqueUserIds);

  let profiles: Array<{ id: string; email: string | null; phone?: string | null }>;

  if (phoneError) {
    const { data: profilesBasic, error: basicError } = await supabase
      .from("profiles")
      .select("id,email")
      .in("id", uniqueUserIds);

    if (basicError) {
      throw basicError;
    }

    profiles = (profilesBasic ?? []).map((p) => ({ ...p, phone: null }));
  } else {
    profiles = (profilesWithPhone ?? []).map((p) => ({
      ...p,
      phone: (p as { phone?: string | null }).phone ?? null,
    }));
  }

  for (const profile of profiles) {
    profileByUserId.set(profile.id, {
      email: profile.email ?? null,
      phone: profile.phone ?? null,
    });
  }

  return rows.map((row) => ({
    ...row,
    type: getFeedbackTypeFromSource(row.source),
    status: FEEDBACK_STATUS_SET.has(row.status as FeedbackStatus)
      ? (row.status as FeedbackStatus)
      : "new",
    user_email: profileByUserId.get(row.user_id)?.email ?? null,
    user_phone: profileByUserId.get(row.user_id)?.phone ?? null,
  }));
}

export function isValidFeedbackStatus(value: string): value is FeedbackStatus {
  return FEEDBACK_STATUS_SET.has(value as FeedbackStatus);
}

export function escapeCsvValue(value: string | null | undefined): string {
  const normalized = String(value ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${normalized}"`;
}

function normalizeDateInput(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return value;
}

function getExclusiveEndDate(endDate: string): string {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}
