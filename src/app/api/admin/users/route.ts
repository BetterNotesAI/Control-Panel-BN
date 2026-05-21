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
    // redeemer_user_id → { type, label, redeemed_at }
    const referralMap = new Map<
      string,
      { type: "affiliate" | "friend"; label: string; redeemed_at: string }
    >();

    if (profileIds.length > 0) {
      const [subscriptionsResult, projectsResult, usageResult, redemptionsResult] =
        await Promise.all([
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
          supabase
            .from("referral_redemptions")
            .select("redeemer_user_id,code_type,referral_code_id,affiliate_code_id,redeemed_at")
            .in("redeemer_user_id", profileIds),
        ]);

      if (subscriptionsResult.error) throw subscriptionsResult.error;
      if (projectsResult.error) throw projectsResult.error;
      if (usageResult.error) throw usageResult.error;
      if (redemptionsResult.error) {
        console.error("[users] referral_redemptions query failed:", redemptionsResult.error.message);
      }

      const redemptions = redemptionsResult.data ?? [];

      // Collect IDs to resolve in bulk
      const affiliateCodeIds = [...new Set(
        redemptions.filter((r) => r.affiliate_code_id).map((r) => r.affiliate_code_id as string),
      )];
      const referralCodeIds = [...new Set(
        redemptions.filter((r) => r.referral_code_id).map((r) => r.referral_code_id as string),
      )];

      // Resolve affiliate names and referrer user IDs in parallel
      const [affiliateCodesResult, referralCodesResult] = await Promise.all([
        affiliateCodeIds.length > 0
          ? supabase
              .from("affiliate_codes")
              .select("id,influencer_name")
              .in("id", affiliateCodeIds)
          : Promise.resolve({ data: [], error: null }),
        referralCodeIds.length > 0
          ? supabase
              .from("referral_codes")
              .select("id,user_id")
              .in("id", referralCodeIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const affiliateNameById = new Map(
        (affiliateCodesResult.data ?? []).map((a) => [a.id, a.influencer_name]),
      );

      // Resolve referrer profiles (email/name) for friend codes
      const referrerUserIds = [...new Set(
        (referralCodesResult.data ?? []).map((rc) => rc.user_id),
      )];
      const referralCodeUserById = new Map(
        (referralCodesResult.data ?? []).map((rc) => [rc.id, rc.user_id]),
      );

      let referrerProfileById = new Map<string, string>(); // user_id → display label
      if (referrerUserIds.length > 0) {
        const { data: referrerProfiles } = await supabase
          .from("profiles")
          .select("id,email,display_name")
          .in("id", referrerUserIds);
        referrerProfileById = new Map(
          (referrerProfiles ?? []).map((p) => {
            const record = p as Record<string, unknown>;
            const label =
              typeof record.display_name === "string" && record.display_name
                ? record.display_name
                : (p.email ?? p.id);
            return [p.id, label];
          }),
        );
      }

      // Build the final referral map
      for (const row of redemptions) {
        if (referralMap.has(row.redeemer_user_id)) continue;

        const type = row.code_type as "affiliate" | "friend";
        let label = "Unknown";

        if (type === "affiliate" && row.affiliate_code_id) {
          label = affiliateNameById.get(row.affiliate_code_id) ?? "Affiliate";
        } else if (type === "friend" && row.referral_code_id) {
          const referrerUserId = referralCodeUserById.get(row.referral_code_id);
          label = referrerUserId
            ? (referrerProfileById.get(referrerUserId) ?? referrerUserId)
            : "Friend";
        }

        referralMap.set(row.redeemer_user_id, {
          type,
          label,
          redeemed_at: row.redeemed_at,
        });
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

      const redemption = referralMap.get(row.id) ?? null;

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
        phone_number: typeof record.phone_number === "string" ? record.phone_number : null,
        plan: resolveEffectivePlan({
          subscriptionPlan: subscriptionMap.get(row.id)?.plan,
          profilePlan: typeof record.plan === "string" ? record.plan : null,
        }),
        created_at: row.created_at ?? new Date().toISOString(),
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        referral: redemption
          ? {
              type: redemption.type,
              label: redemption.label,
              redeemed_at: redemption.redeemed_at,
            }
          : null,
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
