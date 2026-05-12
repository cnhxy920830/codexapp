import { useEffect, useState, type ReactNode } from "react";
import { REPLICA_STATSIG_GATES, useReplicaStatsigGateValue } from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import type { AppToast } from "./AppToastRegion";
import { PersonalizationChronicleSettings } from "./PersonalizationChronicleSettings";
import { ToggleSwitch } from "./ToggleSwitch";
import {
  listExperimentalFeatures,
  resetMemories,
  setExperimentalFeatureEnablement,
} from "../services/personalization";
import {
  batchWriteConfigValues,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  readConfig,
  type MemoriesConfigSnapshot,
} from "../services/settings";

const MEMORY_FEATURE_NAME = "memories";
const MEMORY_DOCS_URL = "https://developers.openai.com/codex/memories";

const DEFAULT_MEMORIES_CONFIG: MemoriesConfigSnapshot = {
  generateMemories: false,
  useMemories: false,
  disableOnExternalContext: false,
};

type MemorySettingsState = {
  featureEnabled: boolean;
  chronicleEnabled: boolean;
  memories: MemoriesConfigSnapshot;
  expectedVersion: string | null;
  filePath: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

const INITIAL_MEMORY_SETTINGS_STATE: MemorySettingsState = {
  featureEnabled: false,
  chronicleEnabled: false,
  memories: DEFAULT_MEMORIES_CONFIG,
  expectedVersion: null,
  filePath: null,
  isLoading: true,
  isSaving: false,
  error: null,
};

export function PersonalizationMemorySettings({
  onOpenChatWithPrompt,
  onShowToast,
  workspaceRoot,
}: {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const memoryGateEnabled = useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.memories);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [state, setState] = useState<MemorySettingsState>(INITIAL_MEMORY_SETTINGS_STATE);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
        const [configResponse, features] = await Promise.all([
          readConfig(workspaceRoot),
          listExperimentalFeatures().catch(() => []),
        ]);
        if (cancelled) {
          return;
        }
        const scopeOptions = buildConfigScopeOptions(configResponse);
        const selectedScopeKey = chooseDefaultConfigScopeKey(scopeOptions);
        const selectedScope = scopeOptions.find((scope) => scope.key === selectedScopeKey) ?? null;
        const scopedConfig = selectedScope?.config;
        const memoryFeature = features.find((feature) => feature.name === MEMORY_FEATURE_NAME) ?? null;
        setState({
          featureEnabled: memoryFeature?.enabled ?? false,
          chronicleEnabled:
            scopedConfig?.features?.chronicle === true ||
            configResponse.config.features?.chronicle === true,
          memories: scopedConfig?.memories ?? configResponse.config.memories ?? DEFAULT_MEMORIES_CONFIG,
          expectedVersion: selectedScope?.expectedVersion ?? null,
          filePath: selectedScope?.kind === "project" ? selectedScope.filePath : null,
          isLoading: false,
          isSaving: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          setState((current) => ({
            ...current,
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
  }, [refreshVersion, workspaceRoot]);

  const showMemorySettings = memoryGateEnabled || state.featureEnabled;

  if (!state.isLoading && state.error === null && !showMemorySettings) {
    return null;
  }

  const isBusy = state.isLoading || state.isSaving || isResetting;
  const memoriesEnabled = state.featureEnabled && state.memories.generateMemories && state.memories.useMemories;
  const canToggleToolContext = !isBusy && memoriesEnabled;

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
      chronicleEnabled: enabled ? current.chronicleEnabled : false,
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
        setExperimentalFeatureEnablement({ [MEMORY_FEATURE_NAME]: enabled }),
        batchWriteConfigValues({
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
            ...(!enabled && state.chronicleEnabled
              ? [
                  {
                    keyPath: "features.chronicle",
                    value: false,
                    mergeStrategy: "upsert" as const,
                  },
                ]
              : []),
          ],
          filePath: state.filePath,
          expectedVersion: state.expectedVersion,
          reloadUserConfig: true,
        }),
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
      await batchWriteConfigValues({
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
        filePath: state.filePath,
        expectedVersion: state.expectedVersion,
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
    if (isBusy || enabled === state.chronicleEnabled) {
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
      await batchWriteConfigValues({
        edits: [
          {
            keyPath: "features.chronicle",
            value: enabled,
            mergeStrategy: "upsert",
          },
        ],
        filePath: state.filePath,
        expectedVersion: state.expectedVersion,
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
      await resetMemories();
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
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.personalization.memory.title")}</div>
        <div className="app-text-muted mt-1 text-[12px] leading-5">
          {renderInlineLinkMessage(t("settings.personalization.memory.subtitle"), MEMORY_DOCS_URL)}
        </div>

        <div className="mt-4 space-y-4 text-[14px]">
          {state.error ? (
            <div className="app-card-error rounded-[14px] px-4 py-3 text-[13px]">{state.error}</div>
          ) : null}

          <MemorySettingRow
            label={t("settings.memory.enableMemoriesLabel")}
            description={t("settings.memory.enableMemoriesDescription")}
          >
            <ToggleSwitch
              checked={memoriesEnabled}
              disabled={isBusy}
              ariaLabel={t("settings.memory.enableMemoriesAriaLabel")}
              onChange={(checked) => void saveMemoriesEnabled(checked)}
            />
          </MemorySettingRow>

          <PersonalizationChronicleSettings
            checked={state.chronicleEnabled}
            disabled={isBusy}
            memoriesEnabled={memoriesEnabled}
            onOpenChatWithPrompt={onOpenChatWithPrompt}
            onSetEnabled={saveChronicleEnabled}
          />

          <MemorySettingRow
            label={t("settings.memory.noToolContextLabel")}
            description={t("settings.memory.noToolContextDescription")}
          >
            <ToggleSwitch
              checked={state.memories.disableOnExternalContext}
              disabled={!canToggleToolContext}
              ariaLabel={t("settings.memory.noToolContextAriaLabel")}
              onChange={(checked) => void saveDisableOnExternalContext(checked)}
            />
          </MemorySettingRow>

          <MemorySettingRow
            label={t("settings.memory.resetMemoriesLabel")}
            description={t("settings.memory.resetMemoriesDescription")}
          >
            <button
              type="button"
              disabled={isResetting}
              onClick={() => setIsResetDialogOpen(true)}
              className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {isResetting ? t("general.saving") : t("settings.memory.resetMemoriesButton")}
            </button>
          </MemorySettingRow>
        </div>
      </div>

      {isResetDialogOpen ? (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
          <div className="app-card w-full max-w-[420px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
            <div className="app-title text-[15px] font-medium">{t("settings.memory.resetDialogTitle")}</div>
            <div className="app-text-muted mt-2 text-[13px] leading-6">
              {t("settings.memory.resetDialogSubtitle")}
            </div>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setIsResetDialogOpen(false)}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("settings.memory.resetDialogCancel")}
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={() => void confirmReset()}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {isResetting ? t("general.saving") : t("settings.memory.resetDialogConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MemorySettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
      </div>
      {children}
    </div>
  );
}
