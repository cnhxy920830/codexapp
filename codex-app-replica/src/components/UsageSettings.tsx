import { useEffect, useState, type ReactNode } from "react";
import { CheckCircleFilledIcon, LinkExternalIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { UsageAutoTopUpDialog } from "./UsageAutoTopUpDialog";
import { useUsageSettingsAccess } from "../hooks/useUsageSettingsAccess";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import {
  readAccountRateLimits,
  readUsageAutoTopUpSettings,
  type UsageAutoTopUpSettings,
  type UsageCreditsSnapshot,
  type UsageRateLimitSnapshot,
  type UsageRateLimitWindow,
  type UsageRateLimitsResponse,
} from "../services/usage";

const SPARK_LIMIT_ID = "gpt-5.3-codex-spark";
const CREDIT_PURCHASE_URL = "https://chatgpt.com/codex/settings/usage?credit_modal=true";
const CREDIT_PRICING_URL = "https://developers.openai.com/codex/pricing";
const FIVE_HOUR_WINDOW_MINUTES = 300;
const WEEKLY_WINDOW_MINUTES = 7 * 24 * 60;

type UsageLimitRowData = {
  key: string;
  usedPercent: number;
  windowDurationMins: number | null;
  resetsAt: number | null;
};

export function UsageSettings({
  authMethod,
  isAuthLoading,
  onShowToast,
}: {
  authMethod: string | null;
  isAuthLoading: boolean;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { locale, t } = useI18n();
  const { isUsageSettingsAccessLoading, isUsageSettingsVisible } = useUsageSettingsAccess({
    authMethod,
    isAuthLoading,
  });
  const [rateLimitsResponse, setRateLimitsResponse] = useState<UsageRateLimitsResponse | null>(null);
  const [autoTopUpSettings, setAutoTopUpSettings] = useState<UsageAutoTopUpSettings | null>(null);
  const [isRateLimitsLoading, setIsRateLimitsLoading] = useState(false);
  const [isAutoTopUpLoading, setIsAutoTopUpLoading] = useState(false);
  const [rateLimitsLoadError, setRateLimitsLoadError] = useState<string | null>(null);
  const [autoTopUpLoadError, setAutoTopUpLoadError] = useState<string | null>(null);
  const [isAutoTopUpDialogOpen, setIsAutoTopUpDialogOpen] = useState(false);

  useEffect(() => {
    const cancelled = { current: false };

    if (!isUsageSettingsVisible) {
      setRateLimitsResponse(null);
      setAutoTopUpSettings(null);
      setRateLimitsLoadError(null);
      setAutoTopUpLoadError(null);
      setIsRateLimitsLoading(false);
      setIsAutoTopUpLoading(false);
      return () => {
        cancelled.current = true;
      };
    }

    void loadUsageRateLimits({
      cancelled,
      setIsLoading: setIsRateLimitsLoading,
      setLoadError: setRateLimitsLoadError,
      setRateLimitsResponse,
    });
    void loadUsageAutoTopUpSettings({
      cancelled,
      setAutoTopUpSettings,
      setIsLoading: setIsAutoTopUpLoading,
      setLoadError: setAutoTopUpLoadError,
    });

    return () => {
      cancelled.current = true;
    };
  }, [isUsageSettingsVisible]);

  if (!isUsageSettingsVisible && !isUsageSettingsAccessLoading) {
    return null;
  }

  if (isUsageSettingsAccessLoading) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="usage" />}>
        <UsageStateSection label={t("settings.usage.access.loading")} />
      </SettingsContentLayout>
    );
  }

  const hasInitialLoadError =
    (rateLimitsLoadError != null && rateLimitsResponse == null) ||
    (autoTopUpLoadError != null && autoTopUpSettings == null);
  if (hasInitialLoadError) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="usage" />}>
        <UsageStateSection
          label={t("settings.usage.load.error")}
          control={
            <Button
              color="secondary"
              size="toolbar"
              onClick={() => {
                void loadUsageRateLimits({
                  setIsLoading: setIsRateLimitsLoading,
                  setLoadError: setRateLimitsLoadError,
                  setRateLimitsResponse,
                });
                void loadUsageAutoTopUpSettings({
                  setAutoTopUpSettings,
                  setIsLoading: setIsAutoTopUpLoading,
                  setLoadError: setAutoTopUpLoadError,
                });
              }}
            >
              {t("settings.usage.load.retry")}
            </Button>
          }
        />
      </SettingsContentLayout>
    );
  }

  if ((isRateLimitsLoading && rateLimitsResponse == null) || (isAutoTopUpLoading && autoTopUpSettings == null)) {
    return (
      <SettingsContentLayout title={<SettingsSectionTitle slug="usage" />}>
        <UsageStateSection label={t("settings.usage.load.loading")} />
      </SettingsContentLayout>
    );
  }

  if (autoTopUpSettings == null) {
    return null;
  }

  const coreLimitRows = buildUsageLimitRows("core", rateLimitsResponse?.rateLimits ?? null);
  const sparkLimitRows = buildUsageLimitRows(
    SPARK_LIMIT_ID,
    rateLimitsResponse?.rateLimitsByLimitId?.[SPARK_LIMIT_ID] ?? null,
  );

  return (
    <>
      <SettingsContentLayout title={<SettingsSectionTitle slug="usage" />}>
        <UsageLimitSection
          locale={locale}
          rows={coreLimitRows}
          sectionTitle={t("settings.usage.limits.title")}
        />
        <UsageLimitSection
          locale={locale}
          rows={sparkLimitRows}
          sectionTitle={t("settings.usage.limits.spark.title")}
        />
        <UsageCreditSection
          autoTopUpSettings={autoTopUpSettings}
          creditDetails={rateLimitsResponse?.rateLimits.credits ?? null}
          locale={locale}
          onOpenAutoTopUpDialog={() => setIsAutoTopUpDialogOpen(true)}
        />
      </SettingsContentLayout>
      {isAutoTopUpDialogOpen ? (
        <UsageAutoTopUpDialog
          creditDetails={rateLimitsResponse?.rateLimits.credits ?? null}
          open={isAutoTopUpDialogOpen}
          onClose={() => setIsAutoTopUpDialogOpen(false)}
          onSaved={(response) => {
            setAutoTopUpSettings(response);
            if (response.immediateTopUpStatus === "succeeded") {
              void readAccountRateLimits()
                .then((nextResponse) => {
                  setRateLimitsResponse(nextResponse);
                  setRateLimitsLoadError(null);
                })
                .catch(() => {
                  // Preserve the last successful rate-limit snapshot if the background refresh fails.
                });
            }
          }}
          onShowToast={onShowToast}
          serverState={autoTopUpSettings}
        />
      ) : null}
    </>
  );
}

async function loadUsageRateLimits({
  cancelled,
  setIsLoading,
  setLoadError,
  setRateLimitsResponse,
}: {
  cancelled?: { current: boolean };
  setIsLoading: (value: boolean) => void;
  setLoadError: (value: string | null) => void;
  setRateLimitsResponse: (value: UsageRateLimitsResponse | null) => void;
}) {
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

async function loadUsageAutoTopUpSettings({
  cancelled,
  setAutoTopUpSettings,
  setIsLoading,
  setLoadError,
}: {
  cancelled?: { current: boolean };
  setAutoTopUpSettings: (value: UsageAutoTopUpSettings | null) => void;
  setIsLoading: (value: boolean) => void;
  setLoadError: (value: string | null) => void;
}) {
  setIsLoading(true);
  setLoadError(null);

  try {
    const response = await readUsageAutoTopUpSettings();
    if (!cancelled?.current) {
      setAutoTopUpSettings(response);
    }
  } catch (error) {
    if (!cancelled?.current) {
      setAutoTopUpSettings(null);
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    if (!cancelled?.current) {
      setIsLoading(false);
    }
  }
}

function UsageLimitSection({
  locale,
  rows,
  sectionTitle,
}: {
  locale: string;
  rows: UsageLimitRowData[];
  sectionTitle: string;
}) {
  const { t } = useI18n();

  if (rows.length === 0) {
    return null;
  }

  return (
    <SettingsGroup>
      <SettingsGroup.Header title={sectionTitle} />
      <SettingsGroup.Content>
        <SettingsSurface>
          {rows.map((row) => (
            <SettingsRow
              key={row.key}
              className="gap-6"
              label={
                (row.windowDurationMins ?? 0) < 1440
                  ? t("settings.usage.limits.fiveHour.label")
                  : t("settings.usage.limits.weekly.label")
              }
              description={
                formatResetAt(locale, row.resetsAt) == null ? null : (
                  <>{t("settings.usage.limits.window.resetAt", { time: formatResetAt(locale, row.resetsAt) ?? "" })}</>
                )
              }
              control={
                <UsageProgressControl
                  remainingPercent={Math.max(0, Math.min(100, 100 - row.usedPercent))}
                />
              }
            />
          ))}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function UsageCreditSection({
  autoTopUpSettings,
  creditDetails,
  locale,
  onOpenAutoTopUpDialog,
}: {
  autoTopUpSettings: UsageAutoTopUpSettings;
  creditDetails: UsageCreditsSnapshot | null;
  locale: string;
  onOpenAutoTopUpDialog: () => void;
}) {
  const { t } = useI18n();

  return (
    <SettingsGroup>
      <SettingsGroup.Header title={t("settings.usage.credit.title")} />
      <SettingsGroup.Content>
        <SettingsSurface>
          <UsageCreditActionRow
            title={formatCreditRemaining(creditDetails, locale, t)}
            description={renderUsageDocLink(t("settings.usage.credit.remaining.description"))}
            action={
              <Button color="secondary" size="toolbar" onClick={openCreditPurchase}>
                {t("settings.usage.credit.purchase")}
              </Button>
            }
          />
          <UsageCreditActionRow
            title={
              <div className="flex items-center gap-1.5">
                <span>{t("settings.usage.autoTopUp.title")}</span>
                {autoTopUpSettings.isEnabled ? <AutoTopUpActiveBadge /> : null}
              </div>
            }
            description={t("settings.usage.autoTopUp.description")}
            action={
              <Button color="secondary" size="toolbar" onClick={onOpenAutoTopUpDialog}>
                {t("settings.usage.autoTopUp.settings")}
              </Button>
            }
          />
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function UsageCreditActionRow({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="text-sm text-token-text-primary">{title}</div>
        <div className="text-sm text-token-text-secondary">{description}</div>
      </div>
      <div className="flex shrink-0 items-center">{action}</div>
    </div>
  );
}

function UsageStateSection({
  label,
  control,
}: {
  label: ReactNode;
  control?: ReactNode;
}) {
  return (
    <SettingsGroup>
      <SettingsGroup.Content>
        <SettingsSurface>
          <SettingsRow className="gap-6" label={label} control={control ?? null} />
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function AutoTopUpActiveBadge() {
  const { t } = useI18n();

  return (
    <span className="inline-flex items-center gap-1 text-sm text-token-charts-green">
      <CheckCircleFilledIcon className="icon-2xs shrink-0" />
      {t("settings.usage.autoTopUp.status.active")}
    </span>
  );
}

function UsageProgressControl({
  remainingPercent,
}: {
  remainingPercent: number;
}) {
  const { t } = useI18n();
  const clampedRemaining = Math.max(0, Math.min(100, remainingPercent));

  return (
    <div className="flex items-center gap-2">
      <progress
        max={100}
        value={clampedRemaining}
        aria-label={t("settings.usage.limits.progress.ariaLabel")}
        className="h-1.5 w-24 overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-token-foreground/10 [&::-webkit-progress-value]:bg-token-foreground [&::-moz-progress-bar]:bg-token-foreground [&::-ms-fill]:bg-token-foreground"
      />
      <span className="w-[72px] text-right text-sm text-token-text-secondary tabular-nums">
        {t("settings.usage.limits.progress.remaining", {
          remaining: Math.round(clampedRemaining),
        })}
      </span>
    </div>
  );
}

function buildUsageLimitRows(keyPrefix: string, rateLimitSnapshot: UsageRateLimitSnapshot | null) {
  if (!rateLimitSnapshot) {
    return [];
  }

  const windows = [rateLimitSnapshot.primary, rateLimitSnapshot.secondary].filter(isUsageRateLimitWindow);
  if (windows.length === 0) {
    return [];
  }

  const rows: UsageLimitRowData[] = [];
  const fiveHourWindow = pickClosestUsageLimitWindow(
    windows.filter((window) => (window.windowDurationMins ?? 0) < 1440),
    FIVE_HOUR_WINDOW_MINUTES,
  );
  if (fiveHourWindow) {
    rows.push(buildUsageLimitRow(`${keyPrefix}-five-hour`, fiveHourWindow));
  }

  const weeklyWindow = pickClosestUsageLimitWindow(
    windows.filter((window) => window !== fiveHourWindow && (window.windowDurationMins ?? 0) >= 1440),
    WEEKLY_WINDOW_MINUTES,
  );
  if (weeklyWindow) {
    rows.push(buildUsageLimitRow(`${keyPrefix}-weekly`, weeklyWindow));
  }

  return rows;
}

function isUsageRateLimitWindow(window: UsageRateLimitWindow | null): window is UsageRateLimitWindow {
  return window != null && (window.windowDurationMins ?? 0) > 0;
}

function pickClosestUsageLimitWindow(windows: UsageRateLimitWindow[], targetMinutes: number) {
  if (windows.length === 0) {
    return null;
  }

  return windows.reduce((selectedWindow, candidateWindow) => {
    const selectedDistance = Math.abs((selectedWindow.windowDurationMins ?? 0) - targetMinutes);
    const candidateDistance = Math.abs((candidateWindow.windowDurationMins ?? 0) - targetMinutes);
    if (candidateDistance < selectedDistance) {
      return candidateWindow;
    }
    if (candidateDistance > selectedDistance) {
      return selectedWindow;
    }
    return (candidateWindow.windowDurationMins ?? 0) > (selectedWindow.windowDurationMins ?? 0)
      ? candidateWindow
      : selectedWindow;
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
  const diffSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  if (diffSeconds <= 0) {
    return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(0, "second");
  }

  const oneDayInSeconds = 24 * 60 * 60;
  if (diffSeconds < oneDayInSeconds) {
    return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
  }

  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}

function formatCreditRemaining(
  creditDetails: UsageCreditsSnapshot | null,
  locale: string,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
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

function renderUsageDocLink(template: string) {
  const tagPairs = [
    ["<a>", "</a>"] as const,
    ["<link>", "</link>"] as const,
  ];

  for (const [startTag, endTag] of tagPairs) {
    const startIndex = template.indexOf(startTag);
    const endIndex = template.indexOf(endTag);
    if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
      continue;
    }

    const prefix = template.slice(0, startIndex);
    const linkLabel = template.slice(startIndex + startTag.length, endIndex);
    const suffix = template.slice(endIndex + endTag.length);

    return (
      <>
        {prefix}
        <a
          className="inline-flex items-center gap-1 text-token-text-secondary hover:text-token-text-primary"
          href={CREDIT_PRICING_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          {linkLabel}
          <LinkExternalIcon className="icon-xxs" />
        </a>
        {suffix}
      </>
    );
  }

  return template;
}
