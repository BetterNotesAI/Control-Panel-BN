export interface AffiliateCode {
  id: string;
  code: string;
  influencer_name: string;
  influencer_email: string | null;
  stripe_coupon_id: string;
  campaign_ends_at: string;
  payout_per_user_cents: number;
  created_at: string;
  signup_count: number;
  conversion_count: number;
}

export interface AffiliateCodesResponse {
  affiliate_codes: AffiliateCode[];
}

export interface CreateAffiliateCodeBody {
  code: string;
  influencer_name: string;
  influencer_email?: string;
  campaign_days?: number;
  payout_per_user_cents?: number;
}
