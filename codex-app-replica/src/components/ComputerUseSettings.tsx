import { useEffect, useState } from "react";
import { useI18n } from "../i18n/i18n";
import type { AppToast } from "./AppToastRegion";
import { FilteredPluginSettings } from "./FilteredPluginSettings";
import {
  readComputerUseApprovals,
  removeComputerUseApproval,
  type ComputerUseApprovedApp,
  type ComputerUseApprovalsState,
} from "../services/computerUseSettings";

export function ComputerUseSettings({
  onShowToast,
  workspaceRoot,
}: {
  onShowToast?: (toast: AppToast) => void;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();

  return (
    <FilteredPluginSettings
      workspaceRoot={workspaceRoot}
      pageTitle={t("computerUse.label")}
      installButtonLabel={t("settings.computerUse.install.button")}
      sectionTitle={t("settings.computerUse.install.title")}
      emptyState={t("settings.computerUse.install.empty")}
      pluginNames={["computer-use"]}
      renderAfterSections={() => <ComputerUseAllowedAppsPanel onShowToast={onShowToast} />}
    />
  );
}

function ComputerUseAllowedAppsPanel({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [approvalsState, setApprovalsState] = useState<ComputerUseApprovalsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [pendingBundleIdentifier, setPendingBundleIdentifier] = useState<string | null>(null);
  const [removeDialogApp, setRemoveDialogApp] = useState<ComputerUseApprovedApp | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadApprovals = async () => {
      setIsLoading(true);
      setHasLoadError(false);
      try {
        const nextState = await readComputerUseApprovals();
        if (!cancelled) {
          setApprovalsState(nextState);
        }
      } catch {
        if (!cancelled) {
          setApprovalsState(null);
          setHasLoadError(true);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadApprovals();

    return () => {
      cancelled = true;
    };
  }, []);

  const approvedApps = approvalsState?.approvedApps ?? [];

  const handleRemoveApproval = async () => {
    if (removeDialogApp == null || pendingBundleIdentifier !== null) {
      return;
    }

    setPendingBundleIdentifier(removeDialogApp.bundleIdentifier);
    try {
      const nextState = await removeComputerUseApproval({
        bundleIdentifier: removeDialogApp.bundleIdentifier,
      });
      if (nextState == null) {
        throw new Error("Computer use approvals are unavailable");
      }
      setApprovalsState(nextState);
      setRemoveDialogApp(null);
      onShowToast?.({
        tone: "success",
        message: t("settings.computerUse.allowedApps.saved"),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.computerUse.allowedApps.saveError"),
      });
    } finally {
      setPendingBundleIdentifier(null);
    }
  };

  return (
    <>
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.computerUse.allowedApps.title")}</div>
        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center gap-2 px-1 py-2 text-[13px] text-[var(--app-shell-subtle)]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-shell-subtle)] border-t-transparent" />
              <span>{t("settings.computerUse.allowedApps.loading")}</span>
            </div>
          ) : hasLoadError ? (
            <div className="app-text-muted px-1 py-2 text-[13px] leading-6">
              {t("settings.computerUse.allowedApps.loadError")}
            </div>
          ) : approvedApps.length === 0 ? (
            <div className="flex justify-center rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-4 text-[13px] text-[var(--app-shell-subtle)]">
              {t("settings.computerUse.allowedApps.emptyTitle")}
            </div>
          ) : (
            <div className="space-y-2">
              {approvedApps.map((approvedApp) => (
                <div
                  key={approvedApp.bundleIdentifier}
                  className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ComputerUseApprovedAppIcon approvedApp={approvedApp} />
                    <div className="min-w-0 truncate text-[13px] font-medium">{approvedApp.displayName}</div>
                  </div>
                  <button
                    type="button"
                    disabled={pendingBundleIdentifier !== null}
                    aria-label={t("settings.computerUse.allowedApps.removeAriaLabel", {
                      displayName: approvedApp.displayName,
                    })}
                    onClick={() => setRemoveDialogApp(approvedApp)}
                    className="app-control-weak flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] disabled:opacity-60"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {removeDialogApp ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">
              {t("settings.computerUse.allowedApps.removeDialogTitle", {
                displayName: removeDialogApp.displayName,
              })}
            </div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("settings.computerUse.allowedApps.removeDialogSubtitle", {
                displayName: removeDialogApp.displayName,
              })}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={pendingBundleIdentifier !== null}
                onClick={() => setRemoveDialogApp(null)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.computerUse.allowedApps.removeDialogCancel")}
              </button>
              <button
                type="button"
                disabled={pendingBundleIdentifier !== null}
                onClick={() => void handleRemoveApproval()}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("settings.computerUse.allowedApps.removeDialogConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ComputerUseApprovedAppIcon({
  approvedApp,
}: {
  approvedApp: ComputerUseApprovedApp;
}) {
  if (approvedApp.iconDataURL) {
    return (
      <img
        alt=""
        className="h-9 w-9 shrink-0 rounded-md"
        draggable={false}
        src={approvedApp.iconDataURL}
      />
    );
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--app-shell-hover-surface)] text-sm font-semibold text-[var(--app-shell-subtle)]">
      {approvedApp.displayName.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" />
    </svg>
  );
}
