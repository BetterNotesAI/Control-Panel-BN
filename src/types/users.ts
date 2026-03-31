export interface AdminUserItem {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface UsersListResponse {
  users: AdminUserItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
