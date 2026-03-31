import { cn } from "@/lib/utils";
import type { FeedbackStatus } from "@/types/feedback";

const statusClasses: Record<FeedbackStatus, string> = {
  new: "bg-info/20 text-info border-info/30",
  reviewed: "bg-warning/20 text-warning border-warning/30",
  planned: "bg-[#9bc7ff]/20 text-[#9bc7ff] border-[#9bc7ff]/30",
  done: "bg-success/20 text-success border-success/30",
  dismissed: "bg-danger/20 text-danger border-danger/30",
};

interface StatusBadgeProps {
  status: FeedbackStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        statusClasses[status],
      )}
    >
      {status}
    </span>
  );
}
