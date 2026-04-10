export type UserPlanTier = "free" | "better" | "best";

export interface AdminUserItem {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: UserPlanTier;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface UsersListResponse {
  users: AdminUserItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface UserUsageSummary {
  credits_used: number;
  credits_limit: number;
  credits_remaining: number;
  usd_used: number;
  usd_limit: number;
  usd_remaining: number;
  period_start: string;
  period_end: string;
}

export interface UserUsageEventItem {
  id: string;
  provider: string;
  model: string;
  feature: string | null;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost_usd: number;
  created_at: string;
}

export interface AdminUserDetail {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  short_bio: string | null;
  university: string | null;
  degree: string | null;
  profile_visibility: string | null;
  language: string | null;
  plan: UserPlanTier;
  subscription_status: string | null;
  billing_interval: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
  usage: UserUsageSummary;
  recent_usage_events: UserUsageEventItem[];
}

export interface UserDetailResponse {
  user: AdminUserDetail;
}
