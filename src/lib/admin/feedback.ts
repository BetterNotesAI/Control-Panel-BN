import {
  FEEDBACK_STATUSES,
  type FeedbackItem,
  type FeedbackStatus,
} from "@/types/feedback";
import type { Database } from "@/types/database";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

const FEEDBACK_STATUS_SET = new Set(FEEDBACK_STATUSES);

export interface FeedbackQueryFilters {
  status?: FeedbackStatus;
  source?: string;
  query?: string;
  startDate?: string;
  endDate?: string;
}

export type FeedbackRow = Database["public"]["Tables"]["user_feedback"]["Row"];

interface FeedbackFilterQuery {
  eq: (column: string, value: string) => FeedbackFilterQuery;
  ilike: (column: string, pattern: string) => FeedbackFilterQuery;
  gte: (column: string, value: string) => FeedbackFilterQuery;
  lt: (column: string, value: string) => FeedbackFilterQuery;
}

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

export function parseFeedbackFilters(searchParams: URLSearchParams): FeedbackQueryFilters {
  const statusRaw = searchParams.get("status")?.trim().toLowerCase();
  const sourceRaw = searchParams.get("source")?.trim();
  const queryRaw = searchParams.get("q")?.trim();
  const startDateRaw = searchParams.get("startDate")?.trim();
  const endDateRaw = searchParams.get("endDate")?.trim();

  return {
    status:
      statusRaw && FEEDBACK_STATUS_SET.has(statusRaw as FeedbackStatus)
        ? (statusRaw as FeedbackStatus)
        : undefined,
    source: sourceRaw || undefined,
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

  if (filters.source) {
    nextQuery = nextQuery.eq("source", filters.source);
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
  const emailByUserId = new Map<string, string | null>();

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", uniqueUserIds);

  if (error) {
    throw error;
  }

  for (const profile of profiles ?? []) {
    const id = profile.id;
    const email = profile.email ?? null;
    emailByUserId.set(id, email);
  }

  return rows.map((row) => ({
    ...row,
    status: FEEDBACK_STATUS_SET.has(row.status as FeedbackStatus)
      ? (row.status as FeedbackStatus)
      : "new",
    user_email: emailByUserId.get(row.user_id) ?? null,
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
