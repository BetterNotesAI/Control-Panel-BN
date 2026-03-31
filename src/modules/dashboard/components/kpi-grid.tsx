import { Card } from "@/components/ui/card";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type { AdminKpis } from "@/types/admin";

interface KpiGridProps {
  data: AdminKpis | null;
  isLoading: boolean;
  error: string | null;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function KpiGrid({ data, isLoading, error }: KpiGridProps) {
  if (isLoading) {
    return <LoadingState message="Loading KPIs..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!data) {
    return <ErrorState message="KPI data is not available." />;
  }

  const cards = [
    { label: "Total users", value: data.totalUsers },
    { label: "Users created (last 7d)", value: data.usersLast7Days },
    { label: "Total documents", value: data.totalDocuments },
    {
      label: "Total problem solver sessions",
      value: data.totalProblemSolverSessions,
    },
    { label: "Feedback total", value: data.feedbackTotal },
    { label: "Feedback new", value: data.feedbackNew },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.label} className="p-4" title={card.label}>
          <p className="text-2xl font-semibold text-foreground">{formatNumber(card.value)}</p>
        </Card>
      ))}
    </div>
  );
}
