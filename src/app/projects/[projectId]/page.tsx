import { ProjectDetailView } from "@/modules/projects/components/project-detail-view";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  return <ProjectDetailView projectId={projectId} />;
}
