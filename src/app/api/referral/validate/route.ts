import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : null;

  if (!code) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }

  const supabase = getSupabaseAdminClient();

  // Check affiliate codes first
  const { data: affiliate } = await supabase
    .from("affiliate_codes")
    .select("code,influencer_name,campaign_ends_at")
    .eq("code", code)
    .maybeSingle();

  if (affiliate) {
    const expired = new Date(affiliate.campaign_ends_at) < new Date();
    if (expired) return NextResponse.json({ valid: false, reason: "expired" });
    return NextResponse.json({
      valid: true,
      type: "affiliate",
      label: `${affiliate.influencer_name}'s code`,
    });
  }

  // Check friend/referral codes
  const { data: referral } = await supabase
    .from("referral_codes")
    .select("code")
    .eq("code", code)
    .maybeSingle();

  if (referral) {
    return NextResponse.json({ valid: true, type: "friend", label: "Friend referral" });
  }

  return NextResponse.json({ valid: false, reason: "not_found" });
}
