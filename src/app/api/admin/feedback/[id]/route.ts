import { NextResponse } from "next/server";
import {
  enrichFeedbackRowsWithEmail,
  isValidFeedbackStatus,
} from "@/lib/admin/feedback";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { FeedbackPatchPayload } from "@/types/feedback";
import type { Database } from "@/types/database";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const payload = (await request.json()) as FeedbackPatchPayload;
  const updates: Database["public"]["Tables"]["user_feedback"]["Update"] = {};

  if (payload.status !== undefined) {
    if (!isValidFeedbackStatus(payload.status)) {
      return NextResponse.json({ error: "Invalid feedback status." }, { status: 400 });
    }

    updates.status = payload.status;
  }

  if (payload.admin_note !== undefined) {
    updates.admin_note = payload.admin_note.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields provided to update." },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdminClient();
  const { id } = await context.params;

  try {
    const { data, error } = await supabase
      .from("user_feedback")
      .update(updates)
      .eq("id", id)
      .select(
        "id,user_id,message,page_path,source,status,admin_note,created_at,updated_at",
      )
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ error: "Feedback entry not found." }, { status: 404 });
    }

    const [item] = await enrichFeedbackRowsWithEmail(supabase, [data]);

    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update feedback.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
