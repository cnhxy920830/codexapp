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

export type UsageAutoTopUpSettings = {
  isEnabled: boolean;
  rechargeThreshold: string | null;
  rechargeTarget: string | null;
  immediateTopUpStatus: string | null;
};

export type UsageAutoTopUpWriteParams = {
  rechargeThreshold: string;
  rechargeTarget: string;
};

export type UsageBillingCurrencyResponse = {
  billingCurrency: string | null;
};

export type UsagePricingReadParams = {
  billingCurrency: string;
};

export type UsagePricingInfo = {
  amountPerCredit: number;
  currencyCode: string;
  minorUnitExponent: number | null;
};

export type UsageCustomerPortalResponse = {
  url: string;
};

export async function readAccountRateLimits() {
  return invoke<UsageRateLimitsResponse>("read_account_rate_limits");
}

export async function sendAddCreditsNudgeEmail(creditType: UsageCreditsNudgeType) {
  return invoke<UsageCreditsNudgeResponse>("send_add_credits_nudge_email", {
    params: { creditType },
  });
}

export async function readUsageAutoTopUpSettings() {
  return invoke<UsageAutoTopUpSettings>("read_usage_auto_top_up_settings");
}

export async function enableUsageAutoTopUp(params: UsageAutoTopUpWriteParams) {
  return invoke<UsageAutoTopUpSettings>("enable_usage_auto_top_up", {
    params,
  });
}

export async function updateUsageAutoTopUp(params: UsageAutoTopUpWriteParams) {
  return invoke<UsageAutoTopUpSettings>("update_usage_auto_top_up", {
    params,
  });
}

export async function disableUsageAutoTopUp() {
  return invoke<UsageAutoTopUpSettings>("disable_usage_auto_top_up");
}

export async function readUsageBillingCurrency() {
  return invoke<UsageBillingCurrencyResponse>("read_usage_billing_currency");
}

export async function readUsagePricing(params: UsagePricingReadParams) {
  return invoke<UsagePricingInfo | null>("read_usage_pricing", {
    params,
  });
}

export async function readUsageCustomerPortal() {
  return invoke<UsageCustomerPortalResponse>("read_usage_customer_portal");
}
