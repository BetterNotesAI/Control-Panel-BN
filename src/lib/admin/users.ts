export type EffectivePlan = "free" | "better" | "best";

function sanitizePlan(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizePlan(plan: string | null | undefined): EffectivePlan | null {
  if (!plan) {
    return null;
  }

  const normalized = sanitizePlan(plan);

  if (normalized === "best") {
    return "best";
  }

  if (normalized === "better" || normalized === "pro") {
    return "better";
  }

  if (normalized === "free") {
    return "free";
  }

  return null;
}

export function resolveEffectivePlan(params: {
  subscriptionPlan: string | null | undefined;
  profilePlan: string | null | undefined;
}): EffectivePlan {
  const fromSubscription = normalizePlan(params.subscriptionPlan);

  if (fromSubscription) {
    return fromSubscription;
  }

  const fromProfile = normalizePlan(params.profilePlan);

  if (fromProfile) {
    return fromProfile;
  }

  return "free";
}

export function getPlanCreditLimit(plan: EffectivePlan): number {
  if (plan === "best") {
    return 500;
  }

  if (plan === "better") {
    return 200;
  }

  return 10;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function readNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;

  return Math.round(value * factor) / factor;
}
