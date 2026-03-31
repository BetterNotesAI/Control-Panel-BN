import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { Database } from "@/types/database";

function isAdminRole(value?: string | null): boolean {
  if (!value) {
    return false;
  }

  const role = value.trim().toLowerCase();
  return role === "admin";
}

type ProfileAdminRecord = Pick<
  Database["public"]["Tables"]["profiles"]["Row"], "admin_role"
>;

export async function isUserAuthorizedForAdmin(user: {
  id: string;
}): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("admin_role")
    .eq("id", user.id)
    .maybeSingle<ProfileAdminRecord>();

  if (error) {
    return false;
  }

  if (!data) {
    return false;
  }

  return isAdminRole(data.admin_role);
}
