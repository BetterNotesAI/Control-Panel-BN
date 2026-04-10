import { cn } from "@/lib/utils";
import type { EffectivePlan } from "@/lib/admin/users";

interface UserAvatarProps {
  avatarUrl: string | null;
  displayName: string | null;
  email: string | null;
  size?: "sm" | "lg";
}

const avatarSizeClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  lg: "h-16 w-16 text-xl",
};

export function UserAvatar({
  avatarUrl,
  displayName,
  email,
  size = "sm",
}: UserAvatarProps) {
  const sizeClass = avatarSizeClasses[size];

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn("rounded-full object-cover", sizeClass)}
      />
    );
  }

  const initials = (displayName ?? email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-surfaceMuted text-muted",
        sizeClass,
      )}
    >
      {initials || "?"}
    </div>
  );
}

interface PlanBadgeProps {
  plan: EffectivePlan | null | undefined;
  className?: string;
}

const planColorMap: Record<EffectivePlan, string> = {
  free: "bg-surfaceMuted/60 text-muted border-border",
  better: "bg-info/20 text-info border-info/30",
  best: "bg-success/20 text-success border-success/30",
};

export function PlanBadge({ plan, className }: PlanBadgeProps) {
  if (!plan) {
    return <span className="text-xs text-muted">—</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
        planColorMap[plan],
        className,
      )}
    >
      {plan}
    </span>
  );
}
