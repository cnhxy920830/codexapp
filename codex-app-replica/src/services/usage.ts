import { invoke } from "@tauri-apps/api/core";

export type UsageRateLimitWindow = {
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

export type UsageCreditsSnapshot = {
  hasCredits: boolean;
  unlimited: boolean;
  balance: string | null;
};

export type UsageRateLimitSnapshot = {
  limitId: string | null;
  limitName: string | null;
  primary: UsageRateLimitWindow | null;
  secondary: UsageRateLimitWindow | null;
  credits: UsageCreditsSnapshot | null;
  planType: string | null;
  rateLimitReachedType: string | null;
};

export type UsageRateLimitsResponse = {
  rateLimits: UsageRateLimitSnapshot;
  rateLimitsByLimitId: Record<string, UsageRateLimitSnapshot> | null;
};

export type UsageCreditsNudgeType = "credits" | "usage_limit";

export type UsageCreditsNudgeResponse = {
  status: string;
};

export async function readAccountRateLimits() {
  return invoke<UsageRateLimitsResponse>("read_account_rate_limits");
}

export async function sendAddCreditsNudgeEmail(creditType: UsageCreditsNudgeType) {
  return invoke<UsageCreditsNudgeResponse>("send_add_credits_nudge_email", {
    params: { creditType },
  });
}
