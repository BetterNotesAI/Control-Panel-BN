import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

const FRIEND_REFERRAL_CREDITS = 20;

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : null;

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();

  // Check for existing redemption (one per user)
  const { data: existing } = await supabase
    .from("referral_redemptions")
    .select("id")
    .eq("redeemer_user_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You have already redeemed a referral code." }, { status: 409 });
  }

  // Resolve code type
  const { data: affiliate } = await supabase
    .from("affiliate_codes")
    .select("code,campaign_ends_at")
    .eq("code", code)
    .maybeSingle();

  const { data: referral } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("code", code)
    .maybeSingle();

  if (!affiliate && !referral) {
    return NextResponse.json({ error: "Invalid referral code." }, { status: 404 });
  }

  const codeType: "affiliate" | "friend" = affiliate ? "affiliate" : "friend";

  if (affiliate && new Date(affiliate.campaign_ends_at) < new Date()) {
    return NextResponse.json({ error: "This affiliate code has expired." }, { status: 410 });
  }

  // Insert redemption
  const { error: insertError } = await supabase.from("referral_redemptions").insert({
    redeemer_user_id: user.id,
    code,
    code_type: codeType,
    payout_status: codeType === "affiliate" ? "pending" : null,
  });

  if (insertError) {
    if (insertError.message.includes("duplicate") || insertError.message.includes("unique")) {
      return NextResponse.json({ error: "You have already redeemed a referral code." }, { status: 409 });
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Friend code: grant 20 credits to redeemer immediately
  if (codeType === "friend") {
    await supabase.rpc("grant_credits", {
      p_user_id: user.id,
      p_amount: FRIEND_REFERRAL_CREDITS,
      p_reason: "friend_referral_redeemer",
    });
  }

  return NextResponse.json({ success: true, type: codeType });
}
