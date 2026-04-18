import { NextResponse } from "next/server";
import {
  pickPreferredAvatarUrl,
  readNumber,
  resolveEffectivePlan,
  roundTo,
} from "@/lib/admin/users";
import { requireAdminForApi } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";
import type { AdminUserItem, UsersListResponse } from "@/types/users";

function normalizeProjectType(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  return "unknown";
}

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

    const profileIds = (profiles ?? []).map((row) => row.id);

    const subscriptionMap = new Map<string, { plan: string | null }>();
    const projectCountsByUser = new Map<
      string,
      { totalProjects: number; projectCountByType: Map<string, number> }
    >();
    const usageByUser = new Map<
      string,
      {
        totalTokens: number;
        totalCredits: number;
        usageByType: Map<string, { totalTokens: number; totalCredits: number }>;
      }
    >();

    if (profileIds.length > 0) {
      const [subscriptionsResult, projectsResult, usageResult] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("user_id,plan,status,current_period_end,updated_at,created_at")
          .in("user_id", profileIds)
          .in("status", ["active", "trialing", "past_due"])
          .order("user_id", { ascending: true })
          .order("current_period_end", { ascending: false, nullsFirst: false })
          .order("updated_at", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("analytics_projects_v")
          .select("user_id,project_type,project_id")
          .in("user_id", profileIds),
        supabase
          .from("analytics_ai_usage_by_project_v")
          .select("user_id,project_type,total_tokens,total_credits")
          .in("user_id", profileIds),
      ]);

      if (subscriptionsResult.error) {
        throw subscriptionsResult.error;
      }

      if (projectsResult.error) {
        throw projectsResult.error;
      }

      if (usageResult.error) {
        throw usageResult.error;
      }

      for (const row of subscriptionsResult.data ?? []) {
        if (!subscriptionMap.has(row.user_id)) {
          subscriptionMap.set(row.user_id, {
            plan: row.plan,
          });
        }
      }

      for (const row of projectsResult.data ?? []) {
        const projectType = normalizeProjectType(row.project_type);
        const existing = projectCountsByUser.get(row.user_id) ?? {
          totalProjects: 0,
          projectCountByType: new Map<string, number>(),
        };

        existing.totalProjects += 1;
        existing.projectCountByType.set(
          projectType,
          (existing.projectCountByType.get(projectType) ?? 0) + 1,
        );

        projectCountsByUser.set(row.user_id, existing);
      }

      for (const row of usageResult.data ?? []) {
        const projectType = normalizeProjectType(row.project_type);
        const totalTokens = readNumber(row.total_tokens);
        const totalCredits = readNumber(row.total_credits);
        const existing = usageByUser.get(row.user_id) ?? {
          totalTokens: 0,
          totalCredits: 0,
          usageByType: new Map<string, { totalTokens: number; totalCredits: number }>(),
        };
        const byType = existing.usageByType.get(projectType) ?? {
          totalTokens: 0,
          totalCredits: 0,
        };

        existing.totalTokens += totalTokens;
        existing.totalCredits += totalCredits;
        byType.totalTokens += totalTokens;
        byType.totalCredits += totalCredits;

        existing.usageByType.set(projectType, byType);
        usageByUser.set(row.user_id, existing);
      }
    }

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
      const projectStats = projectCountsByUser.get(row.id);
      const usageStats = usageByUser.get(row.id);
      const typeNames = new Set<string>([
        ...(projectStats?.projectCountByType.keys() ?? []),
        ...(usageStats?.usageByType.keys() ?? []),
      ]);
      const projectTypeBreakdown = Array.from(typeNames)
        .map((typeName) => ({
          project_type: typeName,
          project_count: projectStats?.projectCountByType.get(typeName) ?? 0,
          total_tokens: Math.round(usageStats?.usageByType.get(typeName)?.totalTokens ?? 0),
          total_credits: roundTo(
            usageStats?.usageByType.get(typeName)?.totalCredits ?? 0,
            4,
          ),
        }))
        .sort((left, right) => {
          if (right.project_count !== left.project_count) {
            return right.project_count - left.project_count;
          }

          if (right.total_tokens !== left.total_tokens) {
            return right.total_tokens - left.total_tokens;
          }

          return left.project_type.localeCompare(right.project_type);
        });

      return {
        id: row.id,
        email: row.email ?? null,
        full_name:
          typeof record.display_name === "string"
            ? record.display_name
            : typeof record.full_name === "string"
              ? record.full_name
            : (auth?.full_name ?? null),
        avatar_url:
          pickPreferredAvatarUrl({
            profileAvatar: record.avatar_url,
            authAvatar: auth?.avatar_url ?? null,
          }),
        plan: resolveEffectivePlan({
          subscriptionPlan: subscriptionMap.get(row.id)?.plan,
          profilePlan: typeof record.plan === "string" ? record.plan : null,
        }),
        created_at: row.created_at ?? new Date().toISOString(),
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        stats: {
          total_projects: projectStats?.totalProjects ?? 0,
          total_tokens: Math.round(usageStats?.totalTokens ?? 0),
          total_credits: roundTo(usageStats?.totalCredits ?? 0, 4),
          project_type_breakdown: projectTypeBreakdown,
        },
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
