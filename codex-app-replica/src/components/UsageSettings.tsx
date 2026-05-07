import { useEffect, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import {
  readAccountRateLimits,
  type UsageCreditsSnapshot,
  type UsageRateLimitSnapshot,
  type UsageRateLimitWindow,
  type UsageRateLimitsResponse,
} from "../services/usage";

const SPARK_LIMIT_ID = "gpt-5.3-codex-spark";
const CREDIT_PURCHASE_URL = "https://chatgpt.com/codex/settings/usage?credit_modal=true";
const CREDIT_PRICING_URL = "https://developers.openai.com/codex/pricing";

async function loadUsageRateLimits(
  setIsLoading: (value: boolean) => void,
  setLoadError: (value: string | null) => void,
  setRateLimitsResponse: (value: UsageRateLimitsResponse | null) => void,
  cancelled?: { current: boolean },
) {
  setIsLoading(true);
  setLoadError(null);

  try {
    const response = await readAccountRateLimits();
    if (!cancelled?.current) {
      setRateLimitsResponse(response);
    }
  } catch (error) {
    if (!cancelled?.current) {
      setRateLimitsResponse(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    if (!cancelled?.current) {
      setIsLoading(false);
    }
  }
}

export function UsageSettings({
  authMethod,
  planAtLogin,
}: {
  authMethod: string | null;
  planAtLogin: string | null;
}) {
  const { locale, t } = useI18n();
  const [rateLimitsResponse, setRateLimitsResponse] = useState<UsageRateLimitsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  let usageContent: ReactNode = null;

  if (rateLimitsResponse) {
    const coreRateLimits = rateLimitsResponse.rateLimits ?? null;
    const sparkRateLimits = rateLimitsResponse.rateLimitsByLimitId?.[SPARK_LIMIT_ID] ?? null;
    const creditDetails = coreRateLimits?.credits ?? null;
    const coreLimitRows = buildUsageLimitRows(coreRateLimits);
    const sparkLimitRows = buildUsageLimitRows(sparkRateLimits);

    usageContent = (
      <>
        <UsageLimitSection
          locale={locale}
          rows={coreLimitRows}
          sectionTitle={t("settings.usage.limits.title")}
          t={t}
        />
        <UsageLimitSection
          locale={locale}
          rows={sparkLimitRows}
          sectionTitle={t("settings.usage.limits.spark.title")}
          t={t}
        />
        <UsageCreditSection creditDetails={creditDetails} locale={locale} t={t} />
      </>
    );
  }

  useEffect(() => {
    const cancelled = { current: false };

    void loadUsageRateLimits(setIsLoading, setLoadError, setRateLimitsResponse, cancelled);

    return () => {
      cancelled.current = true;
    };
  }, [authMethod, planAtLogin]);

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      {isLoading ? (
        <UsageStateCard label={t("settings.usage.load.loading")} />
      ) : loadError ? (
        <UsageErrorCard
          error={loadError}
          onRetry={() => void loadUsageRateLimits(setIsLoading, setLoadError, setRateLimitsResponse)}
        />
      ) : (
        usageContent
      )}
    </div>
  );
}

function UsageLimitSection({
  locale,
  rows,
  sectionTitle,
  t,
}: {
  locale: string;
  rows: UsageLimitRowData[];
  sectionTitle: string;
  t: (key: "settings.usage.limits.title" | "settings.usage.limits.spark.title" | "settings.usage.limits.fiveHour.label" | "settings.usage.limits.weekly.label" | "settings.usage.limits.window.resetAt" | "settings.usage.limits.progress.ariaLabel" | "settings.usage.limits.progress.remaining", values?: Record<string, number | string>) => string;
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="text-[14px] font-medium">{sectionTitle}</div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <UsageLimitRow key={row.key} locale={locale} row={row} t={t} />
        ))}
      </div>
    </div>
  );
}

function UsageCreditSection({
  creditDetails,
  locale,
  t,
}: {
  creditDetails: UsageCreditsSnapshot | null;
  locale: string;
  t: (
    key:
      | "settings.usage.credit.title"
      | "settings.usage.credit.remaining.description"
      | "settings.usage.credit.purchase"
      | "settings.usage.credit.remaining.unavailable"
      | "settings.usage.credit.remaining.unlimited"
      | "settings.usage.credit.remaining.value",
    values?: Record<string, number | string>,
  ) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="text-[14px] font-medium">{t("settings.usage.credit.title")}</div>
      <div className="mt-3 rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3">
        <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] leading-6">{formatCreditRemaining(creditDetails, locale, t)}</div>
            <div className="app-text-muted mt-1 text-[12px] leading-5">
              {renderInlineLinkMessage(
                t("settings.usage.credit.remaining.description"),
                CREDIT_PRICING_URL,
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={openCreditPurchase}
            className="app-control-weak mt-0.5 rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.usage.credit.purchase")}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageLimitRow({
  locale,
  row,
  t,
}: {
  locale: string;
  row: UsageLimitRowData;
  t: (key: "settings.usage.limits.title" | "settings.usage.limits.spark.title" | "settings.usage.limits.fiveHour.label" | "settings.usage.limits.weekly.label" | "settings.usage.limits.window.resetAt" | "settings.usage.limits.progress.ariaLabel" | "settings.usage.limits.progress.remaining", values?: Record<string, number | string>) => string;
}) {
  const remainingPercent = Math.max(0, Math.min(100, 100 - row.usedPercent));
  const resetAtLabel = formatResetAt(locale, row.resetsAt);
  const label =
    row.windowDurationMins != null && row.windowDurationMins >= 1440
      ? t("settings.usage.limits.weekly.label")
      : t("settings.usage.limits.fiveHour.label");

  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3">
      <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-6">{label}</div>
          {resetAtLabel ? (
            <div className="app-text-muted mt-1 text-[12px] leading-5">
              {t("settings.usage.limits.window.resetAt", { time: resetAtLabel })}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <progress
            max={100}
            value={remainingPercent}
            aria-label={t("settings.usage.limits.progress.ariaLabel")}
            className="h-1.5 w-24 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-[color-mix(in_srgb,var(--app-shell-text)_10%,transparent)] [&::-webkit-progress-value]:bg-[var(--app-shell-text)] [&::-moz-progress-bar]:bg-[var(--app-shell-text)] [&::-ms-fill]:bg-[var(--app-shell-text)]"
          />
          <span className="w-[72px] text-right text-[13px] tabular-nums text-[var(--app-shell-muted)]">
            {t("settings.usage.limits.progress.remaining", {
              remaining: Math.round(remainingPercent),
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

type UsageLimitRowData = {
  key: string;
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

function buildUsageLimitRows(rateLimitSnapshot: UsageRateLimitSnapshot | null) {
  if (!rateLimitSnapshot) {
    return [];
  }

  const rows: UsageLimitRowData[] = [];
  if (rateLimitSnapshot.primary) {
    rows.push(buildUsageLimitRow("primary", rateLimitSnapshot.primary));
  }
  if (rateLimitSnapshot.secondary) {
    rows.push(buildUsageLimitRow("secondary", rateLimitSnapshot.secondary));
  }

  return rows.sort((left, right) => {
    const leftMinutes = left.windowDurationMins ?? 0;
    const rightMinutes = right.windowDurationMins ?? 0;
    return leftMinutes - rightMinutes;
  });
}

function buildUsageLimitRow(key: string, window: UsageRateLimitWindow): UsageLimitRowData {
  return {
    key,
    usedPercent: Math.max(0, Math.min(100, window.usedPercent)),
    windowDurationMins: window.windowDurationMins,
    resetsAt: window.resetsAt,
  };
}

function formatResetAt(locale: string, resetsAt: number | null) {
  if (resetsAt == null || !Number.isFinite(resetsAt)) {
    return null;
  }

  const date = new Date(resetsAt * 1000);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const now = new Date();
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  ) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatCreditRemaining(
  creditDetails: UsageCreditsSnapshot | null,
  locale: string,
  t: (
    key:
      | "settings.usage.credit.title"
      | "settings.usage.credit.remaining.description"
      | "settings.usage.credit.purchase"
      | "settings.usage.credit.remaining.unavailable"
      | "settings.usage.credit.remaining.unlimited"
      | "settings.usage.credit.remaining.value",
    values?: Record<string, number | string>,
  ) => string,
) {
  if (creditDetails == null) {
    return t("settings.usage.credit.remaining.unavailable");
  }
  if (creditDetails.unlimited) {
    return t("settings.usage.credit.remaining.unlimited");
  }

  const balance = Number(creditDetails.balance ?? 0);
  const credit = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.floor(balance));
  return t("settings.usage.credit.remaining.value", { credit });
}

function openCreditPurchase() {
  window.open(CREDIT_PURCHASE_URL, "_blank", "noopener,noreferrer");
}

function UsageStateCard({ label }: { label: string }) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="app-text-muted text-[13px] leading-6">{label}</div>
    </div>
  );
}

function UsageErrorCard({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="app-card-error rounded-[18px] px-5 py-4">
      <div className="text-[13px] leading-6">{t("settings.usage.load.error")}</div>
      <div className="mt-1 text-[12px] leading-5 opacity-80">{error}</div>
      <button
        type="button"
        onClick={onRetry}
        className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
      >
        {t("settings.usage.load.retry")}
      </button>
    </div>
  );
}
