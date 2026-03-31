import { NextResponse } from "next/server";
import {
  escapeCsvValue,
  fetchAllFeedbackRows,
  parseFeedbackFilters,
  enrichFeedbackRowsWithEmail,
} from "@/lib/admin/feedback";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const filters = parseFeedbackFilters(url.searchParams);
  const supabase = getSupabaseAdminClient();

  try {
    const rows = await fetchAllFeedbackRows(supabase, filters);
    const items = await enrichFeedbackRowsWithEmail(supabase, rows);

    const header = [
      "id",
      "created_at",
      "updated_at",
      "user_id",
      "user_email",
      "source",
      "status",
      "page_path",
      "message",
      "admin_note",
    ];

    const lines = [header.join(",")];

    for (const item of items) {
      lines.push(
        [
          escapeCsvValue(item.id),
          escapeCsvValue(item.created_at),
          escapeCsvValue(item.updated_at),
          escapeCsvValue(item.user_id),
          escapeCsvValue(item.user_email),
          escapeCsvValue(item.source),
          escapeCsvValue(item.status),
          escapeCsvValue(item.page_path),
          escapeCsvValue(item.message),
          escapeCsvValue(item.admin_note),
        ].join(","),
      );
    }

    const csvContent = lines.join("\n");
    const filename = `feedback-export-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"${filename}\"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export feedback.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
