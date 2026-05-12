import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import type { AppToast } from "./AppToastRegion";
import { CheckIcon } from "./AppShellIcons";
import { PersonalizationMemorySettings } from "./PersonalizationMemorySettings";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";
import {
  readWorkspaceAgentsMd,
  writeWorkspaceAgentsMd,
  type WorkspaceAgentsMdDocument,
} from "../services/personalization";
import {
  batchWriteConfigValues,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  readConfig,
  setPersonality,
  type ConfigPersonality,
} from "../services/settings";

const AGENTS_MD_DOCS_URL = "https://developers.openai.com/codex/guides/agents-md/#create-global-guidance";

const PERSONALITY_OPTIONS = [
  {
    value: "friendly" as const,
    labelKey: "composer.personalitySlashCommand.label.friendly" as const,
    descriptionKey: "composer.personalitySlashCommand.description.friendly" as const,
  },
  {
    value: "pragmatic" as const,
    labelKey: "composer.personalitySlashCommand.label.pragmatic" as const,
    descriptionKey: "composer.personalitySlashCommand.description.pragmatic" as const,
  },
];

type PersonalityState = {
  activePersonality: Exclude<ConfigPersonality, "none">;
  expectedVersion: string | null;
  filePath: string | null;
  hasExplicitPersonality: boolean;
  hasLegacyModelPersonality: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

const INITIAL_PERSONALITY_STATE: PersonalityState = {
  activePersonality: "friendly",
  expectedVersion: null,
  filePath: null,
  hasExplicitPersonality: false,
  hasLegacyModelPersonality: false,
  isLoading: true,
  isSaving: false,
  error: null,
};

export function PersonalizationSettings({
  onOpenChatWithPrompt,
  onShowToast,
  workspaceRoot,
}: {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const showPersonalityCard = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.personality,
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [personalityState, setPersonalityState] = useState<PersonalityState>(INITIAL_PERSONALITY_STATE);
  const [document, setDocument] = useState<WorkspaceAgentsMdDocument | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const personalityMigrationAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPersonality = async () => {
      try {
        const response = await readConfig(workspaceRoot);
        if (cancelled) {
          return;
        }
        const scopeOptions = buildConfigScopeOptions(response);
        const selectedScopeKey = chooseDefaultConfigScopeKey(scopeOptions);
        const selectedScope = scopeOptions.find((scope) => scope.key === selectedScopeKey) ?? null;
        const scopedConfig = selectedScope?.config;
        const scopedPersonality = scopedConfig?.personality ?? response.config.personality;
        const scopedModelPersonality = scopedConfig?.modelPersonality ?? response.config.modelPersonality;
        setPersonalityState({
          activePersonality: resolveSelectablePersonality(scopedPersonality ?? scopedModelPersonality),
          expectedVersion: selectedScope?.expectedVersion ?? null,
          filePath: selectedScope?.kind === "project" ? selectedScope.filePath : null,
          hasExplicitPersonality: scopedPersonality !== null,
          hasLegacyModelPersonality: scopedModelPersonality !== null,
          isLoading: false,
          isSaving: false,
          error: null,
        });
      } catch (error) {
        if (!cancelled) {
          setPersonalityState((current) => ({
            ...current,
            isLoading: false,
            isSaving: false,
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      }
    };

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      setPersonalityState((current) => ({
        ...current,
        isLoading: true,
        error: null,
      }));
      try {
        const [nextDocument] = await Promise.all([readWorkspaceAgentsMd(workspaceRoot), loadPersonality()]);
        if (cancelled) {
          return;
        }
        setDocument(nextDocument);
        setDraft(null);
      } catch (error) {
        if (!cancelled) {
          setDocument(null);
          setDraft(null);
          setLoadError(error instanceof Error ? error.message : String(error));
        }
        await loadPersonality();
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [refreshVersion, workspaceRoot]);

  useEffect(() => {
    if (personalityState.isLoading || personalityState.isSaving || personalityState.error) {
      return;
    }
    void setPersonality(personalityState.activePersonality);
  }, [
    personalityState.activePersonality,
    personalityState.error,
    personalityState.isLoading,
    personalityState.isSaving,
  ]);

  useEffect(() => {
    const migrationKey = `${workspaceRoot ?? ""}:${personalityState.filePath ?? "user"}`;
    if (
      personalityState.isLoading ||
      personalityState.isSaving ||
      personalityState.hasExplicitPersonality ||
      !personalityState.hasLegacyModelPersonality ||
      personalityMigrationAttemptRef.current === migrationKey
    ) {
      return;
    }
    personalityMigrationAttemptRef.current = migrationKey;
    void batchWriteConfigValues({
      edits: [
        {
          keyPath: "personality",
          value: personalityState.activePersonality,
          mergeStrategy: "upsert",
        },
        {
          keyPath: "model_personality",
          value: null,
          mergeStrategy: "replace",
        },
      ],
      filePath: personalityState.filePath,
      expectedVersion: personalityState.expectedVersion,
      reloadUserConfig: true,
    })
      .then(() => {
        setRefreshVersion((current) => current + 1);
      })
      .catch((error) => {
        setPersonalityState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
        }));
      });
  }, [
    personalityState.activePersonality,
    personalityState.expectedVersion,
    personalityState.filePath,
    personalityState.hasExplicitPersonality,
    personalityState.hasLegacyModelPersonality,
    personalityState.isLoading,
    personalityState.isSaving,
    workspaceRoot,
  ]);

  const loadedContents = document?.contents ?? "";
  const editorValue = draft ?? loadedContents;
  const canEdit = document !== null && !isSaving;
  const canSave = document !== null && draft !== null && draft !== loadedContents && !isSaving;
  const showLoadError = loadError !== null && document === null;
  const showLoading = isLoading && document === null;

  const retryLoad = () => {
    setRefreshVersion((current) => current + 1);
  };

  const savePersonality = async (nextPersonality: Exclude<ConfigPersonality, "none">) => {
    if (personalityState.isLoading || personalityState.isSaving || nextPersonality === personalityState.activePersonality) {
      return;
    }
    const previousPersonality = personalityState.activePersonality;
    setPersonalityState((current) => ({
      ...current,
      activePersonality: nextPersonality,
      isSaving: true,
      error: null,
    }));
    try {
      await setPersonality(nextPersonality);
      const edits: Array<{
        keyPath: string;
        value: string | null;
        mergeStrategy: "upsert" | "replace";
      }> = [
        {
          keyPath: "personality",
          value: nextPersonality,
          mergeStrategy: "upsert",
        },
      ];
      if (personalityState.hasLegacyModelPersonality) {
        edits.push({
          keyPath: "model_personality",
          value: null,
          mergeStrategy: "replace",
        });
      }
      await batchWriteConfigValues({
        edits,
        filePath: personalityState.filePath,
        expectedVersion: personalityState.expectedVersion,
        reloadUserConfig: true,
      });
      setRefreshVersion((current) => current + 1);
    } catch (error) {
      void setPersonality(previousPersonality);
      setPersonalityState((current) => ({
        ...current,
        activePersonality: previousPersonality,
        isSaving: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  };

  const saveAgentsMd = async () => {
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    try {
      const nextDocument = await writeWorkspaceAgentsMd({
        workspaceRoot,
        contents: editorValue,
      });
      setDocument(nextDocument);
      setDraft(null);
      onShowToast?.({
        tone: "success",
        message: t("settings.personalization.agents.save.success"),
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.personalization.agents.save.error"),
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!canSave) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") {
        return;
      }
      event.preventDefault();
      void saveAgentsMd();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [canSave, editorValue, workspaceRoot]);

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.section.personalization")}</div>
      </div>

      {showPersonalityCard ? (
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-title text-[14px] font-medium">{t("settings.personalization.personality.label")}</div>
          <div className="app-text-muted mt-1 text-[12px] leading-5">
            {t("settings.personalization.personality.description")}
          </div>

          <div className="mt-4 space-y-2">
            {PERSONALITY_OPTIONS.map((option) => {
              const isActive = option.value === personalityState.activePersonality;
              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={personalityState.isLoading || personalityState.isSaving}
                  onClick={() => void savePersonality(option.value)}
                  className={[
                    "w-full rounded-[14px] px-4 py-3 text-left transition",
                    isActive ? "app-nav-item-active" : "app-card-muted",
                    personalityState.isLoading || personalityState.isSaving ? "opacity-60" : "",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="app-title text-[13px] font-medium">{t(option.labelKey)}</div>
                      <div className="app-text-muted mt-1 text-[12px] leading-5">{t(option.descriptionKey)}</div>
                    </div>
                    {isActive ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <PersonalizationMemorySettings
        workspaceRoot={workspaceRoot}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
        onShowToast={onShowToast}
      />

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.personalization.agents.title")}</div>
        <div className="app-text-muted mt-1 text-[12px] leading-5">
          {renderInlineLinkMessage(t("settings.personalization.agents.description"), AGENTS_MD_DOCS_URL)}
        </div>
        {document?.path ? (
          <div className="app-text-muted mt-3 truncate font-mono text-[12px]">{document.path}</div>
        ) : null}

        <div className="mt-4">
          {showLoadError ? (
            <div className="flex items-center justify-between gap-3">
              <div className="app-text-muted text-[13px]">{t("settings.personalization.agents.loadError")}</div>
              <button
                type="button"
                onClick={retryLoad}
                className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.personalization.agents.retry")}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {showLoading ? (
                <div className="app-text-muted flex items-center gap-2 text-[13px]">
                  <span className="text-[12px]">◌</span>
                  <span>{t("settings.personalization.agents.loading")}</span>
                </div>
              ) : (
                <textarea
                  id="personal-agents-editor"
                  aria-label={t("settings.personalization.agents.title")}
                  rows={12}
                  value={editorValue}
                  disabled={!canEdit}
                  placeholder={t("settings.personalization.agents.placeholder")}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setDraft(nextValue === loadedContents ? null : nextValue);
                  }}
                  className="app-control app-text-input min-h-[280px] w-full resize-y rounded-[14px] px-3 py-3 font-mono text-[13px] leading-6 outline-none disabled:opacity-60"
                />
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void saveAgentsMd()}
                  disabled={!canSave}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {isSaving ? t("general.saving") : t("settings.personalization.agents.save")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {personalityState.error ? (
        <div className="app-card-error rounded-[18px] px-5 py-4 text-[13px]">
          {personalityState.error}
        </div>
      ) : null}
    </div>
  );
}

function resolveSelectablePersonality(
  value: ConfigPersonality | null | undefined,
): Exclude<ConfigPersonality, "none"> {
  return value === "pragmatic" ? "pragmatic" : "friendly";
}
