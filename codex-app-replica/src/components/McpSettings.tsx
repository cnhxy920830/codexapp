import { useEffect, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import { useI18n } from "../i18n/i18n";
import { type MessageKey, type MessageValues } from "../i18n/messages";
import {
  batchWriteConfigValues,
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  readConfig,
  writeConfigValue,
} from "../services/settings";
import {
  createBlankMcpServerDraft,
  listMcpServerStatuses,
  loginMcpServer,
  normalizeMcpServerDraft,
  onMcpOauthLoginCompleted,
  parseMcpServers,
  reloadMcpServerConfig,
  sanitizeMcpServerKey,
  serializeMcpServerDraft,
  type McpServerDraft,
  type McpServerStatusEntry,
} from "../services/mcp";
import { ToggleSwitch } from "./ToggleSwitch";

const MCP_DOCS_URL = "https://developers.openai.com/codex/mcp/";

type EditorKey = string | null | undefined;

export function McpSettings({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t } = useI18n();
  const [configResponse, setConfigResponse] = useState<Awaited<ReturnType<typeof readConfig>> | null>(null);
  const [serverStatuses, setServerStatuses] = useState<McpServerStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<EditorKey>(undefined);
  const [draft, setDraft] = useState<McpServerDraft | null>(null);

  const load = async (refreshing: boolean) => {
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const [config, statuses] = await Promise.all([readConfig(workspaceRoot), listMcpServerStatuses()]);
      setConfigResponse(config);
      setServerStatuses(statuses.data);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setConfigResponse(null);
      setServerStatuses([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void load(false);
  }, [workspaceRoot]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onMcpOauthLoginCompleted((notification) => {
      if (!notification.success) {
        setActionError(notification.error ?? t("settings.mcp.oauth.error"));
        return;
      }
      setActionError(null);
      void load(true);
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => {
      unlisten?.();
    };
  }, [workspaceRoot, t]);

  const config = configResponse?.config ?? null;
  const servers = useMemo(() => parseMcpServers(config), [config]);
  const scopeOptions = useMemo(
    () => (configResponse ? buildConfigScopeOptions(configResponse) : []),
    [configResponse],
  );
  const writeTarget = useMemo(() => {
    const defaultScopeKey = chooseDefaultConfigScopeKey(scopeOptions);
    return scopeOptions.find((scope) => scope.key === defaultScopeKey) ?? null;
  }, [scopeOptions]);
  const existingKeys = useMemo(() => Object.keys(config?.mcpServers ?? {}), [config]);
  const selectedExistingServer = useMemo(
    () => (typeof editorKey === "string" ? servers.find((entry) => entry.name === editorKey) ?? null : null),
    [editorKey, servers],
  );
  const selectedServerOrigin = useMemo(() => {
    if (typeof editorKey !== "string" || !configResponse) {
      return null;
    }
    return configResponse.origins[`mcp_servers.${editorKey}`] ?? null;
  }, [configResponse, editorKey]);
  const isReadOnly = selectedServerOrigin?.name.type === "project" || writeTarget?.filePath == null;
  const editorTitle =
    editorKey === undefined
      ? null
      : editorKey === null
        ? t("settings.mcp.detail.titleNew")
        : t("settings.mcp.detail.titleExisting", {
            name: getServerLabel(selectedExistingServer?.name ?? editorKey, selectedExistingServer?.server ?? null),
          });
  const refresh = async () => {
    await load(true);
  };

  const openEditorForNewServer = () => {
    setEditorKey(null);
    setDraft(createBlankMcpServerDraft());
    setActionError(null);
  };

  const openEditorForExistingServer = (name: string) => {
    const server = config?.mcpServers?.[name];
    setEditorKey(name);
    setDraft(normalizeMcpServerDraft(server, name));
    setActionError(null);
  };

  const closeEditor = () => {
    setEditorKey(undefined);
    setDraft(null);
    setActionError(null);
  };

  const persistEnabled = async (name: string, enabled: boolean) => {
    if (!writeTarget?.filePath) {
      return;
    }
    setActionError(null);
    setIsSaving(true);
    try {
      await writeConfigValue({
        keyPath: `mcp_servers.${name}.enabled`,
        value: enabled,
        mergeStrategy: "upsert",
        filePath: writeTarget.filePath,
        expectedVersion: writeTarget.expectedVersion,
      });
      await reloadMcpServerConfig();
      await refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const authenticateServer = async (name: string) => {
    setActionError(null);
    try {
      const response = await loginMcpServer(name);
      await open(response.authorizationUrl);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const saveServer = async () => {
    if (!draft || !writeTarget?.filePath) {
      return;
    }
    setActionError(null);
    setIsSaving(true);
    try {
      const nextKey = sanitizeMcpServerKey(draft.label, existingKeys, typeof editorKey === "string" ? editorKey : null);
      const edits: Array<{
        keyPath: string;
        value: unknown;
        mergeStrategy: "replace";
      }> = [
        {
          keyPath: `mcp_servers.${nextKey}`,
          value: serializeMcpServerDraft(draft),
          mergeStrategy: "replace" as const,
        },
      ];
      if (typeof editorKey === "string" && editorKey !== nextKey) {
        edits.push({
          keyPath: `mcp_servers.${editorKey}`,
          value: null,
          mergeStrategy: "replace" as const,
        });
      }

      await batchWriteConfigValues({
        edits,
        filePath: writeTarget.filePath,
        expectedVersion: writeTarget.expectedVersion,
        reloadUserConfig: true,
      });
      await reloadMcpServerConfig();
      await refresh();
      closeEditor();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  const deleteServer = async () => {
    if (typeof editorKey !== "string" || !writeTarget?.filePath) {
      return;
    }
    setActionError(null);
    setIsSaving(true);
    try {
      await batchWriteConfigValues({
        edits: [
          {
            keyPath: `mcp_servers.${editorKey}`,
            value: null,
            mergeStrategy: "replace",
          },
        ],
        filePath: writeTarget.filePath,
        expectedVersion: writeTarget.expectedVersion,
        reloadUserConfig: true,
      });
      await reloadMcpServerConfig();
      await refresh();
      closeEditor();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.section.mcp-settings")}</div>
        <div className="app-text-muted mt-1 text-[13px] leading-6">
          {renderInlineLinkMessage(t("settings.section.mcp-settings.subtitle"), MCP_DOCS_URL)}
        </div>
      </div>

      {actionError ? (
        <div className="app-card-error rounded-[18px] px-5 py-3 text-[13px] leading-6">{actionError}</div>
      ) : null}

      {editorKey === undefined ? (
        <>
          <div className="app-card rounded-[18px] px-5 py-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={openEditorForNewServer}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("settings.mcp.addServer")}
              </button>
            </div>
          </div>

          <div className="app-card rounded-[18px] px-5 py-4">
            {isLoading ? (
              <div className="app-text-muted py-6 text-[13px]">{t("settings.mcp.loading")}</div>
            ) : loadError ? (
              <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
                <div className="font-medium">{t("settings.mcp.loadError.title")}</div>
                <div className="app-text-muted mt-1 text-[12px]">{loadError}</div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
                >
                  {t("settings.mcp.loadError.retry")}
                </button>
              </div>
            ) : servers.length === 0 ? (
              <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
                <div>{t("settings.mcp.empty")}</div>
              </div>
            ) : (
              <div className="space-y-3">
                {servers.map(({ name, server }) => {
                  const authStatus = serverStatuses.find((entry) => entry.name === name)?.authStatus ?? null;
                  const showAuthenticate =
                    !isLoading &&
                    authStatus != null &&
                    authStatus !== "unsupported" &&
                    authStatus !== "bearerToken" &&
                    authStatus !== "oAuth";
                  const enabled = server.base.enabled;
                  const readOnly = configResponse?.origins[`mcp_servers.${name}`]?.name.type === "project";

                  return (
                    <div
                      key={name}
                      className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => openEditorForExistingServer(name)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-[14px] leading-6">{getServerLabel(name, server)}</div>
                          <div className="app-text-muted mt-1 truncate text-[11px] leading-5">{name}</div>
                        </button>
                        <div className="flex items-center gap-2">
                          {showAuthenticate ? (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void authenticateServer(name)}
                              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                            >
                              {t("settings.mcp.server.login")}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => openEditorForExistingServer(name)}
                            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                          >
                            {t("settings.mcp.server.settings")}
                          </button>
                          <ToggleSwitch
                            checked={enabled}
                            disabled={isSaving || readOnly}
                            ariaLabel={t("settings.mcp.server.enable")}
                            onChange={(checked) => void persistEnabled(name, checked)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <McpServerEditor
          title={editorTitle ?? ""}
          canSave={draft != null && !isReadOnly}
          isLoading={isLoading}
          isSaving={isSaving}
          isReadOnly={isReadOnly}
          draft={draft}
          existingKeys={existingKeys}
          initialKey={typeof editorKey === "string" ? editorKey : null}
          onBack={closeEditor}
          onDraftChange={setDraft}
          onDelete={typeof editorKey === "string" ? () => void deleteServer() : undefined}
          onSave={() => void saveServer()}
          t={t}
        />
      )}
      <div className="app-text-muted px-1 text-[11px] leading-5">
        {isRefreshing ? t("settings.mcp.refreshing") : null}
      </div>
    </div>
  );
}

function McpServerEditor({
  canSave,
  draft,
  existingKeys,
  initialKey,
  isLoading,
  isReadOnly,
  isSaving,
  onBack,
  onDelete,
  onDraftChange,
  onSave,
  t,
  title,
}: {
  canSave: boolean;
  draft: McpServerDraft | null;
  existingKeys: string[];
  initialKey: string | null;
  isLoading: boolean;
  isReadOnly: boolean;
  isSaving: boolean;
  onBack: () => void;
  onDelete?: () => void;
  onDraftChange: (next: McpServerDraft) => void;
  onSave: () => void;
  t: (key: MessageKey, values?: MessageValues) => string;
  title: string;
}) {
  if (!draft) {
    return null;
  }

  const transportOptions: Array<{ id: McpServerDraft["transportType"]; label: string }> = [
    { id: "stdio", label: t("settings.mcp.detail.transport.stdio") },
    { id: "streamable_http", label: t("settings.mcp.detail.transport.http") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[14px] font-medium">{title}</div>
            <div className="app-text-muted mt-1 text-[13px] leading-6">
              {renderInlineLinkMessage(t("settings.section.mcp-settings.subtitle"), MCP_DOCS_URL)}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={onBack} className="app-control rounded-[11px] px-3 py-1.5 text-[12px]">
              {t("settings.mcp.detail.back")}
            </button>
            {onDelete ? (
              <button
                type="button"
                disabled={isSaving || isReadOnly}
                onClick={onDelete}
                className="app-card-error rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("settings.mcp.detail.uninstall")}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isReadOnly ? (
        <div className="app-card-muted rounded-[18px] px-5 py-3 text-[13px] leading-6">
          {t("settings.mcp.readOnly")}
        </div>
      ) : null}

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow label={t("settings.mcp.detail.name")}>
            <input
              aria-label={t("settings.mcp.detail.name")}
              value={draft.label}
              onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
              disabled={isLoading || isSaving || isReadOnly}
              className="app-control h-9 w-[320px] rounded-[10px] px-3 text-[13px]"
            />
          </SettingRow>

          <SettingRow label={t("settings.mcp.detail.transport.label")}>
            <TransportToggle
              options={transportOptions}
              value={draft.transportType}
              disabled={isLoading || isSaving || isReadOnly}
              onChange={(transportType) => onDraftChange({ ...draft, transportType })}
            />
          </SettingRow>

          {draft.transportType === "stdio" ? (
            <>
              <SettingRow label={t("settings.mcp.detail.command")}>
                <input
                  aria-label={t("settings.mcp.detail.command")}
                  value={draft.stdio.command}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      stdio: { ...draft.stdio, command: event.target.value },
                    })
                  }
                  disabled={isLoading || isSaving || isReadOnly}
                  className="app-control h-9 w-[320px] rounded-[10px] px-3 text-[13px]"
                />
              </SettingRow>

              <ListEditor
                label={t("settings.mcp.detail.args")}
                addLabel={t("settings.mcp.detail.addArgument")}
                removeLabel={t("settings.mcp.detail.remove")}
                values={draft.stdio.args}
                disabled={isLoading || isSaving || isReadOnly}
                onChange={(values) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, args: values },
                  })
                }
              />

              <RecordEditor
                label={t("settings.mcp.detail.envVars")}
                addLabel={t("settings.mcp.detail.addEnvVar")}
                removeLabel={t("settings.mcp.detail.remove")}
                values={draft.stdio.env}
                disabled={isLoading || isSaving || isReadOnly}
                onChange={(values) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, env: values },
                  })
                }
              />

              <ListEditor
                label={t("settings.mcp.detail.envVarPassthrough")}
                addLabel={t("settings.mcp.detail.addEnvVarPassthrough")}
                removeLabel={t("settings.mcp.detail.remove")}
                values={draft.stdio.envVars}
                disabled={isLoading || isSaving || isReadOnly}
                onChange={(values) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, envVars: values },
                  })
                }
              />

              <SettingRow label={t("settings.mcp.detail.cwd")}>
                <input
                  aria-label={t("settings.mcp.detail.cwd")}
                  value={draft.stdio.cwd}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      stdio: { ...draft.stdio, cwd: event.target.value },
                    })
                  }
                  disabled={isLoading || isSaving || isReadOnly}
                  className="app-control h-9 w-[320px] rounded-[10px] px-3 text-[13px]"
                />
              </SettingRow>
            </>
          ) : (
            <>
              <SettingRow label={t("settings.mcp.detail.http.url")}>
                <input
                  aria-label={t("settings.mcp.detail.http.url")}
                  value={draft.http.url}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      http: { ...draft.http, url: event.target.value },
                    })
                  }
                  disabled={isLoading || isSaving || isReadOnly}
                  className="app-control h-9 w-[320px] rounded-[10px] px-3 text-[13px]"
                />
              </SettingRow>

              <SettingRow label={t("settings.mcp.detail.http.bearerToken")}>
                <input
                  aria-label={t("settings.mcp.detail.http.bearerToken")}
                  value={draft.http.bearerTokenEnvVar}
                  onChange={(event) =>
                    onDraftChange({
                      ...draft,
                      http: { ...draft.http, bearerTokenEnvVar: event.target.value },
                    })
                  }
                  disabled={isLoading || isSaving || isReadOnly}
                  className="app-control h-9 w-[320px] rounded-[10px] px-3 text-[13px]"
                />
              </SettingRow>

              <RecordEditor
                label={t("settings.mcp.detail.http.headers")}
                addLabel={t("settings.mcp.detail.http.addHeader")}
                removeLabel={t("settings.mcp.detail.remove")}
                values={draft.http.httpHeaders}
                disabled={isLoading || isSaving || isReadOnly}
                onChange={(values) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, httpHeaders: values },
                  })
                }
              />

              <RecordEditor
                label={t("settings.mcp.detail.http.envHeaders")}
                addLabel={t("settings.mcp.detail.http.addEnvHeader")}
                removeLabel={t("settings.mcp.detail.remove")}
                values={draft.http.envHttpHeaders}
                disabled={isLoading || isSaving || isReadOnly}
                onChange={(values) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, envHttpHeaders: values },
                  })
                }
              />
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={isLoading || isSaving || !canSave}
          onClick={onSave}
          className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
        >
          {t("settings.mcp.detail.save")}
        </button>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
      </div>
      {children}
    </div>
  );
}

function TransportToggle({
  disabled,
  options,
  value,
  onChange,
}: {
  disabled: boolean;
  options: Array<{ id: McpServerDraft["transportType"]; label: string }>;
  value: McpServerDraft["transportType"];
  onChange: (value: McpServerDraft["transportType"]) => void;
}) {
  return (
    <div className="app-segmented inline-flex rounded-[12px] p-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition",
            value === option.id ? "app-segmented-option-active" : "app-segmented-option-idle",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ListEditor({
  addLabel,
  disabled,
  label,
  removeLabel,
  onChange,
  values,
}: {
  addLabel: string;
  disabled: boolean;
  label: string;
  removeLabel: string;
  onChange: (values: string[]) => void;
  values: string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>{label}</div>
      <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3">
        <div className="space-y-2">
          {values.length > 0 ? (
            values.map((value, index) => (
              <div key={`${label}-${index}`} className="flex items-center gap-2">
                <input
                  value={value}
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = event.target.value;
                    onChange(next);
                  }}
                  disabled={disabled}
                  className="app-control h-9 flex-1 rounded-[10px] px-3 text-[13px]"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(values.filter((_, currentIndex) => currentIndex !== index))}
                  className="app-control rounded-[10px] px-3 py-1.5 text-[12px]"
                >
                  {removeLabel}
                </button>
              </div>
            ))
          ) : (
            <div className="app-text-muted text-[13px] leading-6">-</div>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...values, ""])}
            className="app-control rounded-[10px] px-3 py-1.5 text-[12px]"
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordEditor({
  addLabel,
  disabled,
  label,
  removeLabel,
  onChange,
  values,
}: {
  addLabel: string;
  disabled: boolean;
  label: string;
  removeLabel: string;
  onChange: (values: Array<{ key: string; value: string }>) => void;
  values: Array<{ key: string; value: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>{label}</div>
      <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3">
        <div className="space-y-2">
          {values.length > 0 ? (
            values.map((entry, index) => (
              <div key={`${label}-${index}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input
                  value={entry.key}
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = { ...next[index], key: event.target.value };
                    onChange(next);
                  }}
                  disabled={disabled}
                  placeholder="Key"
                  className="app-control h-9 rounded-[10px] px-3 text-[13px]"
                />
                <input
                  value={entry.value}
                  onChange={(event) => {
                    const next = [...values];
                    next[index] = { ...next[index], value: event.target.value };
                    onChange(next);
                  }}
                  disabled={disabled}
                  placeholder="Value"
                  className="app-control h-9 rounded-[10px] px-3 text-[13px]"
                />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(values.filter((_, currentIndex) => currentIndex !== index))}
                  className="app-control rounded-[10px] px-3 py-1.5 text-[12px]"
                >
                  {removeLabel}
                </button>
              </div>
            ))
          ) : (
            <div className="app-text-muted text-[13px] leading-6">-</div>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange([...values, { key: "", value: "" }])}
            className="app-control rounded-[10px] px-3 py-1.5 text-[12px]"
          >
            {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function getServerLabel(name: string, server: McpServerDraft | null) {
  return server?.label.trim() || name;
}
