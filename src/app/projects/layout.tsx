import { requireAdminForPage } from "@/lib/auth/require-admin";
import { Sidebar } from "@/modules/dashboard/components/sidebar";

export default async function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdminForPage();

  return (
    <div className="flex min-h-screen">
      <Sidebar userEmail={user.email ?? "unknown"} />
      <div className="flex-1 overflow-y-auto bg-panel-grid bg-[size:16px_16px]">
        <div className="px-4 pb-6 pt-16 md:px-8 md:pt-6">{children}</div>
      </div>
    </div>
  );
}
