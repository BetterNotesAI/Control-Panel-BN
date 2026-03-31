import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Pagination } from "@/components/ui/pagination";
import type { FeedbackItem } from "@/types/feedback";

interface FeedbackTableProps {
  items: FeedbackItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onOpenDetails: (item: FeedbackItem) => void;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function preview(text: string, length = 95): string {
  if (text.length <= length) {
    return text;
  }

  return `${text.slice(0, length)}...`;
}

export function FeedbackTable({
  items,
  total,
  page,
  totalPages,
  isLoading,
  error,
  onPageChange,
  onOpenDetails,
}: FeedbackTableProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Feedback</h3>
        <p className="text-xs text-muted">{total} total</p>
      </div>

      {isLoading ? <LoadingState message="Loading feedback..." /> : null}
      {error ? <ErrorState message={error} /> : null}

      {!isLoading && !error && items.length === 0 ? (
        <EmptyState message="No feedback matches your filters." />
      ) : null}

      {!isLoading && !error && items.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2">Created at</th>
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2">Source</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Message</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/70 text-foreground last:border-none">
                    <td className="px-2 py-2 text-xs text-muted">{formatDate(item.created_at)}</td>
                    <td className="px-2 py-2 text-xs">{item.user_email ?? item.user_id}</td>
                    <td className="px-2 py-2 text-xs">{item.source}</td>
                    <td className="px-2 py-2">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-2 text-xs text-muted">{preview(item.message)}</td>
                    <td className="px-2 py-2 text-right">
                      <Button size="sm" variant="secondary" onClick={() => onOpenDetails(item)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </>
      ) : null}
    </section>
  );
}
