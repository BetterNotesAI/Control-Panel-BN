import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUserAuthorizedForAdmin } from "@/lib/auth/admin";

export async function getAuthenticatedUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

export async function requireAdminForPage(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  const isAuthorized = await isUserAuthorizedForAdmin(user);

  if (!isAuthorized) {
    redirect("/login?reason=unauthorized");
  }

  return user;
}

export async function getAdminUserOrNull(): Promise<User | null> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const isAuthorized = await isUserAuthorizedForAdmin(user);

  if (!isAuthorized) {
    return null;
  }

  return user;
}

export async function requireAdminForApi(): Promise<
  { user: User } | { error: NextResponse }
> {
  const user = await getAuthenticatedUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const isAuthorized = await isUserAuthorizedForAdmin(user);

  if (!isAuthorized) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user };
}
