import { requireAdminForPage } from "@/lib/auth/require-admin";
import { DashboardShell } from "@/modules/dashboard/components/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAdminForPage();

  return <DashboardShell userEmail={user.email ?? "unknown"} />;
}
