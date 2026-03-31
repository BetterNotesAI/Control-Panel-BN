import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { ActivityPoint, ActivityResponse } from "@/types/admin";

type ActivityTable = "documents" | "problem_solver_sessions";

async function fetchCreatedAtByRange(
  table: ActivityTable,
  startIso: string,
  endIso: string,
): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const pageSize = 1000;
  const values: string[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const createdAt = (row as { created_at?: string }).created_at;

      if (createdAt) {
        values.push(createdAt);
      }
    }

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return values;
}

function normalizeRange(value: string | null): "7d" | "30d" {
  return value === "30d" ? "30d" : "7d";
}

function buildEmptyBuckets(days: number): Map<string, ActivityPoint> {
  const buckets = new Map<string, ActivityPoint>();

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const current = new Date(start);
    current.setUTCDate(start.getUTCDate() + index);

    const key = current.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      documents: 0,
      problemSolverSessions: 0,
    });
  }

  return buckets;
}

function addToBucket(
  buckets: Map<string, ActivityPoint>,
  dateTime: string,
  field: "documents" | "problemSolverSessions",
) {
  const key = new Date(dateTime).toISOString().slice(0, 10);
  const bucket = buckets.get(key);

  if (bucket) {
    bucket[field] += 1;
  }
}

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const range = normalizeRange(url.searchParams.get("range"));
  const days = range === "30d" ? 30 : 7;

  const startDate = new Date();
  startDate.setUTCHours(0, 0, 0, 0);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  const endDate = new Date();
  endDate.setUTCHours(23, 59, 59, 999);

  try {
    const [documents, problemSolverSessions] = await Promise.all([
      fetchCreatedAtByRange("documents", startDate.toISOString(), endDate.toISOString()),
      fetchCreatedAtByRange(
        "problem_solver_sessions",
        startDate.toISOString(),
        endDate.toISOString(),
      ),
    ]);

    const buckets = buildEmptyBuckets(days);

    for (const value of documents) {
      addToBucket(buckets, value, "documents");
    }

    for (const value of problemSolverSessions) {
      addToBucket(buckets, value, "problemSolverSessions");
    }

    const points = [...buckets.values()];

    const response: ActivityResponse = {
      range,
      points,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load activity.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
