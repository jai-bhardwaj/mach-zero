// Plan-tier feature gates.
//
// Centralizes all "what can each plan do" logic so callers don't sprinkle
// `if (plan === 'PRO')` checks across the codebase. Add a new feature
// here, every gate downstream picks it up.
//
// Pricing hypothesis (subject to legal + market validation):
//   FREE       — Mock mode only, 1 strategy, 1 account, marketplace browsing
//   PRO        — Live mode, 10 strategies, 3 accounts, API access
//   ENTERPRISE — Unlimited, dedicated engine tier, SLA, custom limits
//
// These quotas drive both UX (enable/disable buttons, show upgrade
// prompts) and server-side enforcement (reject create-strategy if at
// limit). Server-side enforcement is the source of truth; the UI is
// just hints.

import type { Plan } from "@prisma/client";

export type Feature =
  | "live_mode"
  | "api_access"
  | "dedicated_engine"
  | "audit_log_export"
  | "multi_user"
  | "priority_support";

export interface PlanFeatures {
  features: Set<Feature>;
  limits: {
    maxStrategies: number;
    maxAccounts: number;
    maxUsers: number;
    maxAlerts: number;
  };
}

const FREE: PlanFeatures = {
  features: new Set<Feature>(),
  limits: {
    maxStrategies: 1,
    maxAccounts: 1,
    maxUsers: 1,
    maxAlerts: 0,
  },
};

const PRO: PlanFeatures = {
  features: new Set<Feature>(["live_mode", "api_access", "audit_log_export", "multi_user"]),
  limits: {
    maxStrategies: 10,
    maxAccounts: 3,
    maxUsers: 5,
    maxAlerts: 25,
  },
};

const ENTERPRISE: PlanFeatures = {
  features: new Set<Feature>([
    "live_mode",
    "api_access",
    "dedicated_engine",
    "audit_log_export",
    "multi_user",
    "priority_support",
  ]),
  limits: {
    maxStrategies: Number.POSITIVE_INFINITY,
    maxAccounts: Number.POSITIVE_INFINITY,
    maxUsers: Number.POSITIVE_INFINITY,
    maxAlerts: Number.POSITIVE_INFINITY,
  },
};

const PLAN_TO_FEATURES: Record<Plan, PlanFeatures> = {
  FREE,
  PRO,
  ENTERPRISE,
};

export function getPlanFeatures(plan: Plan): PlanFeatures {
  return PLAN_TO_FEATURES[plan] ?? FREE;
}

export function hasFeature(plan: Plan, feature: Feature): boolean {
  return getPlanFeatures(plan).features.has(feature);
}

export function getLimit(
  plan: Plan,
  limit: keyof PlanFeatures["limits"]
): number {
  return getPlanFeatures(plan).limits[limit];
}
