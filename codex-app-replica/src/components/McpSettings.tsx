import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { ArrowLeftIcon, LinkExternalIcon, PlusIcon, RefreshIcon, SettingsCogIcon, TrashIcon } from "./AppShellIcons";
import { Button } from "./Button";
import { ControlGroup } from "./ControlGroup";
import { LoadingPage } from "./LoadingPage";
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
  const [authorizationUrlsByName, setAuthorizationUrlsByName] = useState<Record<string, string | null>>({});
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
      setAuthorizationUrlsByName((current) => {
        const { [notification.name]: _removed, ...rest } = current;
        return rest;
      });
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
        return getMcpServerDisplayName(left.name, left.server)
          .localeCompare(getMcpServerDisplayName(right.name, right.server))
          || left.name.localeCompare(right.name);
      }),
    [serverOrigins, serverStatuses, servers],
  );
  const selectedExistingServerConfig = useMemo(
    () => (typeof editorKey === "string" ? config?.mcpServers?.[editorKey] ?? null : null),
    [config, editorKey],
  );
  const isRestartRequired = dirtyHostIds.includes(selectedHostId);
  const initialDraft = useMemo(() => {
    if (editorKey === undefined) {
      return null;
    }
    if (editorKey === null) {
      return createBlankMcpServerDraft();
    }
    return createMcpServerEditorDraft(config?.mcpServers?.[editorKey] ?? null, editorKey);
  }, [config, editorKey]);
  const editorTitle =
    editorKey === undefined
      ? null
      : editorKey === null
        ? t("settings.mcp.detail.titleNew")
        : getMcpServerConfigName(selectedExistingServerConfig).trim().length > 0
          ? t("settings.mcp.detail.titleExisting", {
              name: formatMcpServerTitleName(getMcpServerConfigName(selectedExistingServerConfig)),
            })
          : t("settings.mcp.detail.titleNew");

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
    setDraft(createMcpServerEditorDraft(server ?? null, name));
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
    const cachedAuthorizationUrl = authorizationUrlsByName[name];
    if (cachedAuthorizationUrl) {
      await open(cachedAuthorizationUrl);
      return;
    }

    setAuthorizationUrlsByName((current) => ({ ...current, [name]: null }));
    try {
      const response = await loginMcpServer({
        hostId: selectedHostId,
        name,
      });
      setAuthorizationUrlsByName((current) => ({ ...current, [name]: response.authorizationUrl }));
      await open(response.authorizationUrl);
    } catch (error) {
      setAuthorizationUrlsByName((current) => {
        const { [name]: _removed, ...rest } = current;
        return rest;
      });
      throw error;
    }
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
      await emitQueryCacheInvalidated(CONFIG_QUERY_KEY);
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
      await emitQueryCacheInvalidated(CONFIG_QUERY_KEY);
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
            {serverListItems.length === 0 ? (
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
          {getMcpServerDisplayName(server.name, server.server)}
        </span>
      }
      control={
        <ControlGroup>
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
        </ControlGroup>
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
              <LinkExternalIcon className="icon-xxs" />
            </a>
            )
      }
      title={title}
    >
      <div className="relative">
        {isSaving ? <LoadingPage overlay /> : null}
        <SettingsGroup>
          <SettingsGroup.Content>
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
                      })}
                  />
                  <EditorListField
                    addLabel={t("settings.mcp.detail.addArgument")}
                    label={t("settings.mcp.detail.args")}
                    values={draft.stdio.args}
                    onChange={(args) =>
                      onDraftChange({
                        ...draft,
                        stdio: { ...draft.stdio, args },
                      })}
                  />
                  <EditorRecordField
                    addLabel={t("settings.mcp.detail.addEnvVar")}
                    label={t("settings.mcp.detail.envVars")}
                    values={draft.stdio.env}
                    onChange={(env) =>
                      onDraftChange({
                        ...draft,
                        stdio: { ...draft.stdio, env },
                      })}
                  />
                  <EditorListField
                    addLabel={t("settings.mcp.detail.addEnvVarPassthrough")}
                    label={t("settings.mcp.detail.envVarPassthrough")}
                    values={draft.stdio.envVars}
                    onChange={(envVars) =>
                      onDraftChange({
                        ...draft,
                        stdio: { ...draft.stdio, envVars },
                      })}
                  />
                  <EditorTextField
                    label={t("settings.mcp.detail.cwd")}
                    placeholder="~/code"
                    value={draft.stdio.cwd}
                    onChange={(cwd) =>
                      onDraftChange({
                        ...draft,
                        stdio: { ...draft.stdio, cwd },
                      })}
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
                      })}
                  />
                  <EditorTextField
                    label={t("settings.mcp.detail.http.bearerToken")}
                    placeholder="MCP_BEARER_TOKEN"
                    value={draft.http.bearerTokenEnvVar}
                    onChange={(bearerTokenEnvVar) =>
                      onDraftChange({
                        ...draft,
                        http: { ...draft.http, bearerTokenEnvVar },
                      })}
                  />
                  <EditorRecordField
                    addLabel={t("settings.mcp.detail.http.addHeader")}
                    label={t("settings.mcp.detail.http.headers")}
                    values={draft.http.httpHeaders}
                    onChange={(httpHeaders) =>
                      onDraftChange({
                        ...draft,
                        http: { ...draft.http, httpHeaders },
                      })}
                  />
                  <EditorRecordField
                    addLabel={t("settings.mcp.detail.http.addEnvHeader")}
                    label={t("settings.mcp.detail.http.envHeaders")}
                    values={draft.http.envHttpHeaders}
                    onChange={(envHttpHeaders) =>
                      onDraftChange({
                        ...draft,
                        http: { ...draft.http, envHttpHeaders },
                      })}
                  />
                </>
              )}
            </SettingsSurface>

            <div className="flex justify-end">
              <Button color="primary" disabled={isSaving || !canSave} size="toolbar" onClick={onSave}>
                {t("settings.mcp.detail.save")}
              </Button>
            </div>
          </SettingsGroup.Content>
        </SettingsGroup>
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
  return (
    <div className="bg-token-surface-secondary border-token-border flex items-center rounded-lg border" role="tablist">
      {options.map((option, index) => (
        <div key={option.id} className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            role="tab"
            aria-selected={value === option.id}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={[
              "text-token-text-secondary cursor-interaction relative flex-1 items-center rounded-none px-4 py-1.5 text-sm font-medium",
              index === 0 ? "rounded-l-md" : "",
              index === options.length - 1 ? "rounded-r-md" : "",
              value === option.id
                ? "bg-token-radio-active-foreground/25 text-token-text-primary"
                : "text-token-text-secondary hover:bg-token-radio-active-foreground/5",
            ].join(" ")}
          >
            {option.label}
          </button>
          {index < options.length - 1 ? (
            <div className="h-full w-px self-stretch bg-token-border" />
          ) : null}
        </div>
      ))}
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
    <div className="flex flex-col gap-3 rounded-lg bg-token-input-background px-3 py-2">
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
        <Button
          className="text-token-text-secondary/90 justify-center rounded-md border border-dashed text-base"
          color="secondary"
          size="toolbar"
          onClick={() => onChange(values.length > 0 ? [...values, ""] : [""])}
        >
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
    <div className="flex flex-col gap-3 rounded-lg bg-token-input-background px-3 py-2">
      <p className="text-base font-medium text-token-text-primary">{label}</p>
      <div className="flex flex-col gap-2">
        {displayValues.map((entry, index) => {
          const isOnlyBlankEntry =
            displayValues.length === 1 && entry.key.trim().length === 0 && entry.value.trim().length === 0;

          return (
            <div key={`${label}-${index}`} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
              <input
                className={EDITOR_RECORD_INPUT_CLASS}
                placeholder={t("settings.editRow.headerPlaceholder")}
                value={entry.key}
                onChange={(event) => {
                  const nextValues = [...displayValues];
                  nextValues[index] = { ...nextValues[index], key: event.target.value };
                  onChange(nextValues);
                }}
              />
              <input
                className={EDITOR_RECORD_INPUT_CLASS}
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
        <Button
          className="text-token-text-secondary/90 justify-center rounded-md border border-dashed text-base"
          color="secondary"
          size="toolbar"
          onClick={() => onChange([...displayValues, { key: "", value: "" }])}
        >
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

function getMcpServerDisplayName(name: string, server: McpServerDraft | null) {
  const customLabel = server?.label.trim();
  if (customLabel) {
    return customLabel;
  }

  if (name.trim().length === 0) {
    return "";
  }

  return name;
}

function getMcpServerConfigName(server: unknown) {
  if (typeof server !== "object" || server === null || !("name" in server)) {
    return "";
  }
  return typeof server.name === "string" ? server.name : "";
}

function createMcpServerEditorDraft(server: unknown, initialKey: string | null) {
  const normalized = normalizeMcpServerDraft(server, "");
  return {
    ...normalized,
    label: initialKey ?? getMcpServerConfigName(server),
  };
}

function formatMcpServerTitleName(name: string) {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) {
    return trimmedName;
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

const EDITOR_RECORD_INPUT_CLASS =
  "w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border";
