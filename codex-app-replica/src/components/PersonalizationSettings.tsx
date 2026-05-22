import { useEffect, useMemo, useRef, useState } from "react";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { PersonalizationMemorySettings } from "./PersonalizationMemorySettings";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { Spinner } from "./Spinner";
import { useHotkey } from "../hooks/useHotkey";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigDynamicConfigValue,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import {
  readCodexAgentsMd,
  writeCodexAgentsMd,
  type WorkspaceAgentsMdDocument,
} from "../services/personalization";
import {
  batchWriteConfigValueForHost,
  readConfigForHost,
  resolveUserConfigWriteTarget,
  setPersonalityForHost,
  type ConfigPersonality,
} from "../services/settings";

const AGENTS_MD_DOCS_URL =
  "https://developers.openai.com/codex/guides/agents-md/#create-global-guidance";
const PERSONALITY_DEFAULT_DYNAMIC_CONFIG = "1867347216";

const PERSONALITY_OPTIONS = [
  {
    value: "friendly" as const,
    label: "composer.personalitySlashCommand.label.friendly" as const,
    description: "composer.personalitySlashCommand.description.friendly" as const,
  },
  {
    value: "pragmatic" as const,
    label: "composer.personalitySlashCommand.label.pragmatic" as const,
    description: "composer.personalitySlashCommand.description.pragmatic" as const,
  },
] as const;

type SelectablePersonality = Exclude<ConfigPersonality, "none">;

type PersonalityState = {
  value: SelectablePersonality | null;
  canWrite: boolean;
  hasLoaded: boolean;
  hasLegacyModelPersonality: boolean;
  hasScopedPersonality: boolean;
  isLoading: boolean;
  isSaving: boolean;
  writeTargetExpectedVersion: string | null;
  writeTargetFilePath: string | null;
};

const INITIAL_PERSONALITY_STATE: PersonalityState = {
  value: null,
  canWrite: false,
  hasLoaded: false,
  hasLegacyModelPersonality: false,
  hasScopedPersonality: false,
  isLoading: true,
  isSaving: false,
  writeTargetExpectedVersion: null,
  writeTargetFilePath: null,
};

export function PersonalizationSettings({
  onOpenChatWithPrompt,
  onShowToast,
  selectedHostId,
}: {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
  selectedHostId: string;
  workspaceRoot?: string | null;
}) {
  const { t } = useI18n();
  const personalityGateEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.personality,
  );
  const personalityDefaultDynamicConfig = useReplicaStatsigDynamicConfigValue(
    PERSONALITY_DEFAULT_DYNAMIC_CONFIG,
  );
  const defaultPersonality = useMemo(
    () => resolveDefaultPersonality(personalityDefaultDynamicConfig),
    [personalityDefaultDynamicConfig],
  );
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [personalityState, setPersonalityState] = useState<PersonalityState>(
    INITIAL_PERSONALITY_STATE,
  );
  const [document, setDocument] = useState<WorkspaceAgentsMdDocument | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [isDocumentLoading, setIsDocumentLoading] = useState(true);
  const [isDocumentSaving, setIsDocumentSaving] = useState(false);
  const [documentLoadError, setDocumentLoadError] = useState<string | null>(null);
  const personalityMigrationAttemptRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPersonalityState = async () => {
      setPersonalityState((current) => ({
        ...current,
        isLoading: true,
        isSaving: false,
      }));

      try {
        const configResponse = await readConfigForHost({
          hostId: selectedHostId,
          cwd: null,
          includeLayers: true,
        });
        if (cancelled) {
          return;
        }

        const writeTarget = resolveUserConfigWriteTarget(configResponse);
        const scopedPersonality = configResponse.config.personality;
        const legacyModelPersonality = configResponse.config.modelPersonality;

        setPersonalityState({
          value: resolveSelectablePersonality(
            scopedPersonality ?? legacyModelPersonality,
          ),
          canWrite: true,
          hasLoaded: true,
          hasLegacyModelPersonality: legacyModelPersonality !== null,
          hasScopedPersonality: scopedPersonality !== null,
          isLoading: false,
          isSaving: false,
          writeTargetExpectedVersion: writeTarget?.expectedVersion ?? null,
          writeTargetFilePath: writeTarget?.filePath ?? null,
        });
      } catch {
        if (!cancelled) {
          setPersonalityState((current) => ({
            ...current,
            canWrite: false,
            hasLoaded: false,
            isLoading: false,
            isSaving: false,
          }));
        }
      }
    };

    const loadCodexAgentsDocument = async () => {
      setIsDocumentLoading(true);
      setDocumentLoadError(null);

      try {
        const nextDocument = await readCodexAgentsMd(selectedHostId);
        if (cancelled) {
          return;
        }
        setDocument(nextDocument);
        setDraft(null);
      } catch (error) {
        if (!cancelled) {
          setDocument(null);
          setDraft(null);
          setDocumentLoadError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setIsDocumentLoading(false);
        }
      }
    };

    void Promise.all([loadPersonalityState(), loadCodexAgentsDocument()]);

    return () => {
      cancelled = true;
    };
  }, [refreshVersion, selectedHostId]);

  useEffect(() => {
    if (personalityState.isLoading || !personalityState.hasLoaded) {
      return;
    }

    void setPersonalityForHost({
      hostId: selectedHostId,
      personality: personalityGateEnabled
        ? (personalityState.value ?? defaultPersonality)
        : null,
    });
  }, [
    defaultPersonality,
    personalityGateEnabled,
    personalityState.hasLoaded,
    personalityState.isLoading,
    personalityState.value,
    selectedHostId,
  ]);

  useEffect(() => {
    if (
      personalityState.isLoading ||
      personalityState.isSaving ||
      !personalityState.hasLoaded ||
      !personalityState.hasLegacyModelPersonality ||
      personalityMigrationAttemptRef.current === selectedHostId
    ) {
      return;
    }

    personalityMigrationAttemptRef.current = selectedHostId;
    const edits: Array<{
      keyPath: string;
      value: string | null;
      mergeStrategy: "upsert" | "replace";
    }> = [];

    if (!personalityState.hasScopedPersonality) {
      edits.push({
        keyPath: "personality",
        value: personalityState.value ?? defaultPersonality,
        mergeStrategy: "upsert",
      });
    }

    edits.push({
      keyPath: "model_personality",
      value: null,
      mergeStrategy: "replace",
    });

    void batchWriteConfigValueForHost({
      hostId: selectedHostId,
      edits,
      filePath: personalityState.writeTargetFilePath,
      expectedVersion: personalityState.writeTargetExpectedVersion,
      reloadUserConfig: true,
    })
      .then(() => {
        setRefreshVersion((current) => current + 1);
      })
      .catch(() => {
        personalityMigrationAttemptRef.current = null;
      });
  }, [
    defaultPersonality,
    personalityState.hasLegacyModelPersonality,
    personalityState.hasLoaded,
    personalityState.hasScopedPersonality,
    personalityState.isLoading,
    personalityState.isSaving,
    personalityState.value,
    personalityState.writeTargetExpectedVersion,
    personalityState.writeTargetFilePath,
    selectedHostId,
  ]);

  const personalityOptions = useMemo(
    () =>
      PERSONALITY_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.label),
        description: t(option.description),
      })),
    [t],
  );
  const resolvedPersonality = personalityState.value ?? defaultPersonality;
  const selectedPersonalityOption =
    personalityOptions.find((option) => option.value === resolvedPersonality) ??
    personalityOptions[0];
  const loadedContents = document?.contents ?? "";
  const editorValue = draft ?? loadedContents;
  const canSaveDocument =
    document !== null &&
    draft !== null &&
    draft !== loadedContents &&
    !isDocumentSaving;

  const savePersonality = async (nextPersonality: SelectablePersonality) => {
    if (
      personalityState.isLoading ||
      personalityState.isSaving ||
      !personalityState.hasLoaded ||
      !personalityState.canWrite ||
      nextPersonality === personalityState.value
    ) {
      return;
    }

    const previousPersonality = personalityState.value;
    const previousResolvedPersonality = previousPersonality ?? defaultPersonality;
    setPersonalityState((current) => ({
      ...current,
      value: nextPersonality,
      isSaving: true,
    }));

    try {
      await setPersonalityForHost({
        hostId: selectedHostId,
        personality: nextPersonality,
      });
      await batchWriteConfigValueForHost({
        hostId: selectedHostId,
        edits: [
          {
            keyPath: "personality",
            value: nextPersonality,
            mergeStrategy: "upsert",
          },
        ],
        filePath: personalityState.writeTargetFilePath,
        expectedVersion: personalityState.writeTargetExpectedVersion,
        reloadUserConfig: true,
      });
      setRefreshVersion((current) => current + 1);
    } catch {
      void setPersonalityForHost({
        hostId: selectedHostId,
        personality: previousResolvedPersonality,
      });
      setPersonalityState((current) => ({
        ...current,
        value: previousPersonality,
        isSaving: false,
      }));
    }
  };

  const saveCodexAgentsDocument = async () => {
    if (!canSaveDocument) {
      return;
    }

    setIsDocumentSaving(true);
    try {
      const response = await writeCodexAgentsMd({
        hostId: selectedHostId,
        contents: editorValue,
      });
      setDocument({
        path: response.path,
        contents: editorValue,
      });
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
      setIsDocumentSaving(false);
    }
  };

  useHotkey({
    accelerator: "CmdOrCtrl+S",
    enabled: canSaveDocument,
    onKeyDown: (event) => {
      event.preventDefault();
      void saveCodexAgentsDocument();
    },
  });

  return (
    <SettingsContentLayout title={<SettingsSectionTitle slug="personalization" />}>
      {personalityGateEnabled ? (
        <SettingsGroup>
          <SettingsGroup.Content>
            <SettingsSurface>
              <SettingsRow
                label={t("settings.personalization.personality.label")}
                description={t("settings.personalization.personality.description")}
                control={
                  <SettingsChoiceMenu
                    className="w-[240px]"
                    disabled={
                      personalityState.isLoading ||
                      personalityState.isSaving ||
                      !personalityState.canWrite
                    }
                    menuClassName="w-[260px] max-w-xs"
                    options={personalityOptions}
                    value={selectedPersonalityOption.value}
                    onChange={(value) => {
                      if (value === "friendly" || value === "pragmatic") {
                        void savePersonality(value);
                      }
                    }}
                  />
                }
              />
            </SettingsSurface>
          </SettingsGroup.Content>
        </SettingsGroup>
      ) : null}

      <CustomInstructionsGroup
        document={document}
        draft={draft}
        editorValue={editorValue}
        isLoading={isDocumentLoading && document === null}
        isSaving={isDocumentSaving}
        loadError={documentLoadError !== null && document === null ? documentLoadError : null}
        loadedContents={loadedContents}
        onChangeDraft={setDraft}
        onRetry={() => setRefreshVersion((current) => current + 1)}
        onSave={() => void saveCodexAgentsDocument()}
      />

      <PersonalizationMemorySettings
        selectedHostId={selectedHostId}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
        onShowToast={onShowToast}
      />
    </SettingsContentLayout>
  );
}

function CustomInstructionsGroup({
  document,
  draft,
  editorValue,
  isLoading,
  isSaving,
  loadError,
  loadedContents,
  onChangeDraft,
  onRetry,
  onSave,
}: {
  document: WorkspaceAgentsMdDocument | null;
  draft: string | null;
  editorValue: string;
  isLoading: boolean;
  isSaving: boolean;
  loadError: string | null;
  loadedContents: string;
  onChangeDraft: (next: string | null) => void;
  onRetry: () => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const canSave =
    document !== null &&
    draft !== null &&
    draft !== loadedContents &&
    !isSaving;

  return (
    <SettingsGroup className="gap-2">
      <SettingsGroup.Header
        title={t("settings.personalization.agents.title")}
        subtitle={renderInlineAgentsDescription(
          t("settings.personalization.agents.description"),
        )}
      />
      <SettingsGroup.Content>
        {loadError ? (
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-token-text-secondary">
              {t("settings.personalization.agents.loadError")}
            </div>
            <Button className="shrink-0" color="secondary" onClick={onRetry} size="toolbar">
              {t("settings.personalization.agents.retry")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-token-text-secondary">
                <Spinner className="icon-xs" />
                {t("settings.personalization.agents.loading")}
              </div>
            ) : (
              <textarea
                id="personal-agents-editor"
                aria-label={t("settings.personalization.agents.title")}
                className="focus-visible:ring-token-focus w-full rounded-md border border-token-border bg-token-input-background px-2.5 py-2 font-mono text-sm text-token-text-primary outline-none focus-visible:ring-2"
                disabled={document === null || isSaving}
                placeholder={t("settings.personalization.agents.placeholder")}
                rows={12}
                value={editorValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  onChangeDraft(nextValue === loadedContents ? null : nextValue);
                }}
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                color="primary"
                disabled={!canSave}
                loading={isSaving}
                onClick={onSave}
                size="toolbar"
              >
                {t("settings.personalization.agents.save")}
              </Button>
            </div>
          </div>
        )}
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function renderInlineAgentsDescription(template: string) {
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
        href={AGENTS_MD_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {label}
      </a>
      {suffix}
    </>
  );
}

function resolveSelectablePersonality(
  value: ConfigPersonality | null | undefined,
): SelectablePersonality | null {
  if (value === "friendly" || value === "pragmatic") {
    return value;
  }
  return null;
}

function resolveDefaultPersonality(dynamicConfig: unknown): SelectablePersonality {
  if (
    dynamicConfig !== null &&
    typeof dynamicConfig === "object" &&
    !Array.isArray(dynamicConfig)
  ) {
    const configuredValue = resolveSelectablePersonality(
      (dynamicConfig as { default_personality?: unknown }).default_personality as
        | ConfigPersonality
        | null
        | undefined,
    );
    if (configuredValue !== null) {
      return configuredValue;
    }
  }

  return "friendly";
}
