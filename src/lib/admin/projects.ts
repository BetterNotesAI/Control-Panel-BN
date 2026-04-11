import type { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { PROJECT_TYPES, type ProjectFilters, type ProjectType } from "@/types/projects";

type AdminClient = ReturnType<typeof getSupabaseAdminClient>;

const PROJECT_TYPE_SET = new Set<string>(PROJECT_TYPES);

interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

interface DateRangeQuery {
  gte: (column: string, value: string) => DateRangeQuery;
  lt: (column: string, value: string) => DateRangeQuery;
}

interface UserIdRow {
  id: string;
}

export function parseProjectFilters(searchParams: URLSearchParams): ProjectFilters {
  const projectTypeRaw = searchParams.get("projectType");
  const startDateRaw = searchParams.get("startDate");
  const endDateRaw = searchParams.get("endDate");
  const userEmailRaw = searchParams.get("userEmail");
  const statusRaw = searchParams.get("status");

  return {
    startDate: normalizeDateInput(startDateRaw) ?? "",
    endDate: normalizeDateInput(endDateRaw) ?? "",
    projectType: normalizeProjectType(projectTypeRaw),
    userEmail: normalizeString(userEmailRaw),
    status: normalizeString(statusRaw).toLowerCase(),
  };
}

export function parsePagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): {
  page: number;
  pageSize: number;
  from: number;
  to: number;
} {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const maxPageSize = options.maxPageSize ?? 100;

  const pageRaw = Number(searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(searchParams.get("pageSize") ?? String(defaultPageSize));

  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(maxPageSize, Math.floor(pageSizeRaw))
      : defaultPageSize;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return {
    page,
    pageSize,
    from,
    to,
  };
}

export function applyUtcDateRange<T extends DateRangeQuery>(
  query: T,
  column: string,
  startDate: string,
  endDate: string,
): T {
  let nextQuery: DateRangeQuery = query;

  if (startDate) {
    nextQuery = nextQuery.gte(column, `${startDate}T00:00:00.000Z`);
  }

  if (endDate) {
    nextQuery = nextQuery.lt(column, getExclusiveEndDate(endDate));
  }

  return nextQuery as T;
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

export function normalizeString(value: string | null): string {
  return value?.trim() ?? "";
}

export function normalizeProjectType(value: string | null): "all" | ProjectType {
  const normalized = normalizeString(value).toLowerCase();
  if (PROJECT_TYPE_SET.has(normalized)) {
    return normalized as ProjectType;
  }

  return "all";
}

export function isSupportedProjectType(value: string | null | undefined): value is ProjectType {
  return typeof value === "string" && PROJECT_TYPE_SET.has(value);
}

export function normalizeDateInput(value: string | null): string | undefined {
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

export function getExclusiveEndDate(endDate: string): string {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

export function buildProjectKey(projectType: string | null, projectId: string | null): string | null {
  if (!projectType || !projectId) {
    return null;
  }

  return `${projectType}:${projectId}`;
}

export function formatProjectTitle(title: string | null | undefined): string {
  const normalized = normalizeNullableString(title);
  return normalized ?? "Untitled project";
}

export function toUtcDateKey(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function toReadableProjectType(value: string | null | undefined): string {
  if (!value) {
    return "unknown";
  }

  return value.replace(/_/g, " ");
}

export async function resolveUserIdsByEmailFilter(
  supabase: AdminClient,
  userEmail: string,
): Promise<string[] | null> {
  const normalized = userEmail.trim();

  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", `%${normalized}%`)
    .limit(5000)
    .returns<UserIdRow[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => row.id);
}

export async function fetchUserEmailMap(
  supabase: AdminClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();

  if (userIds.length === 0) {
    return map;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email")
    .in("id", userIds);

  if (error) {
    throw error;
  }

  for (const row of data ?? []) {
    map.set(row.id, row.email ?? null);
  }

  return map;
}

export function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/"/g, '""');
  return `"${normalized}"`;
}
