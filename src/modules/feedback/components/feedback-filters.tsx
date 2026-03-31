import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FeedbackFilters } from "@/types/feedback";
import { FEEDBACK_STATUSES } from "@/types/feedback";

interface FeedbackFiltersProps {
  value: FeedbackFilters;
  onChange: (value: FeedbackFilters) => void;
  onApply: () => void;
  onReset: () => void;
  onExport: () => void;
  isLoading: boolean;
}

export function FeedbackFiltersBar({
  value,
  onChange,
  onApply,
  onReset,
  onExport,
  isLoading,
}: FeedbackFiltersProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/80 p-4 shadow-soft">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="space-y-1">
          <label className="text-xs text-muted">Status</label>
          <Select
            value={value.status}
            onChange={(event) => onChange({ ...value, status: event.target.value as FeedbackFilters["status"] })}
          >
            <option value="all">All</option>
            {FEEDBACK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted">Source</label>
          <Input
            placeholder="web, mobile, extension..."
            value={value.source}
            onChange={(event) => onChange({ ...value, source: event.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted">Search</label>
          <Input
            placeholder="Search in message"
            value={value.query}
            onChange={(event) => onChange({ ...value, query: event.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted">Start date</label>
          <Input
            type="date"
            value={value.startDate}
            onChange={(event) => onChange({ ...value, startDate: event.target.value })}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted">End date</label>
          <Input
            type="date"
            value={value.endDate}
            onChange={(event) => onChange({ ...value, endDate: event.target.value })}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={onApply} disabled={isLoading}>
          Apply filters
        </Button>
        <Button variant="secondary" onClick={onReset} disabled={isLoading}>
          Reset
        </Button>
        <Button variant="ghost" onClick={onExport} disabled={isLoading}>
          Export CSV
        </Button>
      </div>
    </section>
  );
}
