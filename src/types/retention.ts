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

export interface RetentionOneTimeUser {
  user_id: string;
  email: string | null;
  plan: string;
  only_activity_at: string;
  days_since: number;
}

export interface RetentionResponse {
  generatedAt: string;
  totalUsersWithActivity: number;
  retention7d: RetentionMetrics;
  retention30d: RetentionMetrics;
  topUsers: RetentionTopUser[];
  oneTimeUsers: RetentionOneTimeUser[];
}
