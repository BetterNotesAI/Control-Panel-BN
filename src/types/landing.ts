export interface LandingFeatureStat {
  feature: string;
  event_count: number;
  unique_users: number;
  total_tokens: number;
}

export interface LandingRecentSession {
  user_id: string;
  created_at: string;
  event_count: number;
  features: string[];
  total_tokens: number;
  last_event_at: string | null;
}

export interface LandingPageResponse {
  generatedAt: string;
  anonymousSessions: {
    total: number;
    today: number;
    last7d: number;
    last30d: number;
  };
  contentGenerated: {
    totalEvents: number;
    uniqueActiveUsers: number;
    featureBreakdown: LandingFeatureStat[];
  };
  conversion: {
    newRealSignups7d: number;
    newRealSignups30d: number;
    estimatedRate7d: number | null;
    estimatedRate30d: number | null;
  };
  recentSessions: LandingRecentSession[];
}
