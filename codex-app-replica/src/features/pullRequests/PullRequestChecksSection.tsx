import { useMemo, useState } from "react";
import { ChevronDownIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import type { PullRequestCheck } from "../../services/pullRequests";
import { CheckStatusIcon } from "./PullRequestIcons";

type PullRequestChecksSectionProps = {
  checks: PullRequestCheck[];
  ciStatus: string;
  onOpenCheckUrl: (url: string) => void | Promise<void>;
};

type NormalizedCheckStatus = "failing" | "pending" | "skipped" | "successful" | "unknown";

export function PullRequestChecksSection({
  checks,
  ciStatus,
  onOpenCheckUrl,
}: PullRequestChecksSectionProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const normalizedChecks = useMemo(
    () =>
      checks.map((check) => ({
        ...check,
        normalizedStatus: normalizeCheckStatus(check.status),
      })),
    [checks],
  );

  if (normalizedChecks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((value) => !value)}
        className="app-card-muted flex w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left"
      >
        <SummaryStatusIcon ciStatus={ciStatus} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-6 text-[var(--app-shell-foreground)]">
          {formatCiStatusLabel(ciStatus, t)}
        </span>
        <ChevronDownIcon
          className={[
            "h-4 w-4 shrink-0 text-[var(--app-shell-subtle)] transition-transform",
            isExpanded ? "" : "-rotate-90",
          ].join(" ")}
        />
      </button>

      {isExpanded ? (
        <div className="space-y-1">
          {normalizedChecks.map((check, index) => {
            const checkLink = check.link;
            const row = (
              <div className="flex min-w-0 items-center gap-3 rounded-[12px] px-4 py-2 text-left">
                <CheckStatusIcon
                  className={["h-4 w-4 shrink-0", statusColorClass(check.normalizedStatus)].join(" ")}
                  status={check.normalizedStatus}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] leading-5">{check.label}</div>
                  <div className="app-text-muted truncate text-[12px] leading-5">
                    {formatCheckStatusLabel(check.normalizedStatus, t)}
                  </div>
                </div>
              </div>
            );

            return checkLink ? (
              <button
                key={`${check.label}:${checkLink}:${index}`}
                type="button"
                onClick={() => void onOpenCheckUrl(checkLink)}
                className="app-nav-item-idle flex w-full rounded-[12px]"
              >
                {row}
              </button>
            ) : (
              <div key={`${check.label}:${index}`} className="app-nav-item-idle rounded-[12px]">
                {row}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SummaryStatusIcon({ ciStatus }: { ciStatus: string }) {
  const normalizedStatus = normalizeCheckStatus(ciStatus);
  switch (normalizedStatus) {
    case "failing":
      return (
        <span className="flex size-4 shrink-0 items-center justify-center">
          <span className="size-2 rounded-full bg-[var(--app-shell-error-text)]" />
        </span>
      );
    case "pending":
      return (
        <span className="relative flex size-4 shrink-0 items-center justify-center text-amber-500">
          <span className="size-2 rounded-full bg-current" />
          <span className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-current border-r-current motion-safe:animate-spin" />
        </span>
      );
    case "successful":
      return (
        <CheckStatusIcon
          className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          status="successful"
        />
      );
    case "skipped":
    case "unknown":
      return <CheckStatusIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" status="unknown" />;
  }
}

function normalizeCheckStatus(status: string): NormalizedCheckStatus {
  switch (status) {
    case "failing":
      return "failing";
    case "pending":
      return "pending";
    case "skipped":
      return "skipped";
    case "passing":
    case "successful":
      return "successful";
    default:
      return "unknown";
  }
}

function formatCiStatusLabel(
  ciStatus: string,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (normalizeCheckStatus(ciStatus)) {
    case "failing":
      return t("pullRequestsPage.detail.checks.failing");
    case "pending":
      return t("pullRequestsPage.detail.checks.pending");
    case "successful":
      return t("pullRequestsPage.detail.checks.successful");
    case "skipped":
    case "unknown":
      return t("pullRequestsPage.detail.checks.none");
  }
}

function formatCheckStatusLabel(
  status: NormalizedCheckStatus,
  t: ReturnType<typeof useI18n>["t"],
) {
  switch (status) {
    case "failing":
      return t("pullRequestsPage.detail.checks.status.failing");
    case "pending":
      return t("pullRequestsPage.detail.checks.status.pending");
    case "skipped":
      return t("pullRequestsPage.detail.checks.status.skipped");
    case "successful":
      return t("pullRequestsPage.detail.checks.status.passed");
    case "unknown":
      return t("pullRequestsPage.detail.checks.status.unknown");
  }
}

function statusColorClass(status: NormalizedCheckStatus) {
  switch (status) {
    case "failing":
      return "text-[var(--app-shell-error-text)]";
    case "pending":
      return "text-amber-500";
    case "successful":
      return "text-emerald-600 dark:text-emerald-400";
    case "skipped":
    case "unknown":
      return "text-[var(--app-shell-subtle)]";
  }
}
