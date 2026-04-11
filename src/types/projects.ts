export const PROJECT_TYPES = ["cheat_sheet", "problem_solver", "exam"] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export interface ProjectFilters {
  startDate: string;
  endDate: string;
  projectType: "all" | ProjectType;
  userEmail: string;
  status: string;
}

export interface ProjectsKpis {
  totalProjects: number;
  totalCreditsConsumed: number;
  totalTokens: number;
  activeUsers: number;
}

export interface ProjectListItem {
  project_id: string;
  project_type: string;
  title: string | null;
  user_email: string | null;
  status: string | null;
  created_at: string;
  total_credits: number;
  total_tokens: number;
  models_used_count: number;
  models_used: string[];
}

export interface ProjectsListResponse {
  filters: ProjectFilters;
  kpis: ProjectsKpis;
  projects: ProjectListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ProjectSummary {
  totalCredits: number;
  totalTokens: number;
  totalEvents: number;
}

export interface ProjectMetadata {
  project_id: string;
  project_type: string;
  title: string | null;
  status: string | null;
  subtype: string | null;
  source_table: string | null;
  user_id: string | null;
  user_email: string | null;
  user_display_name: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProjectSeriesPoint {
  date: string;
  total_tokens: number;
  total_credits: number;
}

export interface ProjectFeatureBreakdownItem {
  feature: string | null;
  total_tokens: number;
  total_credits: number;
  event_count: number;
}

export interface ProjectModelBreakdownItem {
  provider: string;
  model: string;
  total_tokens: number;
  total_credits: number;
  event_count: number;
}

export interface ProjectUsageEventItem {
  usage_event_id: string;
  created_at: string;
  feature: string | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_credits: number;
}

export interface ProjectDetailResponse {
  filters: ProjectFilters;
  project: ProjectMetadata;
  summary: ProjectSummary;
  series: ProjectSeriesPoint[];
  breakdownByFeature: ProjectFeatureBreakdownItem[];
  breakdownByModel: ProjectModelBreakdownItem[];
  events: {
    items: ProjectUsageEventItem[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ProjectUserUsageItem {
  user_id: string;
  user_email: string | null;
  user_display_name: string | null;
  project_type: string | null;
  feature: string | null;
  provider: string;
  model: string;
  event_count: number;
  total_tokens: number;
  total_credits: number;
  first_event_at: string | null;
  last_event_at: string | null;
}

export interface ProjectUserUsageResponse {
  filters: ProjectFilters;
  items: ProjectUserUsageItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
