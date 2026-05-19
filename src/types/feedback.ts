export const FEEDBACK_STATUSES = [
  "new",
  "reviewed",
  "planned",
  "done",
  "dismissed",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPES = ["suggestion", "faculty"] as const;

export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FACULTY_FEEDBACK_SOURCE = "faculty";

export function getFeedbackTypeFromSource(source: string | null | undefined): FeedbackType {
  return source === FACULTY_FEEDBACK_SOURCE ? "faculty" : "suggestion";
}

export function getFeedbackTypeLabel(type: FeedbackType): string {
  return type === "faculty" ? "Faculty" : "Suggestion";
}

export interface FeedbackItem {
  id: string;
  user_id: string;
  message: string;
  page_path: string | null;
  source: string;
  type: FeedbackType;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  user_email: string | null;
  user_phone: string | null;
}

export interface FeedbackFilters {
  status: "all" | FeedbackStatus;
  type: "all" | FeedbackType;
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
