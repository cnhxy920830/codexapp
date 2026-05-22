import { emit } from "@tauri-apps/api/event";
import { useEffect, useEffectEvent, useId, useMemo, useState } from "react";
import { ChevronDownIcon, NewChatIcon, TrashIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsDialog, SettingsDialogFooter } from "./SettingsDialog";
import { FilteredPluginSettings, type FilteredPluginSettingsRenderContext } from "./FilteredPluginSettings";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSurface } from "./SettingsSurface";
import { Spinner } from "./Spinner";
import { useReplicaStatsigDynamicConfigValue } from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import {
  addBrowserUseOrigin,
  BROWSER_USE_SETTINGS_QUERY_KEY,
  clearBrowserBrowsingData,
  readBrowserAnnotationScreenshotsMode,
  readBrowserUseSettings,
  removeBrowserUseOrigin,
  writeBrowserAnnotationScreenshotsMode,
  writeBrowserUseApprovalMode,
  type BrowserAnnotationScreenshotsMode,
  type BrowserUseApprovalMode,
  type BrowserBrowsingDataType,
  type BrowserUseOriginKind,
  type BrowserUseSettingsState,
} from "../services/browserUseSettings";
import { openInBrowser } from "../services/hostFiles";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheKey,
} from "../services/queryCache";
import { onGlobalStateUpdated } from "../services/settings";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";

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

type OriginSectionConfig = {
  kind: BrowserUseOriginKind;
};

type RemoveOriginState = OriginSectionConfig & {
  origin: string;
};

const ALL_BROWSING_DATA_TYPES: BrowserBrowsingDataType[] = ["cookies", "siteData", "cache"];
const COMPUTER_USE_SETTINGS_PATH = "/settings/computer-use";
const NAVIGATE_TO_ROUTE_EVENT = "navigate-to-route";
const BROWSER_USE_APPROVAL_LINK_DYNAMIC_CONFIG = "4168530037";
const BROWSER_USE_LEARN_MORE_URL = "https://developers.openai.com/codex/app/computer-use";

const BROWSER_USE_ORIGIN_SECTION_COPY: Record<
  BrowserUseOriginKind,
  BrowserUseOriginSectionCopy
> = {
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
};

const BROWSER_USE_ORIGIN_SECTIONS: ReadonlyArray<OriginSectionConfig> = [
  { kind: "denied" },
  { kind: "allowed" },
];

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
      ? renderComputerUseSettingsSubtitle(t("settings.browserUse.subtitle"), () => {
          void emit(NAVIGATE_TO_ROUTE_EVENT, {
            path: COMPUTER_USE_SETTINGS_PATH,
          }).catch(() => undefined);
        })
      : undefined;

  return (
      <SettingsContentLayout
        title={t("settings.browserUse.title")}
        subtitle={subtitle}
        subtitleClassName="text-pretty"
    >
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
          icon: (
            <BrowserUseControlIcon className="h-full w-full text-[var(--app-shell-text)]" />
          ),
          showIconBorder: false,
        })}
        renderAfterSections={(context) =>
          isBrowserUseEnabled(context) ? (
            <BrowserUsePermissionsPanel onShowToast={onShowToast} />
          ) : null
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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pendingBrowsingDataScope, setPendingBrowsingDataScope] =
    useState<BrowserBrowsingDataScope | null>(null);
  const [isBrowsingDataOptionsOpen, setIsBrowsingDataOptionsOpen] = useState(false);
  const [isAnnotationScreenshotsPending, setIsAnnotationScreenshotsPending] =
    useState(false);
  const [addDialogState, setAddDialogState] = useState<OriginSectionConfig | null>(null);
  const [originDraft, setOriginDraft] = useState("");
  const [removeOriginState, setRemoveOriginState] = useState<RemoveOriginState | null>(null);
  const addDialogFormId = useId();
  const browserUseLearnMoreDynamicConfig = useReplicaStatsigDynamicConfigValue(
    BROWSER_USE_APPROVAL_LINK_DYNAMIC_CONFIG,
  );

  const loadBrowserUseSettings = useEffectEvent(async () => {
    setIsLoading(true);
    try {
      setSettingsState(await readBrowserUseSettings());
    } catch {
      setSettingsState(null);
    } finally {
      setIsLoading(false);
    }
  });

  const syncAnnotationScreenshotsMode = useEffectEvent(async () => {
    try {
      setAnnotationScreenshotsMode(await readBrowserAnnotationScreenshotsMode());
    } catch {
      setAnnotationScreenshotsMode("always");
    }
  });

  useEffect(() => {
    void loadBrowserUseSettings();
    void syncAnnotationScreenshotsMode();
  }, []);

  const handleQueryCacheInvalidate = useEffectEvent((queryKey: QueryCacheKey) => {
    if (!queryKeyMatchesPrefix(queryKey, BROWSER_USE_SETTINGS_QUERY_KEY)) {
      return;
    }

    void loadBrowserUseSettings();
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed) {
        handleQueryCacheInvalidate(notification.queryKey);
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onGlobalStateUpdated((notification) => {
      if (
        !disposed &&
        notification.keys.includes("browser-annotation-screenshots-mode")
      ) {
        void syncAnnotationScreenshotsMode();
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
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
        warningIcon: (
          <ElevatedRiskIcon className="icon-xs shrink-0 text-token-editor-warning-foreground" />
        ),
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

  const approvalMode = settingsState?.approvalMode ?? "alwaysAsk";
  const browserUseLearnMoreUrl = resolveBrowserUseLearnMoreUrl(
    browserUseLearnMoreDynamicConfig,
  );
  const controlsDisabled = isLoading || pendingAction !== null;
  const dataControlsDisabled =
    isLoading ||
    pendingBrowsingDataScope !== null ||
    isAnnotationScreenshotsPending;

  return (
    <>
      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.browserUse.browser.title")} />
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsRow
              label={t("settings.browserUse.browser.clearBrowsingData.label")}
              description={t("settings.browserUse.browser.clearBrowsingData.description")}
              control={
                <div className="flex items-center gap-1.5">
                  <Button
                    color="secondary"
                    disabled={dataControlsDisabled && pendingBrowsingDataScope !== "all"}
                    size="toolbar"
                    onClick={() =>
                      void handleClearBrowsingData("all", ALL_BROWSING_DATA_TYPES)
                    }
                  >
                    {pendingBrowsingDataScope === "all"
                      ? t("general.saving")
                      : t("settings.browserUse.browser.clearBrowsingData")}
                  </Button>
                  <Button
                    aria-controls="browser-browsing-data-options"
                    aria-expanded={isBrowsingDataOptionsOpen}
                    color="ghost"
                    disabled={pendingBrowsingDataScope !== null}
                    size="icon"
                    uniform
                    onClick={() => setIsBrowsingDataOptionsOpen((value) => !value)}
                  >
                    <span className="sr-only">
                      {t(
                        isBrowsingDataOptionsOpen
                          ? "settings.browserUse.browser.hideClearOptions"
                          : "settings.browserUse.browser.showClearOptions",
                      )}
                    </span>
                    <ChevronDownIcon
                      className={joinClasses(
                        "icon-2xs text-token-input-placeholder-foreground transition-transform",
                        isBrowsingDataOptionsOpen && "rotate-180",
                      )}
                    />
                  </Button>
                </div>
              }
            />

            {isBrowsingDataOptionsOpen ? (
              <div
                id="browser-browsing-data-options"
                className="flex flex-col divide-y divide-token-border bg-token-bg-secondary/20"
              >
                {ALL_BROWSING_DATA_TYPES.map((dataType) => (
                  <BrowsingDataOptionRow
                    key={dataType}
                    dataType={dataType}
                    disabled={
                      dataControlsDisabled && pendingBrowsingDataScope !== dataType
                    }
                    loading={pendingBrowsingDataScope === dataType}
                    onClear={() =>
                      void handleClearBrowsingData(dataType, [dataType])
                    }
                  />
                ))}
              </div>
            ) : null}

            <SettingsRow
              label={t("settings.browserUse.browser.annotationScreenshots.label")}
              description={t("settings.browserUse.browser.annotationScreenshots.description")}
              control={
                <SettingsChoiceMenu
                  className="w-[168px]"
                  disabled={dataControlsDisabled}
                  onChange={(value) => {
                    void handleAnnotationScreenshotsModeChange(value);
                  }}
                  options={annotationScreenshotOptions}
                  value={annotationScreenshotsMode}
                />
              }
            />
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsGroup.Header title={t("settings.browserUse.permissions.title")} />
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsRow
              label={t("settings.browserUse.approval.label")}
              description={renderInlineTagButton(
                t("settings.browserUse.approval.description"),
                "learnMoreLink",
                () => {
                  void openInBrowser(browserUseLearnMoreUrl);
                },
                "text-token-text-link-foreground hover:underline",
              )}
              control={
                <SettingsChoiceMenu
                  className="w-[152px]"
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
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      {BROWSER_USE_ORIGIN_SECTIONS.map((section) => (
        <OriginSection
          key={section.kind}
          config={section}
          isDisabled={controlsDisabled}
          isLoading={isLoading}
          onRequestAdd={() => {
            setOriginDraft("");
            setAddDialogState(section);
          }}
          onRequestRemove={(origin) => {
            setRemoveOriginState({ ...section, origin });
          }}
          origins={getOriginList(settingsState, section.kind)}
        />
      ))}

      {addDialogState ? (
        <SettingsDialog
          footer={
            <>
              <Button
                color="outline"
                disabled={pendingAction !== null}
                size="toolbar"
                type="button"
                onClick={() => {
                  setOriginDraft("");
                  setAddDialogState(null);
                }}
              >
                {t("settings.browserUse.domains.addDialogCancel")}
              </Button>
              <Button
                color="primary"
                disabled={originDraft.trim().length === 0 || pendingAction !== null}
                form={addDialogFormId}
                loading={pendingAction !== null}
                size="toolbar"
                type="submit"
              >
                {t("settings.browserUse.domains.addDialogConfirm")}
              </Button>
            </>
          }
          onOpenChange={(open) => {
            if (open) {
              return;
            }

            setOriginDraft("");
            setAddDialogState(null);
          }}
          open
          size="compact"
          title={t(getOriginSectionCopy(addDialogState.kind).addDialogTitleKey)}
          subtitle={t(getOriginSectionCopy(addDialogState.kind).addDialogSubtitleKey)}
        >
          <form
            id={addDialogFormId}
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void handleAddOrigin(addDialogState);
            }}
          >
            <input
              autoFocus
              aria-label={t("settings.browserUse.domains.addDialogAriaLabel")}
              className="rounded-xl border border-token-border px-3 py-2 text-base text-token-input-foreground shadow-sm outline-none placeholder:text-token-input-placeholder-foreground"
              onChange={(event) => setOriginDraft(event.currentTarget.value)}
              placeholder={t("settings.browserUse.domains.addDialogPlaceholder")}
              value={originDraft}
            />
          </form>
        </SettingsDialog>
      ) : null}

      {removeOriginState ? (
        <SettingsDialog
          footer={
            <SettingsDialogFooter
              cancelLabel={t("settings.browserUse.origins.removeDialogCancel")}
              confirmDisabled={pendingAction !== null}
              confirmLabel={t("settings.browserUse.origins.removeDialogConfirm")}
              confirmLoading={pendingAction !== null}
              confirmTone="danger"
              onCancel={() => setRemoveOriginState(null)}
              onConfirm={() => void handleRemoveOrigin(removeOriginState)}
            />
          }
          onOpenChange={(open) => {
            if (!open) {
              setRemoveOriginState(null);
            }
          }}
          open
          size="compact"
          title={t(
            getOriginSectionCopy(removeOriginState.kind).removeDialogTitleKey,
            { origin: removeOriginState.origin },
          )}
          subtitle={t(getOriginSectionCopy(removeOriginState.kind).removeDialogSubtitleKey)}
        />
      ) : null}
    </>
  );

  async function updateSettingsState(
    actionKey: string,
    save: () => Promise<BrowserUseSettingsState>,
    errorKey: MessageKey,
  ) {
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
  }

  async function handleClearBrowsingData(
    scope: BrowserBrowsingDataScope,
    dataTypes: BrowserBrowsingDataType[],
  ) {
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
  }

  async function handleAnnotationScreenshotsModeChange(value: string) {
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
  }

  async function handleAddOrigin(state: OriginSectionConfig) {
    const nextOrigin = originDraft.trim();
    if (nextOrigin.length === 0 || pendingAction !== null) {
      return;
    }

    const sectionCopy = getOriginSectionCopy(state.kind);
    setPendingAction(`add:${state.kind}`);

    try {
      const nextSettingsState = await addBrowserUseOrigin({
        kind: state.kind,
        origin: nextOrigin,
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
  }

  async function handleRemoveOrigin(state: RemoveOriginState) {
    if (pendingAction !== null) {
      return;
    }

    const sectionCopy = getOriginSectionCopy(state.kind);
    setPendingAction(`remove:${state.kind}:${state.origin}`);

    try {
      const nextSettingsState = await removeBrowserUseOrigin({
        kind: state.kind,
        origin: state.origin,
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
  }
}

function BrowsingDataOptionRow({
  dataType,
  disabled,
  loading,
  onClear,
}: {
  dataType: BrowserBrowsingDataType;
  disabled: boolean;
  loading: boolean;
  onClear: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-0.5 max-md:grid-cols-1 max-md:items-start max-md:gap-1 max-md:py-2">
      <div className="min-w-0 text-sm text-token-text-secondary">
        {t(getClearBrowsingDataRowLabelKey(dataType))}
      </div>
      <Button
        className="max-w-full justify-self-end text-left whitespace-normal max-md:-ml-2 max-md:justify-self-start"
        color="ghost"
        disabled={disabled}
        loading={loading}
        size="toolbar"
        onClick={onClear}
      >
        {t(getClearBrowsingDataButtonLabelKey(dataType))}
      </Button>
    </div>
  );
}

function resolveBrowserUseLearnMoreUrl(dynamicConfig: unknown) {
  const configuredUrl =
    dynamicConfig !== null &&
    typeof dynamicConfig === "object" &&
    !Array.isArray(dynamicConfig) &&
    typeof (dynamicConfig as { url?: unknown }).url === "string"
      ? (dynamicConfig as { url: string }).url.trim()
      : null;

  if (configuredUrl !== null) {
    try {
      const parsedUrl = new URL(configuredUrl);
      if (parsedUrl.protocol === "https:") {
        return configuredUrl;
      }
    } catch {
      // Fall back to the extracted default URL when the config value is not a valid https URL.
    }
  }

  return BROWSER_USE_LEARN_MORE_URL;
}

function OriginSection({
  config,
  isDisabled,
  isLoading,
  onRequestAdd,
  onRequestRemove,
  origins,
}: {
  config: OriginSectionConfig;
  isDisabled: boolean;
  isLoading: boolean;
  onRequestAdd: () => void;
  onRequestRemove: (origin: string) => void;
  origins: string[];
}) {
  const { t } = useI18n();
  const copy = getOriginSectionCopy(config.kind);

  return (
    <SettingsGroup>
      <SettingsGroup.Header
        actions={
          <Button color="secondary" disabled={isDisabled} size="toolbar" onClick={onRequestAdd}>
            <NewChatIcon className="icon-xs" />
            {t("settings.browserUse.domains.add")}
          </Button>
        }
        title={t(copy.titleKey)}
        subtitle={t(copy.subtitleKey)}
      />
      <SettingsGroup.Content>
        <SettingsSurface>
          {isLoading ? (
            <LoadingStateRow />
          ) : origins.length === 0 ? (
            <SettingsRow
              className="justify-center"
              label={
                <span className="text-token-text-secondary">
                  {t(copy.emptyTitleKey)}
                </span>
              }
              control={null}
            />
          ) : (
            origins.map((origin) => (
              <SettingsRow
                key={`${config.kind}:${origin}`}
                label={<span className="font-medium">{origin}</span>}
                control={
                  <Button
                    aria-label={t("settings.browserUse.origins.removeAriaLabel", {
                      origin,
                    })}
                    color="ghost"
                    disabled={isDisabled}
                    size="icon"
                    uniform
                    onClick={() => onRequestRemove(origin)}
                  >
                    <TrashIcon className="icon-2xs" />
                  </Button>
                }
              />
            ))
          )}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function LoadingStateRow() {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-2 p-4 text-sm text-token-text-secondary">
      <Spinner className="icon-xs" />
      {t("settings.browserUse.origins.loading")}
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

function ElevatedRiskIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.06543 1.95123C9.66107 1.69076 10.3389 1.69071 10.9346 1.95123L15.9346 4.13873C16.7832 4.51008 17.3311 5.34917 17.3311 6.27545V10.5528C17.3309 14.6017 14.0489 17.8847 10 17.8848C5.95108 17.8846 2.66813 14.6017 2.66797 10.5528V6.27545C2.66797 5.34924 3.21695 4.51012 4.06543 4.13873L9.06543 1.95123ZM10.4014 3.16998C10.1456 3.05814 9.85444 3.05819 9.59863 3.16998L4.59863 5.35748C4.23427 5.51708 3.99805 5.87764 3.99805 6.27545V10.5528C3.99821 13.8671 6.68563 16.5546 10 16.5547C13.3144 16.5546 16.0008 13.8671 16.001 10.5528V6.27545C16.001 5.87756 15.7658 5.51703 15.4014 5.35748L10.4014 3.16998Z"
        fill="currentColor"
      />
      <path
        d="M10.8883 13.1116C10.8883 13.6025 10.4903 14.0005 9.99936 14.0005C9.50844 14.0005 9.11047 13.6025 9.11047 13.1116C9.11047 12.6207 9.50844 12.2227 9.99936 12.2227C10.4903 12.2227 10.8883 12.6207 10.8883 13.1116Z"
        fill="currentColor"
      />
      <path
        d="M10.5169 10.8949L11.1135 7.31519C11.2283 6.62672 10.6974 6 9.99941 6C9.30145 6 8.77053 6.62672 8.88528 7.31519L9.4819 10.8949C9.52406 11.1479 9.74294 11.3333 9.99941 11.3333C10.2559 11.3333 10.4748 11.1479 10.5169 10.8949Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getOriginList(
  settingsState: BrowserUseSettingsState | null,
  kind: BrowserUseOriginKind,
) {
  return kind === "allowed"
    ? settingsState?.allowedOrigins ?? []
    : settingsState?.deniedOrigins ?? [];
}

function getOriginSectionCopy(kind: BrowserUseOriginKind) {
  return BROWSER_USE_ORIGIN_SECTION_COPY[kind];
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

function getClearBrowsingDataButtonLabelKey(
  dataType: BrowserBrowsingDataType,
): MessageKey {
  switch (dataType) {
    case "cookies":
      return "settings.browserUse.browser.clearCookies";
    case "siteData":
      return "settings.browserUse.browser.clearSiteData";
    case "cache":
      return "settings.browserUse.browser.clearCache";
  }
}

function getClearBrowsingDataSuccessMessageKey(
  scope: BrowserBrowsingDataScope,
): MessageKey {
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

function getClearBrowsingDataErrorMessageKey(
  scope: BrowserBrowsingDataScope,
): MessageKey {
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

function renderComputerUseSettingsSubtitle(
  template: string,
  onNavigate: () => void,
) {
  return renderInlineTagButton(
    template,
    "computerUseSettingsLink",
    onNavigate,
    "inline p-0 text-[var(--app-shell-accent)] underline underline-offset-2",
  );
}

function renderInlineTagButton(
  template: string,
  tagName: string,
  onClick: () => void,
  className: string,
) {
  const startTag = `<${tagName}>`;
  const endTag = `</${tagName}>`;
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
        onClick={onClick}
        className={className}
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

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter((value): value is string => Boolean(value)).join(" ");
}
