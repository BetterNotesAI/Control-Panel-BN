export interface CostPeriod {
  cost_usd: number;
  event_count: number;
}

export interface RevenuePeriod {
  gross_usd: number;
  charge_count: number;
}

export interface FeatureCost {
  feature: string;
  cost_usd: number;
  event_count: number;
  is_anonymous: boolean; // true if this feature is only used by anon users (heuristic: latex_converter_free)
}

export interface CostsIncomeResponse {
  generatedAt: string;
  costs: {
    allTime: CostPeriod;
    last7d: CostPeriod;
    last30d: CostPeriod;
    thisMonth: CostPeriod;
    byFeature: FeatureCost[];
    anonymous: CostPeriod;   // cost attributed to anonymous/landing-page users
    registered: CostPeriod;  // cost attributed to registered users
  };
  revenue: {
    last7d: RevenuePeriod;
    last30d: RevenuePeriod;
    thisMonth: RevenuePeriod;
    mrrCents: number;           // sum of active subscription amounts (cents)
    activeSubscriptions: number;
  };
  margin: {
    last7d: number;   // revenue - cost (USD)
    last30d: number;
    thisMonth: number;
  };
}
