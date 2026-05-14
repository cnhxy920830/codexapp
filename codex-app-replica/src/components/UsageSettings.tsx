import { useEffect, useState, type ReactNode } from "react";
import { CheckIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { UsageAutoTopUpDialog } from "./UsageAutoTopUpDialog";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { isUsageSettingsPlanSupported, readAccountInfo } from "../services/auth";
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
  const [isUsageSettingsVisible, setIsUsageSettingsVisible] = useState(false);
  const [isUsageSettingsAccessLoading, setIsUsageSettingsAccessLoading] = useState(
    isAuthLoading || authMethod === "chatgpt",
  );
  const [rateLimitsResponse, setRateLimitsResponse] = useState<UsageRateLimitsResponse | null>(null);
  const [autoTopUpSettings, setAutoTopUpSettings] = useState<UsageAutoTopUpSettings | null>(null);
  const [isRateLimitsLoading, setIsRateLimitsLoading] = useState(false);
  const [isAutoTopUpLoading, setIsAutoTopUpLoading] = useState(false);
  const [rateLimitsLoadError, setRateLimitsLoadError] = useState<string | null>(null);
  const [autoTopUpLoadError, setAutoTopUpLoadError] = useState<string | null>(null);
  const [isAutoTopUpDialogOpen, setIsAutoTopUpDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (isAuthLoading) {
      setIsUsageSettingsAccessLoading(true);
      setIsUsageSettingsVisible(false);
      return () => {
        cancelled = true;
      };
    }

    if (authMethod !== "chatgpt") {
      setIsUsageSettingsAccessLoading(false);
      setIsUsageSettingsVisible(false);
      return () => {
        cancelled = true;
      };
    }

    setIsUsageSettingsAccessLoading(true);
    setIsUsageSettingsVisible(false);
    void readAccountInfo()
      .then((response) => {
        if (cancelled) {
          return;
        }
        setIsUsageSettingsVisible(isUsageSettingsPlanSupported(response.plan));
      })
      .catch(() => {
        if (!cancelled) {
          setIsUsageSettingsVisible(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsUsageSettingsAccessLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authMethod, isAuthLoading]);

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
      <SettingsContentLayout title={t("settings.section.usage")}>
        <UsageStateSection label={t("settings.usage.access.loading")} />
      </SettingsContentLayout>
    );
  }

  const hasInitialLoadError =
    (rateLimitsLoadError != null && rateLimitsResponse == null) ||
    (autoTopUpLoadError != null && autoTopUpSettings == null);
  if (hasInitialLoadError) {
    return (
      <SettingsContentLayout title={t("settings.section.usage")}>
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
      <SettingsContentLayout title={t("settings.section.usage")}>
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
      <SettingsContentLayout title={t("settings.section.usage")}>
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
      <SettingsGroupHeader title={sectionTitle} />
      <SettingsGroupContent>
        <SettingsSurface>
          {rows.map((row) => (
            <SettingsRow
              key={row.key}
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
      </SettingsGroupContent>
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
      <SettingsGroupHeader title={t("settings.usage.credit.title")} />
      <SettingsGroupContent>
        <SettingsSurface>
          <SettingsRow
            label={formatCreditRemaining(creditDetails, locale, t)}
            description={renderUsageDocLink(t("settings.usage.credit.remaining.description"))}
            control={
              <Button color="secondary" size="toolbar" onClick={openCreditPurchase}>
                {t("settings.usage.credit.purchase")}
              </Button>
            }
          />
          <SettingsRow
            label={
              <div className="flex items-center gap-1.5">
                <span>{t("settings.usage.autoTopUp.title")}</span>
                {autoTopUpSettings.isEnabled ? <AutoTopUpActiveBadge /> : null}
              </div>
            }
            description={t("settings.usage.autoTopUp.description")}
            control={
              <Button color="secondary" size="toolbar" onClick={onOpenAutoTopUpDialog}>
                {t("settings.usage.autoTopUp.settings")}
              </Button>
            }
          />
        </SettingsSurface>
      </SettingsGroupContent>
    </SettingsGroup>
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
      <SettingsGroupContent>
        <SettingsSurface>
          <SettingsRow label={label} control={control ?? null} />
        </SettingsSurface>
      </SettingsGroupContent>
    </SettingsGroup>
  );
}

function AutoTopUpActiveBadge() {
  const { t } = useI18n();

  return (
    <span className="inline-flex items-center gap-1 text-sm text-token-charts-green">
      <CheckIcon className="h-3.5 w-3.5 shrink-0" />
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

  const sixtyDaysInSeconds = 60 * 24 * 60 * 60;
  if (diffSeconds < sixtyDaysInSeconds) {
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
          rel="noreferrer"
        >
          {linkLabel}
          <LinkExternalIcon className="size-4" />
        </a>
        {suffix}
      </>
    );
  }

  return template;
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupHeader({ title }: { title?: ReactNode }) {
  if (!title) {
    return null;
  }

  return (
    <div className="pb-3">
      <div className="text-base font-medium text-token-text-primary">{title}</div>
    </div>
  );
}

function SettingsGroupContent({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({ children }: { children: ReactNode }) {
  return (
    <div
      className="border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border"
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function SettingsRow({
  control,
  description,
  label,
}: {
  control?: ReactNode;
  description?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
        {description ? <div className="min-w-0 text-sm text-token-text-secondary">{description}</div> : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

function LinkExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.30164 12.197V8.53003C4.30164 7.84109 4.30099 7.28391 4.33777 6.83374C4.3752 6.37598 4.45451 5.9701 4.64636 5.59351L4.76843 5.37573C5.07254 4.8798 5.50895 4.47626 6.03015 4.21069L6.17273 4.14331C6.50897 3.99911 6.86981 3.93484 7.27039 3.9021C7.72063 3.86531 8.27758 3.86499 8.96668 3.86499H9.13367L9.26746 3.87866C9.57036 3.94067 9.79855 4.20883 9.79871 4.53003C9.79871 4.85133 9.5704 5.11932 9.26746 5.1814L9.13367 5.19507H8.96668C8.25564 5.19507 7.7623 5.19596 7.37878 5.22729C7.09678 5.25034 6.90733 5.28812 6.76355 5.3396L6.63367 5.39526C6.33147 5.54924 6.07854 5.7835 5.90222 6.07104L5.83191 6.19702C5.75142 6.35498 5.69465 6.56664 5.66394 6.94214C5.63261 7.3256 5.63171 7.81917 5.63171 8.53003V12.197C5.63171 12.9081 5.63261 13.4014 5.66394 13.7849C5.69464 14.1606 5.7514 14.372 5.83191 14.53L5.90222 14.656C6.07854 14.9436 6.33141 15.1778 6.63367 15.3318L6.76355 15.3884C6.9073 15.4399 7.09693 15.4767 7.37878 15.4998C7.7623 15.5311 8.25564 15.532 8.96668 15.532H12.6337C13.3445 15.532 13.8381 15.5311 14.2216 15.4998C14.5971 15.469 14.8087 15.4123 14.9667 15.3318L15.0927 15.2615C15.3802 15.0852 15.6145 14.8322 15.7684 14.53L15.8241 14.4001C15.8756 14.2564 15.9134 14.0669 15.9364 13.7849C15.9677 13.4014 15.9686 12.9081 15.9686 12.197V12.03C15.9688 11.6629 16.2665 11.365 16.6337 11.365C17.0007 11.3652 17.2985 11.663 17.2987 12.03V12.197C17.2987 12.8861 17.2984 13.4431 17.2616 13.8933C17.2289 14.2939 17.1646 14.6547 17.0204 14.991L16.953 15.1335C16.6874 15.6547 16.2839 16.0912 15.788 16.3953L15.5702 16.5173C15.1936 16.7092 14.7877 16.7885 14.33 16.8259C13.8798 16.8627 13.3226 16.8621 12.6337 16.8621H8.96668C8.27758 16.8621 7.72063 16.8627 7.27039 16.8259C6.86974 16.7932 6.50902 16.728 6.17273 16.5837L6.03015 16.5173C5.50912 16.2519 5.07253 15.848 4.76843 15.3523L4.64636 15.1335C4.45456 14.7569 4.37518 14.3511 4.33777 13.8933C4.30098 13.4431 4.30164 12.8861 4.30164 12.197ZM12.1034 10.0007C11.8437 10.2603 11.4226 10.2604 11.163 10.0007C10.9033 9.74109 10.9034 9.32001 11.163 9.0603L12.1034 10.0007ZM18.1317 7.86401C18.1315 8.23113 17.8338 8.52905 17.4667 8.52905C17.0995 8.52905 16.8018 8.23113 16.8016 7.86401V5.30249L12.1034 10.0007L11.6337 9.53003L11.163 9.0603L15.8602 4.36206H13.2997C12.9326 4.36188 12.6346 4.06418 12.6346 3.69702C12.6346 3.32986 12.9326 3.03216 13.2997 3.03198H17.4667L17.6005 3.04565C17.9036 3.10759 18.1317 3.37559 18.1317 3.69702V7.86401Z"
        fill="currentColor"
      />
    </svg>
  );
}
