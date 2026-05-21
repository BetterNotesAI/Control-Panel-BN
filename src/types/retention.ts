export interface RetentionMetrics {
  window: "7d" | "30d";
  cohortSize: number;
  returned: number;
  retentionRate: number;
}

export interface RetentionTopUser {
  user_id: string;
  email: string | null;
  plan: string;
  total_projects: number;
  total_tokens: number;
  first_activity_at: string;
  last_activity_at: string;
}

export interface JourneyUser {
  user_id: string;
  email: string | null;
  plan: string;
  signed_up_at: string | null;
  first_activity_at: string | null;
  last_activity_at: string | null;
  total_projects: number;
  days_since: number | null;
}

export type JourneySegmentKey =
  | "unconfirmed"
  | "no_content"
  | "one_day"
  | "retained"
  | "premium";

export interface JourneySegment {
  key: JourneySegmentKey;
  label: string;
  description: string;
  count: number;
  percentage: number;
  users: JourneyUser[];
}

export interface RetentionResponse {
  generatedAt: string;
  totalUsers: number;
  retention7d: RetentionMetrics;
  retention30d: RetentionMetrics;
  journey: JourneySegment[];
  topUsers: RetentionTopUser[];
}
