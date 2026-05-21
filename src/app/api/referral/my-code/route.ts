import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { generateCode, SHARE_BASE_URL } from "@/lib/referral";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();

  // Check for existing code
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ code: existing.code, share_url: SHARE_BASE_URL + existing.code });
  }

  // Lazily create — retry on collision (extremely unlikely with 9-char code space)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error } = await supabase
      .from("referral_codes")
      .insert({ user_id: user.id, code });

    if (!error) {
      return NextResponse.json({ code, share_url: SHARE_BASE_URL + code });
    }

    // If duplicate code collision, retry; otherwise propagate
    if (!error.message.includes("duplicate") && !error.message.includes("unique")) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Could not generate a unique code. Please retry." }, { status: 500 });
}
