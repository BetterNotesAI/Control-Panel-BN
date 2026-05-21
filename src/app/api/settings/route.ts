import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/require-admin";
import { getSupabaseAdminClient } from "@/lib/supabase/service-role";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,display_name,username,phone_number,plan,language,profile_visibility")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const update: Record<string, unknown> = {};

  if ("phone_number" in body) {
    const phone = body.phone_number;
    if (phone !== null && (typeof phone !== "string" || phone.length > 30)) {
      return NextResponse.json({ error: "phone_number must be a string of max 30 characters" }, { status: 400 });
    }
    update.phone_number = phone ?? null;
  }

  // Allow other safe profile fields to be patched too
  const ALLOWED = ["display_name", "username", "language", "profile_visibility", "short_bio"] as const;
  for (const field of ALLOWED) {
    if (field in body) update[field] = body[field] ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  update.updated_at = new Date().toISOString();

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id,email,display_name,username,phone_number,plan,language,profile_visibility")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
