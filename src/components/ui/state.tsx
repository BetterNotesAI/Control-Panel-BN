interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/60 p-6 text-center text-sm text-muted">
      {message}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
}

export function ErrorState({ message = "Something went wrong." }: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-danger/40 bg-danger/10 p-6 text-center text-sm text-danger">
      {message}
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
}

export function EmptyState({ message = "No data available." }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-border bg-surfaceMuted/40 p-6 text-center text-sm text-muted">
      {message}
    </div>
  );
}
