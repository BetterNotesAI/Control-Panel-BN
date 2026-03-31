import { NextResponse } from "next/server";
import {
  applyFeedbackFilters,
  enrichFeedbackRowsWithEmail,
  parseFeedbackFilters,
  parsePagination,
} from "@/lib/admin/feedback";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { FeedbackListResponse } from "@/types/feedback";

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const filters = parseFeedbackFilters(url.searchParams);
  const { page, pageSize, from, to } = parsePagination(url.searchParams);

  const supabase = getSupabaseAdminClient();

  try {
    const baseQuery = supabase
      .from("user_feedback")
      .select(
        "id,user_id,message,page_path,source,status,admin_note,created_at,updated_at",
        {
          count: "exact",
        },
      )
      .order("created_at", { ascending: false })
      .range(from, to);

    const { data, error, count } = await applyFeedbackFilters(baseQuery, filters);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const items = await enrichFeedbackRowsWithEmail(supabase, rows);
    const total = count ?? 0;

    const response: FeedbackListResponse = {
      items,
      page,
      pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load feedback.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
