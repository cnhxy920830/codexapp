import { emit } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NewChatIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { SettingsContentLayout } from "./SettingsContentLayout";
import {
  addBrowserUseFileTransferOrigin,
  addBrowserUseOrigin,
  clearBrowserBrowsingData,
  readBrowserAnnotationScreenshotsMode,
  readBrowserUseSettings,
  removeBrowserUseFileTransferOrigin,
  removeBrowserUseOrigin,
  writeBrowserAnnotationScreenshotsMode,
  writeBrowserUseApprovalMode,
  writeBrowserUseFileTransferApprovalMode,
  writeBrowserUseHistoryApprovalMode,
  type BrowserAnnotationScreenshotsMode,
  type BrowserUseApprovalMode,
  type BrowserBrowsingDataType,
  type BrowserUseFileTransferKind,
  type BrowserUseOriginKind,
  type BrowserUseSettingsState,
} from "../services/browserUseSettings";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { FilteredPluginSettings, type FilteredPluginSettingsRenderContext } from "./FilteredPluginSettings";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";

type BrowserUseResourceKind = "origins" | "downloads" | "uploads";

type AddOriginState = {
  kind: BrowserUseOriginKind;
  resource: BrowserUseResourceKind;
};

type RemoveOriginState = AddOriginState & {
  origin: string;
};

type BrowserBrowsingDataScope = "all" | BrowserBrowsingDataType;

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

const ALL_BROWSING_DATA_TYPES: BrowserBrowsingDataType[] = ["cookies", "siteData", "cache"];
const COMPUTER_USE_SETTINGS_PATH = "/settings/computer-use";
const NAVIGATE_TO_ROUTE_EVENT = "navigate-to-route";

export function BrowserUseSettings({
  hasComputerUseApprovalStore,
  onShowToast,
  selectedHostId,
  workspaceRoot,
}: {
  hasComputerUseApprovalStore: boolean;
  onShowToast?: (toast: AppToast) => void;
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const isLocalHost = selectedHostId === LOCAL_SETTINGS_HOST_ID;
  const effectiveWorkspaceRoot = isLocalHost ? workspaceRoot : null;
  const subtitle =
    isLocalHost && hasComputerUseApprovalStore
      ? renderComputerUseSettingsSubtitle(
          t("settings.browserUse.subtitle"),
          () => {
            void emit(NAVIGATE_TO_ROUTE_EVENT, { path: COMPUTER_USE_SETTINGS_PATH }).catch(() => undefined);
          },
        )
      : undefined;

  return (
    <SettingsContentLayout title={t("settings.browserUse.title")} subtitle={subtitle} subtitleClassName="text-pretty">
      <FilteredPluginSettings
        hostId={selectedHostId}
        workspaceRoot={effectiveWorkspaceRoot}
        installButtonLabel={t("settings.browserUse.install.button")}
        emptyState={t("settings.browserUse.install.empty")}
        pluginNames={["browser-use"]}
        getItemPresentation={() => ({
          controlLabel: t("settings.browserUse.control.title"),
          title: t("settings.browserUse.control.title"),
          description: t("settings.browserUse.control.description"),
          icon: <BrowserUseControlIcon className="h-full w-full text-[var(--app-shell-text)]" />,
          showIconBorder: false,
        })}
        renderAfterSections={(context) =>
          isBrowserUseEnabled(context)
            ? <BrowserUsePermissionsPanel onShowToast={onShowToast} />
            : null
        }
      />
    </SettingsContentLayout>
  );
}

function BrowserUsePermissionsPanel({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [settingsState, setSettingsState] = useState<BrowserUseSettingsState | null>(null);
  const [annotationScreenshotsMode, setAnnotationScreenshotsMode] =
    useState<BrowserAnnotationScreenshotsMode>("always");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingBrowsingDataScope, setPendingBrowsingDataScope] = useState<BrowserBrowsingDataScope | null>(null);
  const [isBrowsingDataOptionsOpen, setIsBrowsingDataOptionsOpen] = useState(false);
  const [isAnnotationScreenshotsPending, setIsAnnotationScreenshotsPending] = useState(false);
  const [addDialogState, setAddDialogState] = useState<AddOriginState | null>(null);
  const [originDraft, setOriginDraft] = useState("");
  const [removeOriginState, setRemoveOriginState] = useState<RemoveOriginState | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [nextSettingsState, nextAnnotationScreenshotsMode] = await Promise.all([
        readBrowserUseSettings(),
        readBrowserAnnotationScreenshotsMode(),
      ]);
      setSettingsState(nextSettingsState);
      setAnnotationScreenshotsMode(nextAnnotationScreenshotsMode);
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
        warning: t("settings.browserUse.approval.neverAsk.elevatedRiskDisclaimer"),
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

  const annotationScreenshotOptions = useMemo(
    () => [
      {
        value: "always",
        label: t("settings.browserUse.browser.annotationScreenshots.always.label"),
      },
      {
        value: "necessary",
        label: t("settings.browserUse.browser.annotationScreenshots.necessary.label"),
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

  const handleClearBrowsingData = async (
    scope: BrowserBrowsingDataScope,
    dataTypes: BrowserBrowsingDataType[],
  ) => {
    if (pendingBrowsingDataScope !== null) {
      return;
    }

    setPendingBrowsingDataScope(scope);
    try {
      await clearBrowserBrowsingData(dataTypes);
      onShowToast?.({
        tone: "success",
        message: t(getClearBrowsingDataSuccessMessageKey(scope)),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t(getClearBrowsingDataErrorMessageKey(scope)),
      });
    } finally {
      setPendingBrowsingDataScope(null);
    }
  };

  const handleAnnotationScreenshotsModeChange = async (value: string) => {
    const nextValue = value as BrowserAnnotationScreenshotsMode;
    if (isAnnotationScreenshotsPending || nextValue === annotationScreenshotsMode) {
      return;
    }

    setIsAnnotationScreenshotsPending(true);
    try {
      await writeBrowserAnnotationScreenshotsMode(nextValue);
      setAnnotationScreenshotsMode(nextValue);
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.browserUse.browser.annotationScreenshots.saveError"),
      });
    } finally {
      setIsAnnotationScreenshotsPending(false);
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
  const dataControlsDisabled = isLoading || pendingBrowsingDataScope !== null || isAnnotationScreenshotsPending;

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
        <div className="text-[14px] font-medium">{t("settings.browserUse.browser.title")}</div>
        <div className="mt-4 space-y-4">
          <SettingsRow
            label={t("settings.browserUse.browser.clearBrowsingData.label")}
            description={t("settings.browserUse.browser.clearBrowsingData.description")}
            control={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={dataControlsDisabled && pendingBrowsingDataScope !== "all"}
                  onClick={() => void handleClearBrowsingData("all", ALL_BROWSING_DATA_TYPES)}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {pendingBrowsingDataScope === "all"
                    ? t("general.saving")
                    : t("settings.browserUse.browser.clearBrowsingData")}
                </button>
                <button
                  type="button"
                  aria-controls="browser-browsing-data-options"
                  aria-expanded={isBrowsingDataOptionsOpen}
                  disabled={pendingBrowsingDataScope !== null}
                  onClick={() => setIsBrowsingDataOptionsOpen((value) => !value)}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {t(
                    isBrowsingDataOptionsOpen
                      ? "settings.browserUse.browser.hideClearOptions"
                      : "settings.browserUse.browser.showClearOptions",
                  )}
                </button>
              </div>
            }
          />

          {isBrowsingDataOptionsOpen ? (
            <div
              id="browser-browsing-data-options"
              className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]"
            >
              {ALL_BROWSING_DATA_TYPES.map((dataType, index) => (
                <div
                  key={dataType}
                  className={[
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 max-sm:grid-cols-1 max-sm:items-start",
                    index > 0 ? "border-t border-[var(--app-shell-border)]" : "",
                  ].join(" ")}
                >
                  <div className="min-w-0 text-[13px] text-[var(--app-shell-subtle)]">
                    {t(getClearBrowsingDataRowLabelKey(dataType))}
                  </div>
                  <button
                    type="button"
                    disabled={dataControlsDisabled && pendingBrowsingDataScope !== dataType}
                    onClick={() => void handleClearBrowsingData(dataType, [dataType])}
                    className="app-control justify-self-end rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60 max-sm:justify-self-start"
                  >
                    {pendingBrowsingDataScope === dataType
                      ? t("general.saving")
                      : t(getClearBrowsingDataButtonLabelKey(dataType))}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <SettingsRow
            label={t("settings.browserUse.browser.annotationScreenshots.label")}
            description={t("settings.browserUse.browser.annotationScreenshots.description")}
            control={
              <SettingsChoiceMenu
                disabled={dataControlsDisabled}
                onChange={(value) => {
                  void handleAnnotationScreenshotsModeChange(value);
                }}
                options={annotationScreenshotOptions}
                value={annotationScreenshotsMode}
              />
            }
          />
        </div>
      </div>

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

function BrowserUseControlIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M19.2512 17.5908L19.5422 17.6553L28.3547 20.2998C30.2132 20.8577 30.3283 23.4462 28.5266 24.167L24.9368 25.6025L23.5012 29.1924C22.7805 30.9941 20.1919 30.879 19.634 29.0205L16.9895 20.208C16.5509 18.7425 17.8048 17.3704 19.2512 17.5908ZM21.6028 28.2764L22.9954 24.8018L23.0833 24.6123C23.3089 24.1823 23.681 23.8434 24.136 23.6611L27.6106 22.2686L19.0266 19.6924L21.6028 28.2764Z"
        fill="currentColor"
      />
      <path
        d="M19.8665 4.28223C21.3889 4.28223 22.594 4.28312 23.5637 4.3623C24.5457 4.44254 25.379 4.60942 26.1399 4.99707C27.3722 5.62494 28.3752 6.6262 29.0032 7.8584C29.3908 8.6192 29.5577 9.45274 29.6379 10.4346C29.7172 11.4044 29.7161 12.611 29.7161 14.1338V15.333C29.7161 15.9127 29.2468 16.3834 28.6672 16.3838C28.0873 16.3838 27.6165 15.9129 27.6165 15.333V14.1338C27.6165 12.5765 27.6148 11.4709 27.5442 10.6064C27.4746 9.75478 27.3436 9.22892 27.1321 8.81348C26.7054 7.97616 26.0241 7.2948 25.1868 6.86816C24.7713 6.65645 24.2458 6.52374 23.3938 6.4541C22.5293 6.38347 21.4239 6.38379 19.8665 6.38379H12.134C10.5768 6.38379 9.4711 6.3835 8.60669 6.4541C7.75484 6.5237 7.22921 6.65658 6.81372 6.86816C5.9764 7.2948 5.29505 7.97616 4.86841 8.81348C4.65682 9.22896 4.52394 9.7546 4.45435 10.6064C4.38375 11.4709 4.38403 12.5765 4.38403 14.1338V17.999C4.38403 19.4929 4.38335 20.5535 4.44849 21.3838C4.51272 22.2025 4.63617 22.7087 4.8313 23.1104C5.26713 24.0075 5.99085 24.7329 6.88794 25.1689C7.28964 25.3641 7.79768 25.4856 8.61646 25.5498C9.44657 25.6149 10.506 25.6162 11.9993 25.6162C12.5792 25.6162 13.05 26.0871 13.05 26.667C13.0497 27.2466 12.5789 27.7158 11.9993 27.7158C10.5393 27.7158 9.38362 27.7166 8.45239 27.6436C7.50955 27.5696 6.70813 27.4152 5.97192 27.0576C4.65095 26.4159 3.58236 25.3493 2.94067 24.0283C2.58312 23.2921 2.4287 22.4907 2.35474 21.5479C2.28168 20.6164 2.28247 19.4596 2.28247 17.999V14.1338C2.28247 12.611 2.28331 11.4044 2.36255 10.4346C2.44281 9.45277 2.60967 8.61919 2.99731 7.8584C3.62517 6.6266 4.62684 5.62493 5.85864 4.99707C6.61943 4.60943 7.45301 4.44256 8.43481 4.3623C9.40463 4.28307 10.6112 4.28223 12.134 4.28223H19.8665Z"
        fill="currentColor"
      />
      <path
        d="M10.2761 9.30713C11.0272 9.30713 11.6354 9.9154 11.6354 10.6665C11.6354 11.4176 11.0272 12.0259 10.2761 12.0259C9.52518 12.0256 8.9167 11.4174 8.91669 10.6665C8.91669 9.91555 9.52517 9.30738 10.2761 9.30713Z"
        fill="currentColor"
      />
      <path
        d="M21.3334 9.5988C21.9225 9.5988 22.4011 10.0774 22.4011 10.6665C22.4011 11.2556 21.9225 11.7342 21.3334 11.7342H16C15.4109 11.7342 14.9323 11.2556 14.9323 10.6665C14.9323 10.0774 15.4109 9.5988 16 9.5988H21.3334Z"
        fill="currentColor"
      />
    </svg>
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

function getClearBrowsingDataRowLabelKey(dataType: BrowserBrowsingDataType): MessageKey {
  switch (dataType) {
    case "cookies":
      return "settings.browserUse.browser.cookies.label";
    case "siteData":
      return "settings.browserUse.browser.siteData.label";
    case "cache":
      return "settings.browserUse.browser.cache.label";
  }
}

function getClearBrowsingDataButtonLabelKey(dataType: BrowserBrowsingDataType): MessageKey {
  switch (dataType) {
    case "cookies":
      return "settings.browserUse.browser.clearCookies";
    case "siteData":
      return "settings.browserUse.browser.clearSiteData";
    case "cache":
      return "settings.browserUse.browser.clearCache";
  }
}

function getClearBrowsingDataSuccessMessageKey(scope: BrowserBrowsingDataScope): MessageKey {
  switch (scope) {
    case "all":
      return "settings.browserUse.browser.browsingDataCleared";
    case "cookies":
      return "settings.browserUse.browser.cookiesCleared";
    case "siteData":
      return "settings.browserUse.browser.siteDataCleared";
    case "cache":
      return "settings.browserUse.browser.cacheCleared";
  }
}

function getClearBrowsingDataErrorMessageKey(scope: BrowserBrowsingDataScope): MessageKey {
  switch (scope) {
    case "all":
      return "settings.browserUse.browser.clearBrowsingDataError";
    case "cookies":
      return "settings.browserUse.browser.clearCookiesError";
    case "siteData":
      return "settings.browserUse.browser.clearSiteDataError";
    case "cache":
      return "settings.browserUse.browser.clearCacheError";
  }
}

function renderComputerUseSettingsSubtitle(template: string, onNavigate: () => void) {
  const startTag = "<computerUseSettingsLink>";
  const endTag = "</computerUseSettingsLink>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const label = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <>
      {prefix}
      <button
        type="button"
        onClick={onNavigate}
        className="inline p-0 text-[var(--app-shell-accent)] underline underline-offset-2"
      >
        {label}
      </button>
      {suffix}
    </>
  );
}

function isBrowserUseEnabled(context: FilteredPluginSettingsRenderContext) {
  const browserUsePlugin = getBrowserUsePlugin(context);
  return browserUsePlugin?.plugin.installed === true && browserUsePlugin.plugin.enabled;
}

function getBrowserUsePlugin(context: FilteredPluginSettingsRenderContext) {
  return context.selectedPlugins.find((candidate) => {
    const pluginName = candidate.plugin.name.toLowerCase();
    const pluginPrefix = candidate.plugin.id.split("@")[0]?.toLowerCase();
    return pluginName === "browser-use" || pluginPrefix === "browser-use";
  });
}
