import { Card } from "@/components/ui/card";
import { getAuthenticatedUser } from "@/lib/auth/require-admin";
import { isUserAuthorizedForAdmin } from "@/lib/auth/admin";
import { LoginForm } from "@/modules/auth/components/login-form";
import { LogoutButton } from "@/modules/auth/components/logout-button";
import { redirect } from "next/navigation";

interface LoginPageProps {
  searchParams?: Promise<{
    reason?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getAuthenticatedUser();
  const isAuthorized = user ? await isUserAuthorizedForAdmin(user) : false;

  if (isAuthorized) {
    redirect("/dashboard");
  }

  const resolvedSearchParams = await searchParams;
  const reason = Array.isArray(resolvedSearchParams?.reason)
    ? resolvedSearchParams.reason[0]
    : resolvedSearchParams?.reason;
  const unauthorizedFromRedirect = reason === "unauthorized";

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card
        className="w-full max-w-md"
        title="BetterNotes Admin"
        subtitle="Sign in with your Supabase account"
      >
        {unauthorizedFromRedirect ? (
          <p className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
            This account is authenticated but does not have admin permissions.
          </p>
        ) : null}

        {user && !isAuthorized ? (
          <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
            You are signed in but not authorized for admin access.
            <div className="mt-2">
              <LogoutButton variant="ghost" />
            </div>
          </div>
        ) : null}

        <LoginForm
          initialError={
            unauthorizedFromRedirect
              ? "Sign in with an account that has profiles.admin_role = 'admin'."
              : undefined
          }
        />
      </Card>
    </main>
  );
}
