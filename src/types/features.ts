export interface FeatureUsageItem {
  feature: string;
  event_count: number;
  unique_users: number;
  total_tokens: number;
  total_credits: number;
  first_used_at: string | null;
  last_used_at: string | null;
}

export interface FeaturesResponse {
  generatedAt: string;
  totalEvents: number;
  totalTokens: number;
  features: FeatureUsageItem[];
}
