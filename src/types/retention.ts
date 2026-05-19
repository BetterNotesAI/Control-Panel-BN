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

/** Signed up but never triggered any AI activity */
export interface RetentionNeverActiveUser {
  user_id: string;
  email: string | null;
  plan: string;
  signed_up_at: string;
  days_since_signup: number;
}

/** Had AI activity but hasn't returned in 7+ days */
export interface RetentionChurnedUser {
  user_id: string;
  email: string | null;
  plan: string;
  total_projects: number;
  last_activity_at: string;
  days_since: number;
}

export interface RetentionResponse {
  generatedAt: string;
  totalUsers: number;
  retention7d: RetentionMetrics;
  retention30d: RetentionMetrics;
  topUsers: RetentionTopUser[];
  neverActiveUsers: RetentionNeverActiveUser[];
  churnedUsers: RetentionChurnedUser[];
}
