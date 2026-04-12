export interface AdminKpis {
  totalUsers: number;
  usersLast7Days: number;
  totalDocuments: number;
  totalProblemSolverSessions: number;
  feedbackTotal: number;
  feedbackNew: number;
}

export interface SupabaseQuotaMetric {
  usedBytes: number | null;
  limitBytes: number | null;
  remainingBytes: number | null;
  usagePercent: number | null;
}

export interface SupabaseBucketUsage {
  bucketId: string;
  bucketName: string;
  objectCount: number;
  usedBytes: number;
  usedSharePercent: number;
}

export interface SupabaseUsageResponse {
  generatedAt: string;
  plan: {
    name: string;
    source: "env" | "unknown";
  };
  quotas: {
    database: SupabaseQuotaMetric;
    storage: SupabaseQuotaMetric;
  };
  records: {
    profiles: number;
    documents: number;
    problemSolverSessions: number;
    userFeedback: number;
    total: number;
  };
  storage: {
    totalBuckets: number;
    totalObjects: number;
    scannedObjects: number;
    scanTruncated: boolean;
    totalUsedBytes: number;
    documentsUsedBytes: number;
    documentsObjectCount: number;
    documentBucketIds: string[];
    topBuckets: SupabaseBucketUsage[];
  };
  notes: string[];
}

export interface ActivityPoint {
  date: string;
  documents: number;
  problemSolverSessions: number;
}

export interface ActivityResponse {
  range: "7d" | "30d";
  points: ActivityPoint[];
}
