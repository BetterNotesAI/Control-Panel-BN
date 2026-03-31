export const FEEDBACK_STATUSES = [
  "new",
  "reviewed",
  "planned",
  "done",
  "dismissed",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export interface FeedbackItem {
  id: string;
  user_id: string;
  message: string;
  page_path: string | null;
  source: string;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_email: string | null;
}

export interface FeedbackFilters {
  status: "all" | FeedbackStatus;
  source: string;
  query: string;
  startDate: string;
  endDate: string;
}

export interface FeedbackListResponse {
  items: FeedbackItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface FeedbackPatchPayload {
  status?: FeedbackStatus;
  admin_note?: string;
}
