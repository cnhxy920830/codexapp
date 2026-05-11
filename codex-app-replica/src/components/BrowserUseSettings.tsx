import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NewChatIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import {
  addBrowserUseFileTransferOrigin,
  addBrowserUseOrigin,
  readBrowserUseSettings,
  removeBrowserUseFileTransferOrigin,
  removeBrowserUseOrigin,
  writeBrowserUseApprovalMode,
  writeBrowserUseFileTransferApprovalMode,
  writeBrowserUseHistoryApprovalMode,
  type BrowserUseApprovalMode,
  type BrowserUseFileTransferKind,
  type BrowserUseOriginKind,
  type BrowserUseSettingsState,
} from "../services/browserUseSettings";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { FilteredPluginSettings, type FilteredPluginSettingsRenderContext } from "./FilteredPluginSettings";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";

type BrowserUseResourceKind = "origins" | "downloads" | "uploads";

type AddOriginState = {
  kind: BrowserUseOriginKind;
  resource: BrowserUseResourceKind;
};

type RemoveOriginState = AddOriginState & {
  origin: string;
};

type BrowserUseOriginSectionCopy = {
  addDialogSubtitleKey: MessageKey;
  addDialogTitleKey: MessageKey;
  addedKey: MessageKey;
  emptyTitleKey: MessageKey;
  removedKey: MessageKey;
  removeDialogSubtitleKey: MessageKey;
  removeDialogTitleKey: MessageKey;
  subtitleKey: MessageKey;
  titleKey: MessageKey;
};

const BROWSER_USE_ORIGIN_SECTION_COPY: Record<
  BrowserUseResourceKind,
  Record<BrowserUseOriginKind, BrowserUseOriginSectionCopy>
> = {
  origins: {
    allowed: {
      addDialogSubtitleKey: "settings.browserUse.allowedDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.allowedDomains.addDialogTitle",
      addedKey: "settings.browserUse.allowedDomains.added",
      emptyTitleKey: "settings.browserUse.allowedDomains.emptyTitle",
      removedKey: "settings.browserUse.allowedWebsites.saved",
      removeDialogSubtitleKey: "settings.browserUse.allowedWebsites.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.allowedWebsites.removeDialogTitle",
      subtitleKey: "settings.browserUse.allowedDomains.subtitle",
      titleKey: "settings.browserUse.allowedDomains.title",
    },
    denied: {
      addDialogSubtitleKey: "settings.browserUse.blockedDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.blockedDomains.addDialogTitle",
      addedKey: "settings.browserUse.blockedDomains.added",
      emptyTitleKey: "settings.browserUse.blockedDomains.emptyTitle",
      removedKey: "settings.browserUse.deniedWebsites.saved",
      removeDialogSubtitleKey: "settings.browserUse.deniedWebsites.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.deniedWebsites.removeDialogTitle",
      subtitleKey: "settings.browserUse.blockedDomains.subtitle",
      titleKey: "settings.browserUse.blockedDomains.title",
    },
  },
  downloads: {
    allowed: {
      addDialogSubtitleKey: "settings.browserUse.allowedDownloadDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.allowedDownloadDomains.addDialogTitle",
      addedKey: "settings.browserUse.allowedDownloadDomains.added",
      emptyTitleKey: "settings.browserUse.allowedDownloadDomains.emptyTitle",
      removedKey: "settings.browserUse.allowedDownloadDomains.removed",
      removeDialogSubtitleKey: "settings.browserUse.allowedDownloadDomains.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.allowedDownloadDomains.removeDialogTitle",
      subtitleKey: "settings.browserUse.allowedDownloadDomains.subtitle",
      titleKey: "settings.browserUse.allowedDownloadDomains.title",
    },
    denied: {
      addDialogSubtitleKey: "settings.browserUse.blockedDownloadDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.blockedDownloadDomains.addDialogTitle",
      addedKey: "settings.browserUse.blockedDownloadDomains.added",
      emptyTitleKey: "settings.browserUse.blockedDownloadDomains.emptyTitle",
      removedKey: "settings.browserUse.blockedDownloadDomains.removed",
      removeDialogSubtitleKey: "settings.browserUse.blockedDownloadDomains.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.blockedDownloadDomains.removeDialogTitle",
      subtitleKey: "settings.browserUse.blockedDownloadDomains.subtitle",
      titleKey: "settings.browserUse.blockedDownloadDomains.title",
    },
  },
  uploads: {
    allowed: {
      addDialogSubtitleKey: "settings.browserUse.allowedUploadDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.allowedUploadDomains.addDialogTitle",
      addedKey: "settings.browserUse.allowedUploadDomains.added",
      emptyTitleKey: "settings.browserUse.allowedUploadDomains.emptyTitle",
      removedKey: "settings.browserUse.allowedUploadDomains.removed",
      removeDialogSubtitleKey: "settings.browserUse.allowedUploadDomains.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.allowedUploadDomains.removeDialogTitle",
      subtitleKey: "settings.browserUse.allowedUploadDomains.subtitle",
      titleKey: "settings.browserUse.allowedUploadDomains.title",
    },
    denied: {
      addDialogSubtitleKey: "settings.browserUse.blockedUploadDomains.addDialogSubtitle",
      addDialogTitleKey: "settings.browserUse.blockedUploadDomains.addDialogTitle",
      addedKey: "settings.browserUse.blockedUploadDomains.added",
      emptyTitleKey: "settings.browserUse.blockedUploadDomains.emptyTitle",
      removedKey: "settings.browserUse.blockedUploadDomains.removed",
      removeDialogSubtitleKey: "settings.browserUse.blockedUploadDomains.removeDialogSubtitle",
      removeDialogTitleKey: "settings.browserUse.blockedUploadDomains.removeDialogTitle",
      subtitleKey: "settings.browserUse.blockedUploadDomains.subtitle",
      titleKey: "settings.browserUse.blockedUploadDomains.title",
    },
  },
};

const BROWSER_USE_ORIGIN_SECTIONS: ReadonlyArray<AddOriginState> = [
  { kind: "denied", resource: "origins" },
  { kind: "allowed", resource: "origins" },
  { kind: "denied", resource: "downloads" },
  { kind: "allowed", resource: "downloads" },
  { kind: "denied", resource: "uploads" },
  { kind: "allowed", resource: "uploads" },
];

export function BrowserUseSettings({
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
      pageTitle={t("settings.section.browser-use")}
      installButtonLabel={t("settings.browserUse.install.button")}
      sectionTitle={t("settings.browserUse.install.title")}
      emptyState={t("settings.browserUse.install.empty")}
      pluginNames={["browser-use", "chrome", "chrome-internal"]}
      renderAfterSections={(context) =>
        isBrowserUseInstalled(context) ? <BrowserUsePermissionsPanel onShowToast={onShowToast} /> : null
      }
    />
  );
}

function BrowserUsePermissionsPanel({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [settingsState, setSettingsState] = useState<BrowserUseSettingsState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [addDialogState, setAddDialogState] = useState<AddOriginState | null>(null);
  const [originDraft, setOriginDraft] = useState("");
  const [removeOriginState, setRemoveOriginState] = useState<RemoveOriginState | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setSettingsState(await readBrowserUseSettings());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setSettingsState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const approvalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.approval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.approval.neverAsk.description"),
      },
    ],
    [t],
  );

  const historyApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.historyApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.historyApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const downloadApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.downloadApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.downloadApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const uploadApprovalOptions = useMemo(
    () => [
      {
        value: "alwaysAsk",
        label: t("settings.browserUse.approval.alwaysAsk.label"),
        description: t("settings.browserUse.uploadApproval.alwaysAsk.description"),
      },
      {
        value: "neverAsk",
        label: t("settings.browserUse.approval.neverAsk.label"),
        description: t("settings.browserUse.uploadApproval.neverAsk.description"),
      },
    ],
    [t],
  );

  const updateSettingsState = async (
    actionKey: string,
    save: () => Promise<BrowserUseSettingsState>,
    errorKey: MessageKey,
  ) => {
    if (pendingAction !== null) {
      return;
    }
    setPendingAction(actionKey);
    try {
      setSettingsState(await save());
    } catch {
      onShowToast?.({
        tone: "error",
        message: t(errorKey),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleAddOrigin = async (state: AddOriginState) => {
    const nextOrigin = originDraft.trim();
    if (nextOrigin.length === 0 || pendingAction !== null) {
      return;
    }

    const sectionCopy = getOriginSectionCopy(state.resource, state.kind);
    setPendingAction(`add:${state.resource}:${state.kind}`);

    try {
      const nextSettingsState =
        state.resource === "origins"
          ? await addBrowserUseOrigin({
              kind: state.kind,
              origin: nextOrigin,
            })
          : await addBrowserUseFileTransferOrigin({
              kind: state.kind,
              origin: nextOrigin,
              transferKind: getFileTransferKind(state.resource),
            });

      setSettingsState(nextSettingsState);
      setOriginDraft("");
      setAddDialogState(null);
      onShowToast?.({
        tone: "success",
        message: t(sectionCopy.addedKey),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.browserUse.domains.addError"),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const handleRemoveOrigin = async (state: RemoveOriginState) => {
    if (pendingAction !== null) {
      return;
    }

    const sectionCopy = getOriginSectionCopy(state.resource, state.kind);
    setPendingAction(`remove:${state.resource}:${state.kind}:${state.origin}`);

    try {
      const nextSettingsState =
        state.resource === "origins"
          ? await removeBrowserUseOrigin({
              kind: state.kind,
              origin: state.origin,
            })
          : await removeBrowserUseFileTransferOrigin({
              kind: state.kind,
              origin: state.origin,
              transferKind: getFileTransferKind(state.resource),
            });

      setSettingsState(nextSettingsState);
      setRemoveOriginState(null);
      onShowToast?.({
        tone: "success",
        message: t(sectionCopy.removedKey),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.browserUse.origins.saveError"),
      });
    } finally {
      setPendingAction(null);
    }
  };

  const approvalMode = settingsState?.approvalMode ?? "alwaysAsk";
  const historyApprovalMode = settingsState?.historyApprovalMode ?? "alwaysAsk";
  const downloadApprovalMode = settingsState?.downloadApprovalMode ?? "alwaysAsk";
  const uploadApprovalMode = settingsState?.uploadApprovalMode ?? "alwaysAsk";
  const controlsDisabled = isLoading || pendingAction !== null;

  if (loadError) {
    return (
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.browserUse.permissions.title")}</div>
        <div className="app-text-muted mt-2 text-[13px] leading-6">{loadError}</div>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {t("skills.appsPage.loadError.retry")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.browserUse.permissions.title")}</div>
        <div className="mt-4 space-y-4">
          <SettingsRow
            label={t("settings.browserUse.approval.label")}
            description={t("settings.browserUse.approval.description")}
            control={
              <SettingsChoiceMenu
                disabled={controlsDisabled}
                onChange={(value) => {
                  if (value === approvalMode) {
                    return;
                  }
                  void updateSettingsState(
                    "approval",
                    () =>
                      writeBrowserUseApprovalMode({
                        approvalMode: value as BrowserUseApprovalMode,
                      }),
                    "settings.browserUse.approval.saveError",
                  );
                }}
                options={approvalOptions}
                value={approvalMode}
              />
            }
          />
          <SettingsRow
            label={t("settings.browserUse.historyApproval.label")}
            description={t("settings.browserUse.historyApproval.description")}
            control={
              <SettingsChoiceMenu
                disabled={controlsDisabled}
                onChange={(value) => {
                  if (value === historyApprovalMode) {
                    return;
                  }
                  void updateSettingsState(
                    "historyApproval",
                    () =>
                      writeBrowserUseHistoryApprovalMode({
                        approvalMode: value as BrowserUseApprovalMode,
                      }),
                    "settings.browserUse.historyApproval.saveError",
                  );
                }}
                options={historyApprovalOptions}
                value={historyApprovalMode}
              />
            }
          />
          <SettingsRow
            label={t("settings.browserUse.downloadApproval.label")}
            description={t("settings.browserUse.downloadApproval.description")}
            control={
              <SettingsChoiceMenu
                disabled={controlsDisabled}
                onChange={(value) => {
                  if (value === downloadApprovalMode) {
                    return;
                  }
                  void updateSettingsState(
                    "downloadApproval",
                    () =>
                      writeBrowserUseFileTransferApprovalMode({
                        kind: "download",
                        approvalMode: value as BrowserUseApprovalMode,
                      }),
                    "settings.browserUse.downloadApproval.saveError",
                  );
                }}
                options={downloadApprovalOptions}
                value={downloadApprovalMode}
              />
            }
          />
          <SettingsRow
            label={t("settings.browserUse.uploadApproval.label")}
            description={t("settings.browserUse.uploadApproval.description")}
            control={
              <SettingsChoiceMenu
                disabled={controlsDisabled}
                onChange={(value) => {
                  if (value === uploadApprovalMode) {
                    return;
                  }
                  void updateSettingsState(
                    "uploadApproval",
                    () =>
                      writeBrowserUseFileTransferApprovalMode({
                        kind: "upload",
                        approvalMode: value as BrowserUseApprovalMode,
                      }),
                    "settings.browserUse.uploadApproval.saveError",
                  );
                }}
                options={uploadApprovalOptions}
                value={uploadApprovalMode}
              />
            }
          />
        </div>
      </div>

      {BROWSER_USE_ORIGIN_SECTIONS.map(({ kind, resource }) => {
        const sectionCopy = getOriginSectionCopy(resource, kind);
        return (
          <OriginSection
            key={`${resource}:${kind}`}
            emptyTitle={t(sectionCopy.emptyTitleKey)}
            kind={kind}
            isDisabled={controlsDisabled}
            isLoading={isLoading}
            onRequestAdd={() => {
              setOriginDraft("");
              setAddDialogState({ kind, resource });
            }}
            onRequestRemove={(origin) => setRemoveOriginState({ kind, resource, origin })}
            origins={getOriginList(settingsState, resource, kind)}
            resource={resource}
            subtitle={t(sectionCopy.subtitleKey)}
            title={t(sectionCopy.titleKey)}
          />
        );
      })}

      {addDialogState ? (
        <DialogShell
          confirmLabel={t("settings.browserUse.domains.addDialogConfirm")}
          disableConfirm={originDraft.trim().length === 0 || pendingAction !== null}
          onClose={() => {
            setOriginDraft("");
            setAddDialogState(null);
          }}
          onConfirm={() => void handleAddOrigin(addDialogState)}
          title={t(getOriginSectionCopy(addDialogState.resource, addDialogState.kind).addDialogTitleKey)}
        >
          <div className="app-text-muted text-[13px] leading-6">
            {t(getOriginSectionCopy(addDialogState.resource, addDialogState.kind).addDialogSubtitleKey)}
          </div>
          <input
            autoFocus
            aria-label={t("settings.browserUse.domains.addDialogAriaLabel")}
            value={originDraft}
            onChange={(event) => setOriginDraft(event.target.value)}
            placeholder={t("settings.browserUse.domains.addDialogPlaceholder")}
            className="app-control app-text-input mt-4 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
          />
        </DialogShell>
      ) : null}

      {removeOriginState ? (
        <DialogShell
          confirmLabel={t("settings.browserUse.origins.removeDialogConfirm")}
          confirmTone="danger"
          disableConfirm={pendingAction !== null}
          onClose={() => setRemoveOriginState(null)}
          onConfirm={() => void handleRemoveOrigin(removeOriginState)}
          title={t(
            getOriginSectionCopy(removeOriginState.resource, removeOriginState.kind).removeDialogTitleKey,
            { origin: removeOriginState.origin },
          )}
        >
          <div className="app-text-muted text-[13px] leading-6">
            {t(getOriginSectionCopy(removeOriginState.resource, removeOriginState.kind).removeDialogSubtitleKey)}
          </div>
        </DialogShell>
      ) : null}
    </>
  );
}

function OriginSection({
  emptyTitle,
  isDisabled,
  isLoading,
  kind,
  onRequestAdd,
  onRequestRemove,
  origins,
  resource,
  subtitle,
  title,
}: {
  emptyTitle: string;
  isDisabled: boolean;
  isLoading: boolean;
  kind: BrowserUseOriginKind;
  onRequestAdd: () => void;
  onRequestRemove: (origin: string) => void;
  origins: string[];
  resource: BrowserUseResourceKind;
  subtitle: string;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[14px] font-medium">{title}</div>
          <div className="app-text-muted mt-1 text-[13px] leading-6">{subtitle}</div>
        </div>
        <button
          type="button"
          disabled={isDisabled}
          onClick={onRequestAdd}
          className="app-control inline-flex shrink-0 items-center gap-2 rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          <NewChatIcon className="h-3.5 w-3.5" />
          <span>{t("settings.browserUse.domains.add")}</span>
        </button>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="app-text-muted text-[13px] leading-6">{t("settings.browserUse.origins.loading")}</div>
        ) : origins.length === 0 ? (
          <div className="app-text-muted text-[13px] leading-6">{emptyTitle}</div>
        ) : (
          <div className="space-y-2">
            {origins.map((origin) => (
              <div
                key={`${resource}:${kind}:${origin}`}
                className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
              >
                <div className="min-w-0 truncate text-[13px] font-medium">{origin}</div>
                <button
                  type="button"
                  disabled={isDisabled}
                  aria-label={t("settings.browserUse.origins.removeAriaLabel", { origin })}
                  onClick={() => onRequestRemove(origin)}
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
  );
}

function SettingsRow({
  control,
  description,
  label,
}: {
  control: ReactNode;
  description: string;
  label: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 flex-1">
        <div className="text-[14px]">{label}</div>
        <div className="app-text-muted mt-1 text-[13px] leading-6">{description}</div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

function DialogShell({
  children,
  confirmLabel,
  confirmTone,
  disableConfirm,
  onClose,
  onConfirm,
  title,
}: {
  children: ReactNode;
  confirmLabel: string;
  confirmTone?: "danger";
  disableConfirm: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="app-title text-[15px] font-medium">{title}</div>
        <div className="mt-2">{children}</div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t(
              confirmTone === "danger"
                ? "settings.browserUse.origins.removeDialogCancel"
                : "settings.browserUse.domains.addDialogCancel",
            )}
          </button>
          <button
            type="button"
            disabled={disableConfirm}
            onClick={onConfirm}
            className={[
              confirmTone === "danger" ? "app-card-error" : "app-control",
              "rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60",
            ].join(" ")}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
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

function getFileTransferKind(
  resource: Exclude<BrowserUseResourceKind, "origins">,
): BrowserUseFileTransferKind {
  switch (resource) {
    case "downloads":
      return "download";
    case "uploads":
      return "upload";
  }
}

function getOriginList(
  settingsState: BrowserUseSettingsState | null,
  resource: BrowserUseResourceKind,
  kind: BrowserUseOriginKind,
) {
  switch (resource) {
    case "origins":
      return kind === "allowed"
        ? (settingsState?.allowedOrigins ?? [])
        : (settingsState?.deniedOrigins ?? []);
    case "downloads":
      return kind === "allowed"
        ? (settingsState?.allowedDownloadOrigins ?? [])
        : (settingsState?.deniedDownloadOrigins ?? []);
    case "uploads":
      return kind === "allowed"
        ? (settingsState?.allowedUploadOrigins ?? [])
        : (settingsState?.deniedUploadOrigins ?? []);
  }
}

function getOriginSectionCopy(resource: BrowserUseResourceKind, kind: BrowserUseOriginKind) {
  return BROWSER_USE_ORIGIN_SECTION_COPY[resource][kind];
}

function isBrowserUseInstalled(context: FilteredPluginSettingsRenderContext) {
  const browserUsePlugin = context.selectedPlugins.find((candidate) => {
    const pluginName = candidate.plugin.name.toLowerCase();
    const pluginPrefix = candidate.plugin.id.split("@")[0]?.toLowerCase();
    return pluginName === "browser-use" || pluginPrefix === "browser-use";
  });

  return browserUsePlugin?.plugin.installed === true;
}
