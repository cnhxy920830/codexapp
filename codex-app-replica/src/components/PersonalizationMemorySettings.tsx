import { useEffect, useState } from "react";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { PersonalizationChronicleSettings } from "./PersonalizationChronicleSettings";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsDialog, SettingsDialogFooter } from "./SettingsDialog";
import { SettingsRow } from "./SettingsRow";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import {
  listExperimentalFeaturesForHost,
  readChroniclePermissions,
  resetMemoriesForHost,
  setExperimentalFeatureForHost,
} from "../services/personalization";
import {
  batchWriteConfigValueForHost,
  readConfigForHost,
  resolveUserConfigWriteTarget,
  type MemoriesConfigSnapshot,
} from "../services/settings";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";

const MEMORY_FEATURE_NAME = "memories";
const MEMORY_DOCS_URL = "https://developers.openai.com/codex/memories";

const DEFAULT_MEMORIES_CONFIG: MemoriesConfigSnapshot = {
  generateMemories: false,
  useMemories: false,
  disableOnExternalContext: false,
};

type MemorySettingsState = {
  chronicleEnabled: boolean;
  chronicleSidecarPresent: boolean;
  chronicleVisible: boolean;
  featureEnabled: boolean;
  hasLoaded: boolean;
  memories: MemoriesConfigSnapshot;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  writeTargetFilePath: string | null;
};

const INITIAL_MEMORY_SETTINGS_STATE: MemorySettingsState = {
  chronicleEnabled: false,
  chronicleSidecarPresent: false,
  chronicleVisible: false,
  featureEnabled: false,
  hasLoaded: false,
  memories: DEFAULT_MEMORIES_CONFIG,
  isLoading: true,
  isSaving: false,
  error: null,
  writeTargetFilePath: null,
};

export function PersonalizationMemorySettings({
  onOpenChatWithPrompt,
  onShowToast,
  selectedHostId,
}: {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
  selectedHostId: string;
}) {
  const { t } = useI18n();
  const memoryGateEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.memories,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [state, setState] = useState<MemorySettingsState>(
    INITIAL_MEMORY_SETTINGS_STATE,
  );
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const isLocalHost = selectedHostId === LOCAL_SETTINGS_HOST_ID;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState((current) => ({
        ...current,
        isLoading: true,
        isSaving: false,
        error: null,
      }));

      try {
        const [configResponse, features, chroniclePermissions] = await Promise.all([
          readConfigForHost({
            hostId: selectedHostId,
            cwd: null,
            includeLayers: true,
          }),
          listExperimentalFeaturesForHost(selectedHostId),
          isLocalHost ? readChroniclePermissions().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) {
          return;
        }

        const memoryFeature =
          features.find((feature) => feature.name === MEMORY_FEATURE_NAME) ?? null;
        const featureEnabled = memoryFeature?.enabled === true;
        const memories = configResponse.config.memories ?? DEFAULT_MEMORIES_CONFIG;
        const chronicleEnabled = configResponse.config.features?.chronicle === true;
        const chronicleSidecarPresent = chroniclePermissions?.chronicleSidecarPresent === true;
        const writeTarget = resolveUserConfigWriteTarget(configResponse);

        setState({
          chronicleEnabled,
          chronicleSidecarPresent,
          chronicleVisible: isLocalHost && chronicleSidecarPresent,
          featureEnabled,
          hasLoaded: true,
          memories,
          isLoading: false,
          isSaving: false,
          error: null,
          writeTargetFilePath: writeTarget?.filePath ?? null,
        });

        if (!chronicleEnabled && isResetDialogOpen) {
          setIsResetDialogOpen(false);
        }
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isLocalHost, isResetDialogOpen, refreshVersion, selectedHostId]);

  const shouldShowMemorySection = memoryGateEnabled || state.featureEnabled;
  const memoriesEnabled =
    state.featureEnabled &&
    state.memories.generateMemories &&
    state.memories.useMemories;
  const isBusy = state.isLoading || state.isSaving || isResetting;
  const disableOnExternalContextDisabled = isBusy || !state.featureEnabled;
  const chronicleChecked = state.chronicleEnabled;

  if (!state.isLoading && state.error === null && !shouldShowMemorySection) {
    return null;
  }

  const reload = () => {
    setRefreshVersion((current) => current + 1);
  };

  const saveMemoriesEnabled = async (enabled: boolean) => {
    if (isBusy || enabled === memoriesEnabled) {
      return;
    }

    const previousState = state;
    setState((current) => ({
      ...current,
      featureEnabled: enabled,
      chronicleEnabled:
        enabled || !isLocalHost ? current.chronicleEnabled : false,
      memories: {
        ...current.memories,
        generateMemories: enabled,
        useMemories: enabled,
      },
      isSaving: true,
      error: null,
    }));

    try {
      await Promise.all([
        setExperimentalFeatureForHost(selectedHostId, MEMORY_FEATURE_NAME, enabled),
        batchWriteConfigValueForHost({
          hostId: selectedHostId,
          edits: [
            {
              keyPath: "memories.generate_memories",
              value: enabled,
              mergeStrategy: "upsert",
            },
            {
              keyPath: "memories.use_memories",
              value: enabled,
              mergeStrategy: "upsert",
            },
          ],
          filePath: state.writeTargetFilePath,
          expectedVersion: null,
          reloadUserConfig: true,
        }),
        !enabled && isLocalHost
          ? batchWriteConfigValueForHost({
              hostId: selectedHostId,
              edits: [
                {
                  keyPath: "features.chronicle",
                  value: false,
                  mergeStrategy: "upsert",
                },
              ],
              filePath: state.writeTargetFilePath,
              expectedVersion: null,
              reloadUserConfig: true,
            })
          : Promise.resolve(),
      ]);
      reload();
    } catch (error) {
      setState({
        ...previousState,
        isSaving: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveDisableOnExternalContext = async (enabled: boolean) => {
    if (isBusy || enabled === state.memories.disableOnExternalContext) {
      return;
    }

    const previousState = state;
    setState((current) => ({
      ...current,
      memories: {
        ...current.memories,
        disableOnExternalContext: enabled,
      },
      isSaving: true,
      error: null,
    }));

    try {
      await batchWriteConfigValueForHost({
        hostId: selectedHostId,
        edits: [
          {
            keyPath: "memories.disable_on_external_context",
            value: enabled,
            mergeStrategy: "upsert",
          },
          {
            keyPath: "memories.no_memories_if_mcp_or_web_search",
            value: null,
            mergeStrategy: "replace",
          },
        ],
        filePath: state.writeTargetFilePath,
        expectedVersion: null,
        reloadUserConfig: true,
      });
      reload();
    } catch (error) {
      setState({
        ...previousState,
        isSaving: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const saveChronicleEnabled = async (enabled: boolean) => {
    if (isBusy || enabled === chronicleChecked) {
      return;
    }

    const previousState = state;
    setState((current) => ({
      ...current,
      chronicleEnabled: enabled,
      isSaving: true,
      error: null,
    }));

    try {
      await batchWriteConfigValueForHost({
        hostId: selectedHostId,
        edits: [
          {
            keyPath: "features.chronicle",
            value: enabled,
            mergeStrategy: "upsert",
          },
        ],
        filePath: state.writeTargetFilePath,
        expectedVersion: null,
        reloadUserConfig: true,
      });
      reload();
    } catch (error) {
      setState({
        ...previousState,
        isSaving: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const confirmReset = async () => {
    if (isBusy) {
      return;
    }

    setIsResetting(true);
    try {
      await resetMemoriesForHost(selectedHostId);
      setIsResetDialogOpen(false);
      onShowToast?.({
        tone: "success",
        message: t("settings.memory.resetSuccess"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: error instanceof Error ? error.message : t("settings.memory.resetError"),
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <SettingsGroup className="gap-2">
        <SettingsGroup.Header
          title={t("settings.personalization.memory.title")}
          subtitle={renderInlineMemoryDescription(
            t("settings.personalization.memory.subtitle"),
          )}
        />
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsRow
              label={t("settings.memory.enableMemoriesLabel")}
              description={t("settings.memory.enableMemoriesDescription")}
              control={
                <ToggleSwitch
                  checked={memoriesEnabled}
                  disabled={isBusy}
                  ariaLabel={t("settings.memory.enableMemoriesAriaLabel")}
                  onChange={(checked) => {
                    void saveMemoriesEnabled(checked);
                  }}
                />
              }
            />

            {state.chronicleVisible ? (
              <PersonalizationChronicleSettings
                checked={chronicleChecked}
                disabled={isBusy || !state.featureEnabled}
                memoriesEnabled={memoriesEnabled}
                onOpenChatWithPrompt={onOpenChatWithPrompt}
                onSetEnabled={saveChronicleEnabled}
              />
            ) : null}

            <SettingsRow
              label={t("settings.memory.noToolContextLabel")}
              description={t("settings.memory.noToolContextDescription")}
              control={
                <ToggleSwitch
                  checked={state.memories.disableOnExternalContext}
                  disabled={disableOnExternalContextDisabled}
                  ariaLabel={t("settings.memory.noToolContextAriaLabel")}
                  onChange={(checked) => {
                    void saveDisableOnExternalContext(checked);
                  }}
                />
              }
            />

            <SettingsRow
              label={t("settings.memory.resetMemoriesLabel")}
              description={t("settings.memory.resetMemoriesDescription")}
              control={
                <Button
                  color="danger"
                  disabled={isResetting}
                  loading={isResetting}
                  onClick={() => setIsResetDialogOpen(true)}
                  size="toolbar"
                >
                  {t("settings.memory.resetMemoriesButton")}
                </Button>
              }
            />
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      {state.error ? (
        <div className="rounded-md border border-token-charts-red/20 bg-token-charts-red/5 px-3 py-2 text-sm text-token-charts-red">
          {state.error}
        </div>
      ) : null}

      {isResetDialogOpen ? (
        <MemoryResetDialog
          isResetting={isResetting}
          onCancel={() => setIsResetDialogOpen(false)}
          onConfirm={() => void confirmReset()}
        />
      ) : null}
    </>
  );
}

function MemoryResetDialog({
  isResetting,
  onCancel,
  onConfirm,
}: {
  isResetting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();

  return (
    <SettingsDialog
      footer={
        <SettingsDialogFooter
          cancelLabel={t("settings.memory.resetDialogCancel")}
          confirmLabel={t("settings.memory.resetDialogConfirm")}
          confirmLoading={isResetting}
          confirmTone="danger"
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      }
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open
      size="compact"
      title={t("settings.memory.resetDialogTitle")}
      subtitle={t("settings.memory.resetDialogSubtitle")}
    />
  );
}

function renderInlineMemoryDescription(template: string) {
  const startTag = "<a>";
  const endTag = "</a>";
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
      <a
        className="inline-flex text-token-text-link-foreground"
        href={MEMORY_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
      {suffix}
    </>
  );
}
