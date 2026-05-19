import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { PlusIcon, RefreshIcon, SettingsCogIcon, TrashIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { useI18n } from "../i18n/i18n";
import { type MessageKey, type MessageValues } from "../i18n/messages";
import {
  batchWriteConfigValueForHost,
  readConfigForHost,
  resolveConfigChildOrigins,
  resolveConfigWriteTargetForKeyPath,
  writeConfigValueForHost,
} from "../services/settings";
import {
  emitQueryCacheInvalidated,
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../services/queryCache";
import {
  createBlankMcpServerDraft,
  listMcpServerStatuses,
  loginMcpServer,
  onCodexAppServerInitialized,
  normalizeMcpServerDraft,
  restartCodexAppServer,
  onMcpOauthLoginCompleted,
  parseMcpServers,
  sanitizeMcpServerKey,
  serializeMcpServerDraft,
  type McpServerDraft,
  type McpServerStatusEntry,
} from "../services/mcp";
import { ToggleSwitch } from "./ToggleSwitch";

const MCP_DOCS_URL = "https://developers.openai.com/codex/mcp/";
const LOCAL_HOST_ID = "local";
const CONFIG_QUERY_KEY = ["config"] as const;

type EditorKey = string | null | undefined;
type Translate = (key: MessageKey, values?: MessageValues) => string;

type McpServerListItem = {
  authStatus: string | null;
  isReadOnly: boolean;
  name: string;
  server: McpServerDraft;
};

export function McpSettings({
  selectedHostId,
  workspaceRoot,
}: {
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const [configResponse, setConfigResponse] = useState<Awaited<ReturnType<typeof readConfigForHost>> | null>(null);
  const [serverStatuses, setServerStatuses] = useState<McpServerStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editorKey, setEditorKey] = useState<EditorKey>(undefined);
  const [draft, setDraft] = useState<McpServerDraft | null>(null);
  const [dirtyHostIds, setDirtyHostIds] = useState<string[]>([]);
  const loadRequestIdRef = useRef(0);
  const effectiveWorkspaceRoot = selectedHostId === LOCAL_HOST_ID ? workspaceRoot : null;

  const load = async () => {
    const requestId = ++loadRequestIdRef.current;
    setIsLoading(true);
    setIsStatusLoading(true);

    const [configResult, statusesResult] = await Promise.allSettled([
      readConfigForHost({
        hostId: selectedHostId,
        cwd: effectiveWorkspaceRoot,
        includeLayers: true,
      }),
      listMcpServerStatuses(selectedHostId),
    ]);

    if (requestId !== loadRequestIdRef.current) {
      return;
    }

    setConfigResponse(
      configResult.status === "fulfilled" ? configResult.value : createEmptyConfigReadResponse(),
    );
    setServerStatuses(statusesResult.status === "fulfilled" ? statusesResult.value.data : []);
    setIsLoading(false);
    setIsStatusLoading(false);
  };

  useEffect(() => {
    void load();
  }, [effectiveWorkspaceRoot, selectedHostId]);

  useEffect(() => {
    return () => {
      loadRequestIdRef.current += 1;
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void onMcpOauthLoginCompleted((notification) => {
      if (notification.hostId !== selectedHostId) {
        return;
      }
      if (notification.success) {
        markSelectedHostDirty();
        void load();
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [effectiveWorkspaceRoot, selectedHostId]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void onCodexAppServerInitialized((notification) => {
      if (notification.hostId !== selectedHostId) {
        return;
      }
      setDirtyHostIds((current) => current.filter((hostId) => hostId !== notification.hostId));
      void load();
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [effectiveWorkspaceRoot, selectedHostId]);

  const handleQueryCacheInvalidate = useEffectEvent((notification: QueryCacheInvalidateNotification) => {
    if (!queryKeyMatchesPrefix(notification.queryKey, CONFIG_QUERY_KEY)) {
      return;
    }

    void load();
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed) {
        handleQueryCacheInvalidate(notification);
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

  const config = configResponse?.config ?? null;
  const servers = useMemo(() => parseMcpServers(config), [config]);
  const writeTarget = useMemo(() => {
    if (!configResponse) {
      return null;
    }
    return resolveConfigWriteTargetForKeyPath(configResponse, "mcp_servers", ["enabled", "command", "url"]);
  }, [configResponse]);
  const existingKeys = useMemo(() => Object.keys(config?.mcpServers ?? {}), [config]);
  const serverOrigins = useMemo(() => {
    if (!configResponse) {
      return {};
    }
    return resolveConfigChildOrigins(configResponse, "mcp_servers", existingKeys, ["enabled", "command", "url"]);
  }, [configResponse, existingKeys]);
  const serverListItems = useMemo<McpServerListItem[]>(
    () =>
      servers.map(({ name, server }) => ({
        authStatus: serverStatuses.find((entry) => entry.name === name)?.authStatus ?? null,
        isReadOnly: serverOrigins[name]?.name.type === "project",
        name,
        server,
      })).sort((left, right) => {
        return formatMcpServerLabel(left.name, left.server)
          .localeCompare(formatMcpServerLabel(right.name, right.server))
          || left.name.localeCompare(right.name);
      }),
    [serverOrigins, serverStatuses, servers],
  );
  const selectedExistingServer = useMemo(
    () => (typeof editorKey === "string" ? servers.find((entry) => entry.name === editorKey) ?? null : null),
    [editorKey, servers],
  );
  const isRestartRequired = dirtyHostIds.includes(selectedHostId);
  const initialDraft = useMemo(() => {
    if (editorKey === undefined) {
      return null;
    }
    if (editorKey === null) {
      return createBlankMcpServerDraft();
    }
    return normalizeMcpServerDraft(config?.mcpServers?.[editorKey] ?? null, editorKey);
  }, [config, editorKey]);
  const editorTitle =
    editorKey === undefined
      ? null
      : editorKey === null
        ? t("settings.mcp.detail.titleNew")
        : t("settings.mcp.detail.titleExisting", {
            name: formatMcpServerLabel(selectedExistingServer?.name ?? editorKey, selectedExistingServer?.server ?? null),
          });

  const openEditorForNewServer = () => {
    setEditorKey(null);
    setDraft(createBlankMcpServerDraft());
  };

  const openEditorForExistingServer = (name: string) => {
    if (serverOrigins[name]?.name.type === "project") {
      return;
    }

    const server = config?.mcpServers?.[name];
    setEditorKey(name);
    setDraft(normalizeMcpServerDraft(server ?? null, name));
  };

  const closeEditor = () => {
    setEditorKey(undefined);
    setDraft(null);
  };

  const markSelectedHostDirty = () => {
    setDirtyHostIds((current) =>
      current.includes(selectedHostId) ? current : [...current, selectedHostId],
    );
  };

  const restartAppServer = async () => {
    await restartCodexAppServer(selectedHostId);
  };

  const persistEnabled = async (name: string, enabled: boolean) => {
    setIsSaving(true);
    try {
      await writeConfigValueForHost({
        hostId: selectedHostId,
        keyPath: `mcp_servers.${name}.enabled`,
        value: enabled,
        mergeStrategy: "upsert",
      });
      markSelectedHostDirty();
      await load();
      await emitQueryCacheInvalidated(CONFIG_QUERY_KEY);
    } finally {
      setIsSaving(false);
    }
  };

  const authenticateServer = async (name: string) => {
    const response = await loginMcpServer({
      hostId: selectedHostId,
      name,
    });
    await open(response.authorizationUrl);
  };

  const saveServer = async () => {
    if (!draft || !writeTarget?.filePath) {
      return;
    }

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
          mergeStrategy: "replace",
        },
      ];

      if (typeof editorKey === "string" && editorKey !== nextKey) {
        edits.push({
          keyPath: `mcp_servers.${editorKey}`,
          value: null,
          mergeStrategy: "replace",
        });
      }

      await batchWriteConfigValueForHost({
        hostId: selectedHostId,
        edits,
        filePath: writeTarget.filePath,
        expectedVersion: writeTarget.expectedVersion,
        reloadUserConfig: true,
      });
      markSelectedHostDirty();
      await load();
      closeEditor();
    } finally {
      setIsSaving(false);
    }
  };

  const deleteServer = async () => {
    if (typeof editorKey !== "string" || !writeTarget?.filePath) {
      return;
    }

    setIsSaving(true);
    try {
      await batchWriteConfigValueForHost({
        hostId: selectedHostId,
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
      markSelectedHostDirty();
      await load();
      closeEditor();
    } finally {
      setIsSaving(false);
    }
  };

  if (editorKey !== undefined && draft && initialDraft && editorTitle) {
    return (
      <McpServerEditor
        canSave={hasMcpDraftChanges(draft, initialDraft) && isMcpDraftValid(draft)}
        draft={draft}
        initialDraft={initialDraft}
        isExistingServer={editorKey !== null}
        isSaving={isSaving}
        title={editorTitle}
        onBack={closeEditor}
        onDelete={typeof editorKey === "string" ? () => void deleteServer() : undefined}
        onDraftChange={setDraft}
        onSave={() => void saveServer()}
      />
    );
  }

  return (
    <SettingsContentLayout
      action={
        isRestartRequired ? (
          <Button color="ghost" size="toolbar" onClick={() => void restartAppServer()}>
            <RefreshIcon className="icon-xs" />
            {t("settings.mcp.restartApp")}
          </Button>
        ) : null
      }
      subtitle={<McpSectionSubtitle />}
      title={<SettingsSectionTitle slug="mcp-settings" />}
    >
      <SettingsGroup>
        <SettingsGroup.Header
          actions={
            serverListItems.length > 0 ? (
              <AddServerButton onClick={openEditorForNewServer} />
            ) : null
          }
          title={t("settings.mcp.myServers")}
        />
        <SettingsGroup.Content>
          <SettingsSurface>
            {isLoading ? (
              <SettingsRow label={t("settings.mcp.loading")} />
            ) : serverListItems.length === 0 ? (
              <SettingsRow
                label={t("settings.mcp.empty")}
                control={<AddServerButton onClick={openEditorForNewServer} />}
              />
            ) : (
              serverListItems.map((server) => (
                <McpServerRow
                  key={server.name}
                  isSaving={isSaving}
                  isStatusLoading={isStatusLoading}
                  server={server}
                  onAuthenticate={authenticateServer}
                  onOpenEditor={openEditorForExistingServer}
                  onToggleEnabled={persistEnabled}
                />
              ))
            )}
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function McpServerRow({
  isSaving,
  isStatusLoading,
  server,
  onAuthenticate,
  onOpenEditor,
  onToggleEnabled,
}: {
  isSaving: boolean;
  isStatusLoading: boolean;
  server: McpServerListItem;
  onAuthenticate: (name: string) => Promise<void>;
  onOpenEditor: (name: string) => void;
  onToggleEnabled: (name: string, enabled: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const showAuthenticate =
    !isStatusLoading &&
    server.authStatus != null &&
    server.authStatus !== "unsupported" &&
    server.authStatus !== "bearerToken" &&
    server.authStatus !== "oAuth";

  return (
    <SettingsRow
      label={
        <span className="font-medium text-token-text-primary">
          {formatMcpServerLabel(server.name, server.server)}
        </span>
      }
      control={
        <div className="flex min-w-0 items-center gap-2">
          {showAuthenticate ? (
            <Button color="outline" disabled={isSaving} size="toolbar" onClick={() => void onAuthenticate(server.name)}>
              {t("settings.mcp.server.login")}
            </Button>
          ) : null}
          <Button
            aria-label={t("settings.mcp.server.settings")}
            color="ghost"
            disabled={isSaving || server.isReadOnly}
            size="toolbar"
            uniform
            onClick={() => onOpenEditor(server.name)}
          >
            <SettingsCogIcon className="icon-xs" />
          </Button>
          <ToggleSwitch
            checked={server.server.base.enabled}
            disabled={isSaving || isStatusLoading || server.isReadOnly}
            ariaLabel={t("settings.mcp.server.enable")}
            onChange={(checked) => void onToggleEnabled(server.name, checked)}
          />
        </div>
      }
    />
  );
}

function McpServerEditor({
  canSave,
  draft,
  initialDraft,
  isExistingServer,
  isSaving,
  title,
  onBack,
  onDelete,
  onDraftChange,
  onSave,
}: {
  canSave: boolean;
  draft: McpServerDraft;
  initialDraft: McpServerDraft;
  isExistingServer: boolean;
  isSaving: boolean;
  title: string;
  onBack: () => void;
  onDelete?: () => void;
  onDraftChange: (next: McpServerDraft) => void;
  onSave: () => void;
}) {
  const { t } = useI18n();
  const isTransportLocked = isExistingServer;
  const showStdioFields = draft.transportType === "stdio";
  const nameValue = isExistingServer ? initialDraft.label : draft.label;

  return (
    <SettingsContentLayout
      action={
        onDelete ? (
          <Button color="danger" disabled={isSaving} size="toolbar" onClick={onDelete}>
            <TrashIcon className="icon-xs" />
            {t("settings.mcp.detail.uninstall")}
          </Button>
        ) : null
      }
      backSlot={
        <Button color="ghost" size="toolbar" onClick={onBack}>
          <ArrowLeftIcon className="icon-xs" />
          {t("settings.mcp.detail.back")}
        </Button>
      }
      subtitle={
        isExistingServer
          ? null
          : (
            <a
              aria-label={t("settings.mcp.detail.docs")}
              className="inline-flex items-center gap-1 text-sm text-token-text-secondary hover:text-token-text-primary"
              href={MCP_DOCS_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t("settings.mcp.detail.docs.link")}
            </a>
            )
      }
      title={title}
    >
      <div className="flex flex-col gap-4">
        {isTransportLocked ? (
          <p className="text-sm text-token-text-secondary">
            {t("settings.mcp.detail.switchTransportNotice")}
          </p>
        ) : (
          <SettingsSurface>
            <EditorTextField
              label={t("settings.mcp.detail.name")}
              placeholder="MCP server name"
              value={nameValue}
              onChange={(label) => onDraftChange({ ...draft, label })}
            />
            <EditorTransportField
              options={[
                { id: "stdio", label: t("settings.mcp.detail.transport.stdio") },
                { id: "streamable_http", label: t("settings.mcp.detail.transport.http") },
              ]}
              value={draft.transportType}
              onChange={(transportType) => onDraftChange({ ...draft, transportType })}
            />
          </SettingsSurface>
        )}

        <SettingsSurface>
          {showStdioFields ? (
            <>
              <EditorTextField
                label={t("settings.mcp.detail.command")}
                placeholder="openai-dev-mcp serve-sqlite"
                value={draft.stdio.command}
                onChange={(command) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, command },
                  })
                }
              />
              <EditorListField
                addLabel={t("settings.mcp.detail.addArgument")}
                label={t("settings.mcp.detail.args")}
                values={draft.stdio.args}
                onChange={(args) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, args },
                  })
                }
              />
              <EditorRecordField
                addLabel={t("settings.mcp.detail.addEnvVar")}
                label={t("settings.mcp.detail.envVars")}
                values={draft.stdio.env}
                onChange={(env) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, env },
                  })
                }
              />
              <EditorListField
                addLabel={t("settings.mcp.detail.addEnvVarPassthrough")}
                label={t("settings.mcp.detail.envVarPassthrough")}
                values={draft.stdio.envVars}
                onChange={(envVars) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, envVars },
                  })
                }
              />
              <EditorTextField
                label={t("settings.mcp.detail.cwd")}
                placeholder="~/code"
                value={draft.stdio.cwd}
                onChange={(cwd) =>
                  onDraftChange({
                    ...draft,
                    stdio: { ...draft.stdio, cwd },
                  })
                }
              />
            </>
          ) : (
            <>
              <EditorTextField
                label={t("settings.mcp.detail.http.url")}
                placeholder="https://mcp.example.com/mcp"
                value={draft.http.url}
                onChange={(url) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, url },
                  })
                }
              />
              <EditorTextField
                label={t("settings.mcp.detail.http.bearerToken")}
                placeholder="MCP_BEARER_TOKEN"
                value={draft.http.bearerTokenEnvVar}
                onChange={(bearerTokenEnvVar) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, bearerTokenEnvVar },
                  })
                }
              />
              <EditorRecordField
                addLabel={t("settings.mcp.detail.http.addHeader")}
                label={t("settings.mcp.detail.http.headers")}
                values={draft.http.httpHeaders}
                onChange={(httpHeaders) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, httpHeaders },
                  })
                }
              />
              <EditorRecordField
                addLabel={t("settings.mcp.detail.http.addEnvHeader")}
                label={t("settings.mcp.detail.http.envHeaders")}
                values={draft.http.envHttpHeaders}
                onChange={(envHttpHeaders) =>
                  onDraftChange({
                    ...draft,
                    http: { ...draft.http, envHttpHeaders },
                  })
                }
              />
            </>
          )}
        </SettingsSurface>

        <div className="flex justify-end">
          <Button color="primary" disabled={isSaving || !canSave} size="toolbar" onClick={onSave}>
            {t("settings.mcp.detail.save")}
          </Button>
        </div>
      </div>
    </SettingsContentLayout>
  );
}

function EditorTextField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-token-input-background px-3 py-2">
      <p className="text-base font-medium text-token-text-primary">{label}</p>
      <input
        className={EDITOR_INPUT_CLASS}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function EditorTransportField({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: McpServerDraft["transportType"]; label: string }>;
  value: McpServerDraft["transportType"];
  onChange: (value: McpServerDraft["transportType"]) => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-token-input-background px-3 py-2">
      <div className="text-base font-medium text-token-text-primary">
        <span>{options.length > 0 ? t("settings.mcp.detail.transport.label") : ""}</span>
      </div>
      <div className="bg-token-surface-secondary border-token-border flex items-center rounded-lg border p-0.5">
        {options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={[
              "flex-1 rounded-md px-4 py-1.5 text-sm font-medium transition",
              index > 0 ? "ml-0.5" : "",
              value === option.id
                ? "bg-token-radio-active-foreground/25 text-token-text-primary"
                : "text-token-text-secondary hover:bg-token-radio-active-foreground/5",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditorListField({
  addLabel,
  label,
  values,
  onChange,
}: {
  addLabel: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const { t } = useI18n();
  const displayValues = values.length > 0 ? values : [""];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-token-input-background px-3 py-2">
      <p className="text-base font-medium text-token-text-primary">{label}</p>
      <div className="flex flex-col gap-2">
        {displayValues.map((value, index) => {
          const isOnlyBlankEntry = displayValues.length === 1 && value.trim().length === 0;
          return (
            <div key={`${label}-${index}`} className="flex items-center gap-2">
              <input
                className={EDITOR_INPUT_CLASS}
                value={value}
                onChange={(event) => {
                  const nextValues = [...displayValues];
                  nextValues[index] = event.target.value;
                  onChange(nextValues);
                }}
              />
              <Button
                aria-label={t("settings.editRow.removeEntry")}
                color="ghost"
                disabled={isOnlyBlankEntry}
                size="icon"
                uniform
                onClick={() => onChange(displayValues.filter((_, currentIndex) => currentIndex !== index))}
              >
                <TrashIcon className="icon-2xs" />
              </Button>
            </div>
          );
        })}
        <Button color="secondary" size="toolbar" onClick={() => onChange([...values, ""])}>
          <PlusIcon className="icon-2xs" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function EditorRecordField({
  addLabel,
  label,
  values,
  onChange,
}: {
  addLabel: string;
  label: string;
  values: Array<{ key: string; value: string }>;
  onChange: (values: Array<{ key: string; value: string }>) => void;
}) {
  const { t } = useI18n();
  const displayValues = values.length > 0 ? values : [{ key: "", value: "" }];

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-token-input-background px-3 py-2">
      <p className="text-base font-medium text-token-text-primary">{label}</p>
      <div className="flex flex-col gap-2">
        {displayValues.map((entry, index) => {
          const isOnlyBlankEntry =
            displayValues.length === 1 && entry.key.trim().length === 0 && entry.value.trim().length === 0;

          return (
            <div key={`${label}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                className={EDITOR_INPUT_CLASS}
                placeholder={t("settings.editRow.headerPlaceholder")}
                value={entry.key}
                onChange={(event) => {
                  const nextValues = [...displayValues];
                  nextValues[index] = { ...nextValues[index], key: event.target.value };
                  onChange(nextValues);
                }}
              />
              <input
                className={EDITOR_INPUT_CLASS}
                placeholder={t("settings.editRow.valuePlaceholder")}
                value={entry.value}
                onChange={(event) => {
                  const nextValues = [...displayValues];
                  nextValues[index] = { ...nextValues[index], value: event.target.value };
                  onChange(nextValues);
                }}
              />
              <Button
                aria-label={t("settings.editRow.removeEntry")}
                color="ghost"
                disabled={isOnlyBlankEntry}
                size="icon"
                uniform
                onClick={() => onChange(displayValues.filter((_, currentIndex) => currentIndex !== index))}
              >
                <TrashIcon className="icon-2xs" />
              </Button>
            </div>
          );
        })}
        <Button color="secondary" size="toolbar" onClick={() => onChange([...values, { key: "", value: "" }])}>
          <PlusIcon className="icon-2xs" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}

function AddServerButton({
  onClick,
}: {
  onClick: () => void;
}) {
  const { t } = useI18n();

  return (
    <Button color="secondary" size="toolbar" onClick={onClick}>
      <PlusIcon className="icon-xs" />
      {t("settings.mcp.addServer")}
    </Button>
  );
}

function McpSectionSubtitle() {
  const { t } = useI18n();

  return (
    <div>
      {t("settings.section.mcp-settings.subtitle")}
      <a
        className="inline-flex items-center gap-1 text-base text-token-text-link-foreground"
        href={MCP_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {t("settings.section.mcp-settings.learnMore")}
      </a>
    </div>
  );
}

function ArrowLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.8011 3.611C9.05912 3.44087 9.40989 3.46898 9.63703 3.69596C9.89673 3.95566 9.89673 4.37767 9.63703 4.63737L4.93977 9.33463H16.6663L16.8011 9.34831C17.1038 9.41043 17.3312 9.67859 17.3314 9.99967C17.3314 10.3209 17.1039 10.5888 16.8011 10.651L16.6663 10.6647H4.93879L9.63703 15.363L9.722 15.4674C9.89241 15.7255 9.86413 16.0761 9.63703 16.3034C9.40981 16.5306 9.05921 16.5587 8.8011 16.3883L8.69661 16.3034L2.86262 10.4704C2.60319 10.2108 2.6033 9.78962 2.86262 9.52995L8.69661 3.69596L8.8011 3.611Z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatMcpServerLabel(name: string, server: McpServerDraft | null) {
  const customLabel = server?.label.trim();
  if (customLabel) {
    return customLabel;
  }

  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return "";
  }

  return trimmedName === trimmedName.toLowerCase()
    ? `${trimmedName[0]?.toUpperCase() ?? ""}${trimmedName.slice(1)}`
    : trimmedName;
}

function createEmptyConfigReadResponse(): Awaited<ReturnType<typeof readConfigForHost>> {
  return {
    config: {
      approvalPolicy: null,
      sandboxMode: null,
      sandboxWorkspaceWrite: null,
      approvalsReviewer: null,
      personality: null,
      modelPersonality: null,
      serviceTier: null,
      memories: null,
      features: null,
      mcpServers: {},
    },
    origins: {},
    layers: null,
  };
}

function hasMcpDraftChanges(draft: McpServerDraft, initialDraft: McpServerDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initialDraft);
}

function isMcpDraftValid(draft: McpServerDraft) {
  return draft.label.trim().length > 0 &&
    (draft.transportType === "streamable_http"
      ? draft.http.url.trim().length > 0
      : draft.stdio.command.trim().length > 0);
}

const EDITOR_INPUT_CLASS =
  "w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-base text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border";
