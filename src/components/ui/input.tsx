import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surfaceMuted px-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-info/70",
        className,
      )}
      {...props}
    />
  );
}
