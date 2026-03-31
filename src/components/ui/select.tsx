import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surfaceMuted px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/70",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
