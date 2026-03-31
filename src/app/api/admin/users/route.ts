import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { AdminUserItem, UsersListResponse } from "@/types/users";

export async function GET(request: Request) {
  const authResult = await requireAdminForApi();

  if ("error" in authResult) {
    return authResult.error;
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const pageRaw = Number(url.searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(url.searchParams.get("pageSize") ?? "20");

  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw >= 1
      ? Math.min(100, Math.floor(pageSizeRaw))
      : 20;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const supabase = getSupabaseAdminClient();

  try {
    let query = supabase
      .from("profiles")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike("email", `%${search}%`);
    }

    const { data: profiles, error, count } = await query;

    if (error) {
      throw error;
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);

    // Enrich with auth metadata (avatars, names, last sign-in)
    const authMap = new Map<
      string,
      { full_name: string | null; avatar_url: string | null; last_sign_in_at: string | null }
    >();

    try {
      const { data: authData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      for (const u of authData?.users ?? []) {
        authMap.set(u.id, {
          full_name: (u.user_metadata?.full_name as string) ?? null,
          avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        });
      }
    } catch {
      // Auth enrichment is optional — profiles data is enough
    }

    const users: AdminUserItem[] = (profiles ?? []).map((row) => {
      const record = row as Record<string, unknown>;
      const auth = authMap.get(row.id);

      return {
        id: row.id,
        email: row.email ?? null,
        full_name:
          typeof record.full_name === "string"
            ? record.full_name
            : (auth?.full_name ?? null),
        avatar_url:
          typeof record.avatar_url === "string"
            ? record.avatar_url
            : (auth?.avatar_url ?? null),
        plan:
          typeof record.plan === "string"
            ? record.plan
            : typeof record.subscription_plan === "string"
              ? (record.subscription_plan as string)
              : null,
        created_at: row.created_at ?? new Date().toISOString(),
        last_sign_in_at: auth?.last_sign_in_at ?? null,
      };
    });

    const response: UsersListResponse = {
      users,
      page,
      pageSize,
      total,
      totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load users.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
