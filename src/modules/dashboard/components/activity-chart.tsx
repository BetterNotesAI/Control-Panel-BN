import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import type { ActivityPoint } from "@/types/admin";

interface ActivityChartProps {
  range: "7d" | "30d";
  onRangeChange: (range: "7d" | "30d") => void;
  points: ActivityPoint[];
  isLoading: boolean;
  error: string | null;
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function ActivityChart({
  range,
  onRangeChange,
  points,
  isLoading,
  error,
}: ActivityChartProps) {
  const max = Math.max(
    ...points.map((point) => Math.max(point.documents, point.problemSolverSessions)),
    1,
  );

  return (
    <Card
      title="Activity"
      subtitle="Documents and problem solver sessions by day"
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={range === "7d" ? "primary" : "secondary"}
          onClick={() => onRangeChange("7d")}
        >
          7d
        </Button>
        <Button
          size="sm"
          variant={range === "30d" ? "primary" : "secondary"}
          onClick={() => onRangeChange("30d")}
        >
          30d
        </Button>
      </div>

      {isLoading ? <LoadingState message="Loading activity..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && points.length === 0 ? (
        <EmptyState message="No activity in the selected range." />
      ) : null}

      {!isLoading && !error && points.length > 0 ? (
        <div className="space-y-3">
          {points.map((point) => {
            const documentsWidth = `${(point.documents / max) * 100}%`;
            const sessionsWidth = `${(point.problemSolverSessions / max) * 100}%`;

            return (
              <div key={point.date} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span>{dateLabel(point.date)}</span>
                  <span>
                    docs: {point.documents} | sessions: {point.problemSolverSessions}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="h-2 rounded bg-surfaceMuted">
                    <div
                      className="h-full rounded bg-info transition-all"
                      style={{ width: documentsWidth }}
                    />
                  </div>
                  <div className="h-2 rounded bg-surfaceMuted">
                    <div
                      className="h-full rounded bg-success transition-all"
                      style={{ width: sessionsWidth }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </Card>
  );
}
