import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import { getStripeClient } from "@/lib/stripe";

const DEFAULT_CAMPAIGN_DAYS = 30;
const DEFAULT_PAYOUT_PER_USER_CENTS = 100;

export async function GET() {
  const authResult = await requireAdminForApi();
  if ("error" in authResult) return authResult.error;

  const supabase = getSupabaseAdminClient();

  const { data: codes, error } = await supabase
    .from("affiliate_codes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // For each code, fetch signup_count (all redemptions) and conversion_count (cleared redemptions)
  const affiliateCodes = await Promise.all(
    (codes ?? []).map(async (c) => {
      const { count: signupCount } = await supabase
        .from("referral_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("code", c.code)
        .eq("code_type", "affiliate");

      const { count: conversionCount } = await supabase
        .from("referral_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("code", c.code)
        .eq("code_type", "affiliate")
        .eq("payout_status", "cleared");

      return {
        ...c,
        signup_count: signupCount ?? 0,
        conversion_count: conversionCount ?? 0,
      };
    }),
  );

  return NextResponse.json({ affiliate_codes: affiliateCodes });
}

export async function POST(req: NextRequest) {
  const authResult = await requireAdminForApi();
  if ("error" in authResult) return authResult.error;

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    influencer_name?: string;
    influencer_email?: string;
    campaign_days?: number;
    payout_per_user_cents?: number;
  };

  if (!body.code || !body.influencer_name) {
    return NextResponse.json({ error: "code and influencer_name are required" }, { status: 400 });
  }

  const code = body.code.trim().toUpperCase();
  if (code.length < 3 || code.length > 20) {
    return NextResponse.json({ error: "code must be 3–20 characters" }, { status: 400 });
  }

  const campaignDays = body.campaign_days ?? DEFAULT_CAMPAIGN_DAYS;
  const payoutPerUserCents = body.payout_per_user_cents ?? DEFAULT_PAYOUT_PER_USER_CENTS;

  const campaignEndsAt = new Date(Date.now() + campaignDays * 24 * 60 * 60 * 1000).toISOString();

  // Create Stripe coupon — 50% off, once
  const stripe = getStripeClient();
  let coupon: { id: string };
  try {
    coupon = await stripe.coupons.create({
      percent_off: 50,
      duration: "once",
      name: `${body.influencer_name} – 50% off first payment`,
      metadata: { affiliate_code: code },
    });
  } catch (stripeErr) {
    const msg = stripeErr instanceof Error ? stripeErr.message : "Stripe coupon creation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("affiliate_codes")
    .insert({
      code,
      influencer_name: body.influencer_name,
      influencer_email: body.influencer_email ?? null,
      stripe_coupon_id: coupon.id,
      campaign_ends_at: campaignEndsAt,
      payout_per_user_cents: payoutPerUserCents,
    })
    .select()
    .single();

  if (error) {
    // Attempt to clean up the Stripe coupon if DB insert failed
    await stripe.coupons.del(coupon.id).catch(() => undefined);
    if (error.message.includes("duplicate") || error.message.includes("unique")) {
      return NextResponse.json({ error: "An affiliate code with that name already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ affiliate_code: data }, { status: 201 });
}
