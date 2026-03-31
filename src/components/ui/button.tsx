import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-info text-slate-950 hover:bg-[#74c4f7] disabled:bg-[#2d4761] disabled:text-muted",
  secondary:
    "bg-surfaceMuted text-foreground hover:bg-[#26355d] disabled:bg-[#1b2541] disabled:text-muted",
  ghost:
    "bg-transparent text-foreground hover:bg-surfaceMuted/60 disabled:text-muted",
  danger:
    "bg-danger text-slate-950 hover:bg-[#ff9494] disabled:bg-[#5a3030] disabled:text-muted",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  );
}
