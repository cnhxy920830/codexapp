import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import {
  createDefaultLocalEnvironmentConfigPath,
  createDefaultLocalEnvironmentDocument,
  listLocalEnvironments,
  readLocalEnvironmentConfig,
  writeLocalEnvironmentConfig,
  type LocalEnvironmentAction,
  type LocalEnvironmentConfigEntry,
  type LocalEnvironmentDocument,
  type LocalEnvironmentGroup,
  type LocalEnvironmentScriptSection,
} from "../services/localEnvironments";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import type { AppToast } from "./AppToastRegion";
import type { MessageKey } from "../i18n/messages";

const LOCAL_ENVIRONMENTS_DOCS_URL = "https://developers.openai.com/codex/app/local-environments";
const SCRIPT_PLATFORM_OPTIONS = ["default", "darwin", "linux", "win32"] as const;
const ACTION_ICON_OPTIONS = ["tool", "run", "debug", "test"] as const;
const CODEX_SOURCE_PATH = "CODEX_SOURCE_PATH";
const CODEX_WORKTREE_PATH = "CODEX_WORKTREE_PATH";

type ScriptPlatformOption = (typeof SCRIPT_PLATFORM_OPTIONS)[number];
type ActionIconOption = (typeof ACTION_ICON_OPTIONS)[number];

type EditableLocalEnvironmentAction = LocalEnvironmentAction & {
  id: string;
};

type EditableLocalEnvironmentDocument = Omit<LocalEnvironmentDocument, "actions"> & {
  actions: EditableLocalEnvironmentAction[];
};

export function LocalEnvironmentsSettings({
  workspaceRoot,
  onShowToast,
}: {
  workspaceRoot: string | null;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [groups, setGroups] = useState<LocalEnvironmentGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInheritedOpen, setIsInheritedOpen] = useState(false);
  const [editorConfigPath, setEditorConfigPath] = useState<string | null>(null);
  const [editorDocument, setEditorDocument] = useState<EditableLocalEnvironmentDocument | null>(null);
  const [editorInitialFingerprint, setEditorInitialFingerprint] = useState<string>("");
  const [editorParseError, setEditorParseError] = useState<string | null>(null);
  const [editorReadError, setEditorReadError] = useState<string | null>(null);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [setupPlatform, setSetupPlatform] = useState<ScriptPlatformOption>("default");
  const [cleanupPlatform, setCleanupPlatform] = useState<ScriptPlatformOption>("default");
  const [isEnvVarsOpen, setIsEnvVarsOpen] = useState(false);

  const currentGroup = useMemo(
    () => groups.find((group) => group.isCurrentRoot) ?? null,
    [groups],
  );
  const inheritedGroups = useMemo(
    () => groups.filter((group) => !group.isCurrentRoot && group.environments.length > 0),
    [groups],
  );
  const inheritedCount = useMemo(
    () => inheritedGroups.reduce((count, group) => count + group.environments.length, 0),
    [inheritedGroups],
  );
  const editorFingerprint = useMemo(
    () => (editorDocument ? JSON.stringify(toPersistedDocument(editorDocument)) : ""),
    [editorDocument],
  );
  const saveDisabledReason = useMemo(() => {
    if (editorDocument === null) {
      return null;
    }
    if (isSaving) {
      return t("settings.localEnvironments.save.disabled.saving");
    }
    if (editorDocument.name.trim().length === 0) {
      return t("settings.localEnvironments.save.disabled.name");
    }
    if (editorFingerprint === editorInitialFingerprint && !editorParseError && !editorReadError) {
      return t("settings.localEnvironments.save.disabled.noChanges");
    }
    return null;
  }, [editorDocument, editorFingerprint, editorInitialFingerprint, editorParseError, editorReadError, isSaving, t]);

  useEffect(() => {
    if (!workspaceRoot) {
      setGroups([]);
      setLoadError(null);
      setIsLoading(false);
      closeEditor();
      return;
    }

    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await listLocalEnvironments(workspaceRoot);
        if (!cancelled) {
          setGroups(response.groups);
          setIsInheritedOpen(response.groups.some((group) => !group.isCurrentRoot && group.environments.length > 0));
        }
      } catch (error) {
        if (!cancelled) {
          setGroups([]);
          setLoadError(error instanceof Error ? error.message : String(error));
        }
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
  }, [workspaceRoot]);

  const refreshGroups = async () => {
    if (!workspaceRoot) {
      return;
    }
    const response = await listLocalEnvironments(workspaceRoot);
    setGroups(response.groups);
  };

  const closeEditor = () => {
    setEditorConfigPath(null);
    setEditorDocument(null);
    setEditorInitialFingerprint("");
    setEditorParseError(null);
    setEditorReadError(null);
    setIsEditorLoading(false);
    setIsSaving(false);
    setSetupPlatform("default");
    setCleanupPlatform("default");
    setIsEnvVarsOpen(false);
  };

  const openEditor = async (configPath: string) => {
    if (!workspaceRoot) {
      return;
    }

    setEditorConfigPath(configPath);
    setEditorDocument(null);
    setEditorParseError(null);
    setEditorReadError(null);
    setSetupPlatform("default");
    setCleanupPlatform("default");
    setIsEnvVarsOpen(false);
    setIsEditorLoading(true);

    try {
      const response = await readLocalEnvironmentConfig({ workspaceRoot, configPath });
      const editableDocument = toEditableDocument(response.environment);
      setEditorDocument(editableDocument);
      setEditorInitialFingerprint(JSON.stringify(toPersistedDocument(editableDocument)));
      setEditorParseError(response.parseError);
    } catch (error) {
      const fallbackDocument = toEditableDocument(createDefaultLocalEnvironmentDocument(configPath));
      setEditorDocument(fallbackDocument);
      setEditorInitialFingerprint(JSON.stringify(toPersistedDocument(fallbackDocument)));
      setEditorReadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsEditorLoading(false);
    }
  };

  const openCreateEditor = () => {
    if (!workspaceRoot) {
      return;
    }
    const currentEntries = currentGroup?.environments ?? [];
    const configPath = createDefaultLocalEnvironmentConfigPath(currentEntries, workspaceRoot);
    void openEditor(configPath);
  };

  const saveEditor = async () => {
    if (!workspaceRoot || !editorConfigPath || !editorDocument || saveDisabledReason) {
      return;
    }

    setIsSaving(true);
    try {
      await writeLocalEnvironmentConfig({
        workspaceRoot,
        configPath: editorConfigPath,
        environment: toPersistedDocument(editorDocument),
      });
      await refreshGroups();
      closeEditor();
      onShowToast?.({
        tone: "success",
        message: t("settings.localEnvironments.save.success"),
      });
    } catch (error) {
      onShowToast?.({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateScriptSection = (
    sectionKey: "setup" | "cleanup",
    platform: ScriptPlatformOption,
    script: string,
  ) => {
    setEditorDocument((current) => {
      if (current === null) {
        return current;
      }
      const section = current[sectionKey];
      const nextSection: LocalEnvironmentScriptSection =
        platform === "default"
          ? { ...section, script }
          : {
              ...section,
              [platform]: script.length > 0 ? { script } : null,
            };
      return { ...current, [sectionKey]: nextSection };
    });
  };

  const updateAction = (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => {
    setEditorDocument((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        actions: current.actions.map((action) => (action.id === actionId ? { ...action, ...patch } : action)),
      };
    });
  };

  const removeAction = (actionId: string) => {
    setEditorDocument((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        actions: current.actions.filter((action) => action.id !== actionId),
      };
    });
  };

  const addAction = () => {
    setEditorDocument((current) => {
      if (current === null) {
        return current;
      }
      return {
        ...current,
        actions: [
          ...current.actions,
          {
            id: crypto.randomUUID(),
            name: "",
            icon: "tool",
            command: "",
            platform: null,
          },
        ],
      };
    });
  };

  if (!workspaceRoot) {
    return <UnavailableState body={t("settings.localEnvironments.unavailable.body")} title={t("settings.localEnvironments.unavailable.title")} />;
  }

  if (editorConfigPath !== null) {
    return (
      <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
        <div className="app-card rounded-[18px] px-5 py-4">
          <button
            type="button"
            onClick={closeEditor}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.localEnvironments.breadcrumb.back")}
          </button>
          <div className="mt-4 text-[14px] font-medium">{t("settings.localEnvironments.editor.title")}</div>
          <div className="app-text-muted mt-1 break-all text-[12px] leading-5">{editorConfigPath}</div>
        </div>

        {isEditorLoading ? (
          <InfoCard title={t("settings.localEnvironments.loading.title")} body={t("settings.localEnvironments.loading.body")} />
        ) : editorDocument === null ? (
          <InfoCard title={t("settings.localEnvironments.unavailable.title")} body={t("settings.localEnvironments.unavailable.body")} />
        ) : (
          <>
            {editorParseError ? (
              <ErrorNotice message={t("settings.localEnvironments.file.parseError", { error: editorParseError })} />
            ) : null}
            {editorReadError ? (
              <ErrorNotice message={t("settings.localEnvironments.file.readError", { error: editorReadError })} />
            ) : null}

            <div className="app-card rounded-[18px] px-5 py-4">
              <label className="flex flex-col gap-2">
                <span className="text-[14px] font-medium">{t("settings.localEnvironments.environment.name")}</span>
                <input
                  value={editorDocument.name}
                  onChange={(event) =>
                    setEditorDocument((current) => (current === null ? current : { ...current, name: event.target.value }))
                  }
                  className="app-control app-text-input rounded-[12px] px-3 py-2 text-[13px] outline-none"
                />
              </label>
            </div>

            <ScriptEditorCard
              activePlatform={setupPlatform}
              description={t("settings.localEnvironments.editor.setup.description")}
              isEnvVarsOpen={isEnvVarsOpen}
              onPlatformChange={setSetupPlatform}
              onScriptChange={(platform, script) => updateScriptSection("setup", platform, script)}
              onToggleEnvVars={() => setIsEnvVarsOpen((current) => !current)}
              script={getScriptForPlatform(editorDocument.setup, setupPlatform)}
              title={t("settings.localEnvironments.environment.setup")}
              toggleAriaLabel={t("settings.localEnvironments.environment.setup.platformSelector")}
              t={t}
            />

            <ScriptEditorCard
              activePlatform={cleanupPlatform}
              description={t("settings.localEnvironments.environment.cleanup.description")}
              isEnvVarsOpen={false}
              onPlatformChange={setCleanupPlatform}
              onScriptChange={(platform, script) => updateScriptSection("cleanup", platform, script)}
              onToggleEnvVars={undefined}
              script={getScriptForPlatform(editorDocument.cleanup, cleanupPlatform)}
              title={t("settings.localEnvironments.environment.cleanup.title")}
              toggleAriaLabel={t("settings.localEnvironments.environment.cleanup.platformSelector")}
              t={t}
            />

            <div className="app-card rounded-[18px] px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[14px] font-medium">{t("settings.localEnvironments.actions.title")}</div>
                  <div className="app-text-muted mt-1 text-[12px] leading-5">
                    {t("settings.localEnvironments.environment.actions.description")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addAction}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("settings.localEnvironments.actions.add")}
                </button>
              </div>

              {editorDocument.actions.length === 0 ? (
                <div className="app-card-muted mt-4 rounded-[12px] px-3 py-2 text-[13px] leading-6">
                  {t("settings.localEnvironments.actions.empty")}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {editorDocument.actions.map((action) => (
                    <ActionEditorCard
                      key={action.id}
                      action={action}
                      onChange={updateAction}
                      onDelete={removeAction}
                      t={t}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("settings.localEnvironments.breadcrumb.back")}
                </button>
                <button
                  type="button"
                  disabled={saveDisabledReason !== null}
                  onClick={() => void saveEditor()}
                  className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
                >
                  {t("settings.localEnvironments.preview.save")}
                </button>
              </div>
              {saveDisabledReason ? (
                <div className="app-text-muted text-[12px] leading-5">{saveDisabledReason}</div>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.nav.local-environments")}</div>
        <div className="app-text-muted mt-1 text-[13px] leading-6">
          {renderInlineLinkMessage(t("settings.localEnvironments.workspaceSelect.description"), LOCAL_ENVIRONMENTS_DOCS_URL)}
        </div>
      </div>

      {isLoading ? (
        <InfoCard title={t("settings.localEnvironments.loading.title")} body={t("settings.localEnvironments.loading.body")} />
      ) : loadError ? (
        <UnavailableState
          body={`${t("settings.localEnvironments.unavailable.body")} ${loadError}`}
          title={t("settings.localEnvironments.unavailable.title")}
        />
      ) : (
        <>
          <div className="app-card rounded-[18px] px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[14px] font-medium">{t("settings.localEnvironments.workspace.title")}</div>
                <div className="mt-1 text-[13px]">{currentGroup?.label ?? deriveWorkspaceLabel(workspaceRoot)}</div>
                <div className="app-text-muted mt-1 break-all text-[12px] leading-5">{workspaceRoot}</div>
              </div>
              <button
                type="button"
                onClick={openCreateEditor}
                className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.localEnvironments.environment.create")}
              </button>
            </div>

            {currentGroup && currentGroup.environments.length > 0 ? (
              <div className="mt-4 space-y-3">
                {currentGroup.environments.map((entry) => (
                  <EnvironmentListRow
                    key={entry.configPath}
                    entry={entry}
                    actionLabel={t("settings.localEnvironments.workspaceSelect.viewAction")}
                    onSelect={() => void openEditor(entry.configPath)}
                    parseErrorMessage={entry.parseError}
                  />
                ))}
              </div>
            ) : (
              <div className="app-card-muted mt-4 rounded-[12px] px-3 py-2 text-[13px] leading-6">
                {t("settings.localEnvironments.environment.empty")}
              </div>
            )}
          </div>

          {inheritedCount > 0 ? (
            <div className="app-card rounded-[18px] px-5 py-4">
              <button
                type="button"
                onClick={() => setIsInheritedOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <span className="text-[14px] font-medium">
                  {t("settings.localEnvironments.workspaceSelect.inherited", { count: inheritedCount })}
                </span>
                <span className="app-text-muted text-[12px]">{isInheritedOpen ? "▾" : "▸"}</span>
              </button>

              {isInheritedOpen ? (
                <div className="mt-4 space-y-4">
                  {inheritedGroups.map((group) => (
                    <div
                      key={group.path}
                      className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3"
                    >
                      <div className="text-[13px] font-medium">{group.label}</div>
                      <div className="app-text-muted mt-1 break-all text-[12px] leading-5">{group.path}</div>
                      <div className="mt-3 space-y-3">
                        {group.environments.map((entry) => (
                          <EnvironmentListRow
                            key={entry.configPath}
                            entry={entry}
                            actionLabel={t("settings.localEnvironments.workspaceSelect.viewAction")}
                            onSelect={() => void openEditor(entry.configPath)}
                            parseErrorMessage={entry.parseError}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ScriptEditorCard({
  activePlatform,
  description,
  isEnvVarsOpen,
  onPlatformChange,
  onScriptChange,
  onToggleEnvVars,
  script,
  title,
  toggleAriaLabel,
  t,
}: {
  activePlatform: ScriptPlatformOption;
  description: string;
  isEnvVarsOpen: boolean;
  onPlatformChange: (platform: ScriptPlatformOption) => void;
  onScriptChange: (platform: ScriptPlatformOption, script: string) => void;
  onToggleEnvVars?: (() => void) | undefined;
  script: string;
  title: string;
  toggleAriaLabel: string;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-medium">{title}</div>
          <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
        </div>
        {onToggleEnvVars ? (
          <button
            type="button"
            onClick={onToggleEnvVars}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.localEnvironments.environment.setup.envVars.button")}
          </button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label={toggleAriaLabel}>
        {SCRIPT_PLATFORM_OPTIONS.map((platform) => {
          const isActive = platform === activePlatform;
          return (
            <button
              key={platform}
              type="button"
              onClick={() => onPlatformChange(platform)}
              className={[
                "rounded-[11px] px-3 py-1.5 text-[12px]",
                isActive ? "app-nav-item-active" : "app-control",
              ].join(" ")}
            >
              {formatPlatformLabel(platform, t)}
            </button>
          );
        })}
      </div>

      {isEnvVarsOpen ? (
        <div className="app-card-muted mt-4 rounded-[12px] px-4 py-3">
          <div className="text-[13px] font-medium">{t("settings.localEnvironments.environment.setup.envVars.title")}</div>
          <div className="mt-3 space-y-3">
            <EnvVarRow
              description={t("settings.localEnvironments.environment.setup.envVars.sourcePath.description")}
              variable={CODEX_SOURCE_PATH}
            />
            <EnvVarRow
              description={t("settings.localEnvironments.environment.setup.envVars.worktreePath.description")}
              variable={CODEX_WORKTREE_PATH}
            />
          </div>
        </div>
      ) : null}

      <textarea
        value={script}
        onChange={(event) => onScriptChange(activePlatform, event.target.value)}
        rows={activePlatform === "default" ? 6 : 4}
        className="app-control app-text-input mt-4 min-h-[120px] w-full rounded-[12px] px-3 py-2 font-mono text-[13px] outline-none"
      />
    </div>
  );
}

function ActionEditorCard({
  action,
  onChange,
  onDelete,
  t,
}: {
  action: EditableLocalEnvironmentAction;
  onChange: (actionId: string, patch: Partial<EditableLocalEnvironmentAction>) => void;
  onDelete: (actionId: string) => void;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-4">
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px_auto] sm:items-end">
          <label className="flex flex-col gap-2">
            <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--app-shell-subtle)]">
              {t("settings.localEnvironments.actions.item.name")}
            </span>
            <input
              value={action.name}
              onChange={(event) => onChange(action.id, { name: event.target.value })}
              className="app-control app-text-input rounded-[12px] px-3 py-2 text-[13px] outline-none"
            />
          </label>

          <SettingsChoiceMenu
            disabled={false}
            onChange={(value) => onChange(action.id, { icon: value })}
            options={ACTION_ICON_OPTIONS.map((value) => ({
              value,
              label: t(`settings.localEnvironments.actions.icon.${value}`),
            }))}
            value={action.icon ?? "tool"}
          />

          <button
            type="button"
            onClick={() => onDelete(action.id)}
            className="app-control h-[38px] rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.localEnvironments.actions.item.button.delete")}
          </button>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-[var(--app-shell-subtle)]">
            {t("settings.localEnvironments.actions.item.command")}
          </span>
          <textarea
            value={action.command}
            onChange={(event) => onChange(action.id, { command: event.target.value })}
            rows={4}
            className="app-control app-text-input min-h-[104px] rounded-[12px] px-3 py-2 font-mono text-[13px] outline-none"
          />
        </label>

        <SettingsChoiceMenu
          disabled={false}
          onChange={(value) => onChange(action.id, { platform: value === "default" ? null : value })}
          options={[
            {
              value: "default",
              label: t("settings.localEnvironments.environment.script.default"),
            },
            {
              value: "darwin",
              label: t("settings.localEnvironments.actions.item.platforms.macos"),
              description: t("settings.localEnvironments.actions.item.platforms.help"),
            },
            {
              value: "linux",
              label: t("settings.localEnvironments.actions.item.platforms.linux"),
              description: t("settings.localEnvironments.actions.item.platforms.help"),
            },
            {
              value: "win32",
              label: t("settings.localEnvironments.actions.item.platforms.windows"),
              description: t("settings.localEnvironments.actions.item.platforms.help"),
            },
          ]}
          value={action.platform ?? "default"}
        />
      </div>
    </div>
  );
}

function EnvironmentListRow({
  entry,
  actionLabel,
  onSelect,
  parseErrorMessage,
}: {
  entry: LocalEnvironmentConfigEntry;
  actionLabel: string;
  onSelect: () => void;
  parseErrorMessage: string | null;
}) {
  const label = entry.environment?.name.trim() || entry.fileName;
  const subtitle =
    entry.environment?.name && entry.environment.name.trim() !== entry.fileName ? entry.fileName : entry.configPath;

  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className={parseErrorMessage ? "text-[var(--app-shell-error-text)]" : "text-[14px]"}>{label}</div>
          <div className="app-text-muted mt-1 break-all text-[12px] leading-5">{subtitle}</div>
          {parseErrorMessage ? (
            <div className="mt-1 text-[12px] leading-5 text-[var(--app-shell-error-text)]">{parseErrorMessage}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onSelect}
          className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px]"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function EnvVarRow({ description, variable }: { description: string; variable: string }) {
  return (
    <div className="rounded-[12px] border border-[var(--app-shell-border)] px-3 py-2">
      <div className="app-text-muted text-[12px] leading-5">{description}</div>
      <code className="mt-2 block overflow-x-auto rounded-[10px] bg-[var(--app-shell-muted-surface)] px-2 py-1.5 text-[12px]">
        {variable}
      </code>
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="text-[14px] font-medium">{title}</div>
      <div className="app-text-muted mt-1 text-[13px] leading-6">{body}</div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="app-card-error rounded-[18px] px-5 py-4 text-[13px] leading-6">
      {message}
    </div>
  );
}

function UnavailableState({ body, title }: { body: string; title: string }) {
  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <InfoCard title={title} body={body} />
    </div>
  );
}

function toEditableDocument(document: LocalEnvironmentDocument): EditableLocalEnvironmentDocument {
  return {
    ...document,
    actions: document.actions.map((action) => ({
      ...action,
      id: crypto.randomUUID(),
    })),
  };
}

function toPersistedDocument(document: EditableLocalEnvironmentDocument): LocalEnvironmentDocument {
  return {
    version: document.version || 1,
    name: document.name,
    setup: normalizeScriptSection(document.setup),
    cleanup: normalizeScriptSection(document.cleanup),
    actions: document.actions.map(({ id: _id, ...action }) => ({
      ...action,
      icon: action.icon?.trim() ? action.icon : null,
      platform: action.platform?.trim() ? action.platform : null,
    })),
  };
}

function normalizeScriptSection(section: LocalEnvironmentScriptSection): LocalEnvironmentScriptSection {
  return {
    script: section.script,
    darwin: section.darwin?.script.length ? section.darwin : null,
    linux: section.linux?.script.length ? section.linux : null,
    win32: section.win32?.script.length ? section.win32 : null,
  };
}

function getScriptForPlatform(section: LocalEnvironmentScriptSection, platform: ScriptPlatformOption) {
  if (platform === "default") {
    return section.script;
  }
  return section[platform]?.script ?? "";
}

function formatPlatformLabel(
  platform: ScriptPlatformOption,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (platform === "default") {
    return t("settings.localEnvironments.environment.script.default");
  }
  if (platform === "darwin") {
    return t("settings.localEnvironments.actions.item.platforms.macos");
  }
  if (platform === "linux") {
    return t("settings.localEnvironments.actions.item.platforms.linux");
  }
  return t("settings.localEnvironments.actions.item.platforms.windows");
}

function deriveWorkspaceLabel(workspaceRoot: string) {
  const normalized = workspaceRoot.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) ?? workspaceRoot;
}
