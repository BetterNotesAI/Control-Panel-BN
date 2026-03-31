import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { AdminKpis } from "@/types/admin";
import type { Database } from "@/types/database";

interface CountFilter {
  column: string;
  operator: "eq" | "gte";
  value: string;
}

type CountableTable = keyof Database["public"]["Tables"];

async function countRows(table: CountableTable, filter?: CountFilter): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });

  if (filter) {
    if (filter.operator === "eq") {
      query = query.eq(filter.column, filter.value);
    } else {
      query = query.gte(filter.column, filter.value);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function GET() {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      totalUsers,
      usersLast7Days,
      totalDocuments,
      totalProblemSolverSessions,
      feedbackTotal,
      feedbackNew,
    ] = await Promise.all([
      countRows("profiles"),
      countRows("profiles", {
        column: "created_at",
        operator: "gte",
        value: sevenDaysAgo,
      }),
      countRows("documents"),
      countRows("problem_solver_sessions"),
      countRows("user_feedback"),
      countRows("user_feedback", {
        column: "status",
        operator: "eq",
        value: "new",
      }),
    ]);

    const response: AdminKpis = {
      totalUsers,
      usersLast7Days,
      totalDocuments,
      totalProblemSolverSessions,
      feedbackTotal,
      feedbackNew,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load KPIs.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
