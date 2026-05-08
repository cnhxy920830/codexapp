import { useEffect, useMemo, useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-shell";
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
type Translate = (key: MessageKey, values?: MessageValues) => string;

type McpServerListItem = {
  authStatus: string | null;
  isReadOnly: boolean;
  name: string;
  server: McpServerDraft;
};

export function McpSettings({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t } = useI18n();
  const [configResponse, setConfigResponse] = useState<Awaited<ReturnType<typeof readConfig>> | null>(null);
  const [serverStatuses, setServerStatuses] = useState<McpServerStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState<EditorKey>(undefined);
  const [draft, setDraft] = useState<McpServerDraft | null>(null);

  const load = async () => {
    setIsLoading(true);
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
    }
  };

  useEffect(() => {
    void load();
  }, [workspaceRoot]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void onMcpOauthLoginCompleted((notification) => {
      if (notification.success) {
        void load();
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      unlisten?.();
    };
  }, [workspaceRoot]);

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
  const serverListItems = useMemo<McpServerListItem[]>(
    () =>
      servers.map(({ name, server }) => ({
        authStatus: serverStatuses.find((entry) => entry.name === name)?.authStatus ?? null,
        isReadOnly: configResponse?.origins[`mcp_servers.${name}`]?.name.type === "project",
        name,
        server,
      })),
    [configResponse, serverStatuses, servers],
  );
  const selectedExistingServer = useMemo(
    () => (typeof editorKey === "string" ? servers.find((entry) => entry.name === editorKey) ?? null : null),
    [editorKey, servers],
  );
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
    if (configResponse?.origins[`mcp_servers.${name}`]?.name.type === "project") {
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

  const persistEnabled = async (name: string, enabled: boolean) => {
    if (!writeTarget?.filePath) {
      return;
    }

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
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const authenticateServer = async (name: string) => {
    const response = await loginMcpServer(name);
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

      await batchWriteConfigValues({
        edits,
        filePath: writeTarget.filePath,
        expectedVersion: writeTarget.expectedVersion,
        reloadUserConfig: true,
      });
      await reloadMcpServerConfig();
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
      subtitle={renderMcpSectionSubtitle(t("settings.section.mcp-settings.subtitle"))}
      title={t("settings.section.mcp-settings")}
    >
      <SettingsGroup>
        <SettingsGroupHeader
          actions={
            <ToolbarButton
              label={t("settings.mcp.addServer")}
              icon={<PlusIcon className="icon-xs" />}
              onClick={openEditorForNewServer}
            />
          }
          title={t("settings.mcp.myServers")}
        />
        <SettingsGroupContent>
          <SettingsSurface>
            {isLoading ? (
              <SettingsRow label={t("settings.mcp.loading")} />
            ) : loadError ? (
              <SettingsRow
                label={
                  <div className="flex flex-col gap-1">
                    <span>{t("settings.mcp.loadError.title")}</span>
                    <span className="text-xs text-token-text-secondary">{loadError}</span>
                  </div>
                }
                control={
                  <ToolbarButton
                    label={t("settings.mcp.loadError.retry")}
                    onClick={() => void load()}
                  />
                }
              />
            ) : serverListItems.length === 0 ? (
              <SettingsRow
                label={t("settings.mcp.empty")}
                control={
                  <ToolbarButton
                    label={t("settings.mcp.addServer")}
                    icon={<PlusIcon className="icon-xs" />}
                    onClick={openEditorForNewServer}
                  />
                }
              />
            ) : (
              serverListItems.map((server) => (
                <McpServerRow
                  key={server.name}
                  isSaving={isSaving}
                  server={server}
                  onAuthenticate={authenticateServer}
                  onOpenEditor={openEditorForExistingServer}
                  onToggleEnabled={persistEnabled}
                />
              ))
            )}
          </SettingsSurface>
        </SettingsGroupContent>
      </SettingsGroup>
    </SettingsContentLayout>
  );
}

function McpServerRow({
  isSaving,
  server,
  onAuthenticate,
  onOpenEditor,
  onToggleEnabled,
}: {
  isSaving: boolean;
  server: McpServerListItem;
  onAuthenticate: (name: string) => Promise<void>;
  onOpenEditor: (name: string) => void;
  onToggleEnabled: (name: string, enabled: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const showAuthenticate =
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
        <div className="flex items-center gap-2">
          {showAuthenticate ? (
            <ToolbarButton
              label={t("settings.mcp.server.login")}
              disabled={isSaving}
              onClick={() => void onAuthenticate(server.name)}
            />
          ) : null}
          <IconToolbarButton
            ariaLabel={t("settings.mcp.server.settings")}
            disabled={isSaving || server.isReadOnly}
            icon={<SettingsCogIcon className="icon-sm" />}
            onClick={() => onOpenEditor(server.name)}
          />
          <ToggleSwitch
            checked={server.server.base.enabled}
            disabled={isSaving || server.isReadOnly}
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
          <ToolbarButton
            label={t("settings.mcp.detail.uninstall")}
            color="danger"
            disabled={isSaving}
            icon={<TrashIcon className="icon-xs" />}
            onClick={onDelete}
          />
        ) : null
      }
      backSlot={
        <ToolbarButton
          label={t("settings.mcp.detail.back")}
          color="ghost"
          icon={<ArrowLeftIcon className="icon-xs" />}
          onClick={onBack}
        />
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
          <ToolbarButton
            label={t("settings.mcp.detail.save")}
            color="primary"
            disabled={isSaving || !canSave}
            onClick={onSave}
          />
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
              <IconToolbarButton
                ariaLabel={t("settings.editRow.removeEntry")}
                disabled={isOnlyBlankEntry}
                icon={<TrashIcon className="icon-2xs" />}
                onClick={() => onChange(displayValues.filter((_, currentIndex) => currentIndex !== index))}
              />
            </div>
          );
        })}
        <ToolbarButton
          label={addLabel}
          icon={<PlusIcon className="icon-2xs" />}
          onClick={() => onChange([...values, ""])}
        />
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
              <IconToolbarButton
                ariaLabel={t("settings.editRow.removeEntry")}
                disabled={isOnlyBlankEntry}
                icon={<TrashIcon className="icon-2xs" />}
                onClick={() => onChange(displayValues.filter((_, currentIndex) => currentIndex !== index))}
              />
            </div>
          );
        })}
        <ToolbarButton
          label={addLabel}
          icon={<PlusIcon className="icon-2xs" />}
          onClick={() => onChange([...values, { key: "", value: "" }])}
        />
      </div>
    </div>
  );
}

function renderMcpSectionSubtitle(template: string) {
  const startTag = "<a>";
  const endTag = "</a>";
  const startIndex = template.indexOf(startTag);
  const endIndex = template.indexOf(endTag);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    return template;
  }

  const prefix = template.slice(0, startIndex);
  const linkLabel = template.slice(startIndex + startTag.length, endIndex);
  const suffix = template.slice(endIndex + endTag.length);

  return (
    <div>
      {prefix}
      <a
        className="inline-flex items-center gap-1 text-base text-token-text-link-foreground"
        href={MCP_DOCS_URL}
        target="_blank"
        rel="noreferrer"
      >
        {linkLabel}
      </a>
      {suffix}
    </div>
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

function hasMcpDraftChanges(draft: McpServerDraft, initialDraft: McpServerDraft) {
  return JSON.stringify(draft) !== JSON.stringify(initialDraft);
}

function isMcpDraftValid(draft: McpServerDraft) {
  return draft.label.trim().length > 0 &&
    (draft.transportType === "streamable_http"
      ? draft.http.url.trim().length > 0
      : draft.stdio.command.trim().length > 0);
}

function SettingsContentLayout({
  action,
  backSlot,
  children,
  subtitle,
  title,
}: {
  action?: ReactNode;
  backSlot?: ReactNode;
  children: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="main-surface flex h-full min-h-0 flex-col">
      {backSlot ? (
        <div className="draggable flex items-center px-5 pt-4">
          {backSlot}
        </div>
      ) : null}
      <div className="scrollbar-stable flex-1 overflow-y-auto p-5">
        <div className="mx-auto flex w-full max-w-2xl flex-col">
          <div className="flex items-start justify-between gap-3 pb-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <h1 className="text-[20px] font-medium leading-7 text-token-text-primary">{title}</h1>
              {subtitle ? <div className="text-base text-token-text-secondary">{subtitle}</div> : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
          <div className="flex flex-col gap-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SettingsGroup({
  children,
}: {
  children: ReactNode;
}) {
  return <section className="flex flex-col">{children}</section>;
}

function SettingsGroupHeader({
  actions,
  title,
}: {
  actions?: ReactNode;
  title?: ReactNode;
}) {
  if (!title && !actions) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 pb-3">
      <div className="min-w-0 flex-1 text-base font-medium text-token-text-primary">{title}</div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function SettingsGroupContent({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function SettingsSurface({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border"
      style={{
        backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
      }}
    >
      {children}
    </div>
  );
}

function SettingsRow({
  control,
  label,
}: {
  control?: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="min-w-0 text-sm text-token-text-primary">{label}</div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

function ToolbarButton({
  color = "secondary",
  disabled = false,
  icon,
  label,
  onClick,
}: {
  color?: "danger" | "ghost" | "primary" | "secondary";
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-50",
        color === "ghost"
          ? "text-token-text-secondary hover:bg-token-radio-active-foreground/5 hover:text-token-text-primary"
          : color === "primary"
            ? "bg-token-text-primary text-token-bg-primary hover:opacity-90"
            : color === "danger"
              ? "border border-token-error-foreground/30 bg-token-error-foreground/10 text-token-error-foreground hover:bg-token-error-foreground/15"
              : "border border-token-border bg-token-main-surface-primary text-token-text-primary hover:bg-token-list-hover-background",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

function IconToolbarButton({
  ariaLabel,
  disabled = false,
  icon,
  onClick,
}: {
  ariaLabel: string;
  disabled?: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-token-text-secondary transition hover:bg-token-radio-active-foreground/5 hover:text-token-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {icon}
    </button>
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

function PlusIcon({ className }: { className?: string }) {
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
        d="M9.33496 16.5V10.665H3.5C3.13273 10.665 2.83496 10.3673 2.83496 10C2.83496 9.63273 3.13273 9.33496 3.5 9.33496H9.33496V3.5C9.33496 3.13273 9.63273 2.83496 10 2.83496C10.3673 2.83496 10.665 3.13273 10.665 3.5V9.33496H16.5L16.6338 9.34863C16.9369 9.41057 17.165 9.67857 17.165 10C17.165 10.3214 16.9369 10.5894 16.6338 10.6514L16.5 10.665H10.665V16.5C10.665 16.8673 10.3673 17.165 10 17.165C9.63273 17.165 9.33496 16.8673 9.33496 16.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M10.6299 1.33496C12.0335 1.33496 13.2695 2.25996 13.666 3.60645L13.8809 4.33496H17L17.1338 4.34863C17.4369 4.41057 17.665 4.67858 17.665 5C17.665 5.32142 17.4369 5.58943 17.1338 5.65137L17 5.66504H16.6543L15.8574 14.9912C15.7177 16.629 14.3478 17.8877 12.7041 17.8877H7.2959C5.75502 17.8877 4.45439 16.7815 4.18262 15.2939L4.14258 14.9912L3.34668 5.66504H3C2.63273 5.66504 2.33496 5.36727 2.33496 5C2.33496 4.63273 2.63273 4.33496 3 4.33496H6.11914L6.33398 3.60645L6.41797 3.3584C6.88565 2.14747 8.05427 1.33496 9.37012 1.33496H10.6299ZM5.46777 14.8779L5.49121 15.0537C5.64881 15.9161 6.40256 16.5576 7.2959 16.5576H12.7041C13.6571 16.5576 14.4512 15.8275 14.5322 14.8779L15.3193 5.66504H4.68164L5.46777 14.8779ZM7.66797 12.8271V8.66016C7.66797 8.29299 7.96588 7.99528 8.33301 7.99512C8.70028 7.99512 8.99805 8.29289 8.99805 8.66016V12.8271C8.99779 13.1942 8.70012 13.4912 8.33301 13.4912C7.96604 13.491 7.66823 13.1941 7.66797 12.8271ZM11.002 12.8271V8.66016C11.002 8.29289 11.2997 7.99512 11.667 7.99512C12.0341 7.9953 12.332 8.293 12.332 8.66016V12.8271C12.3318 13.1941 12.0339 13.491 11.667 13.4912C11.2999 13.4912 11.0022 13.1942 11.002 12.8271ZM9.37012 2.66504C8.60726 2.66504 7.92938 3.13589 7.6582 3.83789L7.60938 3.98145L7.50586 4.33496H12.4941L12.3906 3.98145C12.1607 3.20084 11.4437 2.66504 10.6299 2.66504H9.37012Z" />
    </svg>
  );
}

function SettingsCogIcon({ className }: { className?: string }) {
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
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.99944 7.24939C11.5169 7.2495 12.7473 8.47995 12.7475 9.99744C12.7475 11.5151 11.517 12.7454 9.99944 12.7455C8.48176 12.7455 7.2514 11.5151 7.2514 9.99744C7.25155 8.47988 8.48186 7.24939 9.99944 7.24939ZM9.99944 8.57947C9.2164 8.57947 8.58163 9.21442 8.58148 9.99744C8.58148 10.7806 9.2163 11.4154 9.99944 11.4154C10.7825 11.4153 11.4174 10.7805 11.4174 9.99744C11.4173 9.21449 10.7824 8.57958 9.99944 8.57947Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.6391 1.67517C11.2939 1.67532 11.8991 2.02577 12.226 2.59314L13.2485 4.36755H15.2963C15.9505 4.36758 16.555 4.71709 16.8823 5.28357L17.5219 6.39001C17.8489 6.95668 17.8481 7.65542 17.5209 8.22205L16.4975 9.99451L17.5239 11.7689C17.8519 12.3357 17.8521 13.0347 17.5248 13.6019L16.8862 14.7084C16.559 15.2747 15.9543 15.6243 15.3002 15.6244H13.2514L12.2299 17.3988C11.9029 17.9663 11.297 18.3168 10.642 18.3168L9.3637 18.3158C8.71064 18.3155 8.10718 17.9678 7.77972 17.4027L6.74847 15.6234L4.69964 15.6244C4.04558 15.6242 3.44087 15.2747 3.1137 14.7084L2.47503 13.6019C2.14791 13.0349 2.14836 12.3366 2.47601 11.7699L3.50237 9.99548L2.47894 8.22205C2.15175 7.65533 2.15174 6.95673 2.47894 6.39001L3.11761 5.28259C3.44458 4.71663 4.04894 4.36813 4.70257 4.36755L6.75042 4.36658L7.77581 2.59119C8.10301 2.02476 8.7076 1.67527 9.36175 1.67517H10.6391ZM9.36273 3.00623C9.1835 3.00623 9.01679 3.10199 8.92718 3.2572L7.82659 5.16345C7.63652 5.49253 7.28473 5.69529 6.90472 5.69568L4.70355 5.69763C4.52451 5.69782 4.3585 5.79355 4.26898 5.94861L3.6303 7.05505C3.54091 7.2102 3.54077 7.40192 3.6303 7.55701L4.73089 9.46326C4.92108 9.7929 4.92135 10.1992 4.73089 10.5287L3.62737 12.4359C3.5378 12.591 3.53792 12.7817 3.62737 12.9369L4.26605 14.0433C4.35567 14.1982 4.52067 14.2932 4.69964 14.2933L6.90276 14.2943C7.28242 14.2946 7.63335 14.497 7.82366 14.8256L8.93011 16.7357C9.01984 16.8905 9.18578 16.9857 9.36468 16.9857H10.642C10.8213 16.9857 10.987 16.89 11.0766 16.7347L12.1752 14.8275C12.3653 14.4975 12.7182 14.2943 13.0991 14.2943H15.3002C15.4794 14.2942 15.6452 14.1985 15.7348 14.0433L16.3725 12.9379C16.4621 12.7826 16.4621 12.5911 16.3725 12.4359L15.27 10.5287C15.1032 10.2404 15.0808 9.89331 15.2055 9.59021L15.269 9.46326L16.3696 7.55701C16.4591 7.40189 16.459 7.21022 16.3696 7.05505L15.7309 5.94861C15.6412 5.79363 15.4754 5.69863 15.2963 5.69861L13.0951 5.69763L12.9535 5.68884C12.6751 5.65158 12.4217 5.50519 12.2504 5.28259L12.1723 5.16443L11.0737 3.2572C10.9841 3.10175 10.8175 3.00525 10.6381 3.00525L9.36273 3.00623Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LinkExternalIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="21"
      height="21"
      viewBox="0 0 21 21"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.30164 12.197V8.53003C4.30164 7.84109 4.30099 7.28391 4.33777 6.83374C4.3752 6.37598 4.45451 5.9701 4.64636 5.59351L4.76843 5.37573C5.07254 4.8798 5.50895 4.47626 6.03015 4.21069L6.17273 4.14331C6.50897 3.99911 6.86981 3.93484 7.27039 3.9021C7.72063 3.86531 8.27758 3.86499 8.96668 3.86499H9.13367L9.26746 3.87866C9.57036 3.94067 9.79855 4.20883 9.79871 4.53003C9.79871 4.85133 9.5704 5.11932 9.26746 5.1814L9.13367 5.19507H8.96668C8.25564 5.19507 7.7623 5.19596 7.37878 5.22729C7.09678 5.25034 6.90733 5.28812 6.76355 5.3396L6.63367 5.39526C6.33147 5.54924 6.07854 5.7835 5.90222 6.07104L5.83191 6.19702C5.75142 6.35498 5.69465 6.56664 5.66394 6.94214C5.63261 7.3256 5.63171 7.81917 5.63171 8.53003V12.197C5.63171 12.9081 5.63261 13.4014 5.66394 13.7849C5.69464 14.1606 5.7514 14.372 5.83191 14.53L5.90222 14.656C6.07854 14.9436 6.33141 15.1778 6.63367 15.3318L6.76355 15.3884C6.9073 15.4399 7.09693 15.4767 7.37878 15.4998C7.7623 15.5311 8.25564 15.532 8.96668 15.532H12.6337C13.3445 15.532 13.8381 15.5311 14.2216 15.4998C14.5971 15.469 14.8087 15.4123 14.9667 15.3318L15.0927 15.2615C15.3802 15.0852 15.6145 14.8322 15.7684 14.53L15.8241 14.4001C15.8756 14.2564 15.9134 14.0669 15.9364 13.7849C15.9677 13.4014 15.9686 12.9081 15.9686 12.197V12.03C15.9688 11.6629 16.2665 11.365 16.6337 11.365C17.0007 11.3652 17.2985 11.663 17.2987 12.03V12.197C17.2987 12.8861 17.2984 13.4431 17.2616 13.8933C17.2289 14.2939 17.1646 14.6547 17.0204 14.991L16.953 15.1335C16.6874 15.6547 16.2839 16.0912 15.788 16.3953L15.5702 16.5173C15.1936 16.7092 14.7877 16.7885 14.33 16.8259C13.8798 16.8627 13.3226 16.8621 12.6337 16.8621H8.96668C8.27758 16.8621 7.72063 16.8627 7.27039 16.8259C6.86974 16.7932 6.50902 16.728 6.17273 16.5837L6.03015 16.5173C5.50912 16.2519 5.07253 15.848 4.76843 15.3523L4.64636 15.1335C4.45456 14.7569 4.37518 14.3511 4.33777 13.8933C4.30098 13.4431 4.30164 12.8861 4.30164 12.197ZM12.1034 10.0007C11.8437 10.2603 11.4226 10.2604 11.163 10.0007C10.9033 9.74109 10.9034 9.32001 11.163 9.0603L12.1034 10.0007ZM18.1317 7.86401C18.1315 8.23113 17.8338 8.52905 17.4667 8.52905C17.0995 8.52905 16.8018 8.23113 16.8016 7.86401V5.30249L12.1034 10.0007L11.6337 9.53003L11.163 9.0603L15.8602 4.36206H13.2997C12.9326 4.36188 12.6346 4.06418 12.6346 3.69702C12.6346 3.32986 12.9326 3.03216 13.2997 3.03198H17.4667L17.6005 3.04565C17.9036 3.10759 18.1317 3.37559 18.1317 3.69702V7.86401Z"
        fill="currentColor"
      />
    </svg>
  );
}

const EDITOR_INPUT_CLASS =
  "w-full rounded-md border border-token-input-border bg-token-input-background px-2.5 py-1.5 text-base text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus:border-token-focus-border";
