import { getAdminAllowlist } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  return getAdminAllowlist().includes(normalized);
}

function isPrivilegedRole(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const role = value.trim().toLowerCase();
  return role === "admin" || role === "superadmin";
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  if (error.code === "42703") {
    return true;
  }

  return Boolean(error.message?.toLowerCase().includes("admin_role"));
}

type ProfileAdminRecord = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "admin_role" | "email"
>;

export async function isUserAuthorizedForAdmin(user: {
  id: string;
  email?: string | null;
}): Promise<boolean> {
  if (isAdminEmail(user.email)) {
    return true;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("admin_role,email")
    .eq("id", user.id)
    .maybeSingle<ProfileAdminRecord>();

  if (error) {
    if (isMissingColumnError(error)) {
      return isAdminEmail(user.email);
    }

    return false;
  }

  if (!data) {
    return isAdminEmail(user.email);
  }

  if (isPrivilegedRole(data.admin_role)) {
    return true;
  }

  return isAdminEmail(data.email ?? user.email);
}
