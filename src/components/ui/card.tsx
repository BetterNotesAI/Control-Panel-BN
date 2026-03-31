import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, children, className }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-surface/80 p-5 shadow-soft backdrop-blur",
        className,
      )}
    >
      {(title || subtitle) && (
        <header className="mb-4">
          {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-xs text-muted">{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
