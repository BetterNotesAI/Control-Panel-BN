import { UserDetailView } from "@/modules/dashboard/components/user-detail-view";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <UserDetailView userId={id} />;
}
