import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { batchWriteConfigValueForHost, type ConfigSnapshot } from "./settings";

export type McpServerStatusEntry = {
  name: string;
  authStatus: string | null;
};

export type McpServerStatusListResponse = {
  data: McpServerStatusEntry[];
  nextCursor: string | null;
};

export type McpOauthLoginCompletedNotification = {
  name: string;
  success: boolean;
  error: string | null;
};

export type CodexAppServerInitializedNotification = {
  hostId: string;
};

export type McpTransportType = "stdio" | "streamable_http";

export type McpServerDraft = {
  label: string;
  transportType: McpTransportType;
  base: {
    enabled: boolean;
    startupTimeoutSec: number | null;
    startupTimeoutMs: number | null;
    toolTimeoutSec: number | null;
    enabledTools: string[];
    disabledTools: string[];
  };
  stdio: {
    command: string;
    args: string[];
    env: Array<{ key: string; value: string }>;
    envVars: string[];
    cwd: string;
  };
  http: {
    url: string;
    bearerTokenEnvVar: string;
    httpHeaders: Array<{ key: string; value: string }>;
    envHttpHeaders: Array<{ key: string; value: string }>;
  };
};

export type McpServerWriteTarget = {
  filePath: string | null;
  expectedVersion: string | null;
};

export type McpServerSetEnabledParams = {
  enabled: boolean;
  expectedVersion?: string | null;
  filePath?: string | null;
  hostId?: string | null;
  serverName: string;
};

export async function listMcpServerStatuses(hostId?: string | null) {
  return invoke<McpServerStatusListResponse>("list_mcp_server_status", {
    params: { hostId: normalizeHostId(hostId), cursor: null, detail: "full", limit: 100 },
  });
}

export async function loginMcpServer(params: { hostId?: string | null; name: string }) {
  return invoke<{ authorizationUrl: string }>("login_mcp_server", {
    params: {
      hostId: normalizeHostId(params.hostId),
      name: params.name,
    },
  });
}

export async function reloadMcpServerConfig() {
  return invoke<void>("reload_mcp_server_config");
}

export async function restartCodexAppServer(hostId: string) {
  return invoke<void>("codex-app-server-restart", { params: { hostId } });
}

export async function setMcpServerEnabled(params: McpServerSetEnabledParams) {
  const { enabled, expectedVersion, filePath, hostId, serverName } = params;
  return batchWriteConfigValueForHost({
    hostId,
    edits: [
      {
        keyPath: `mcp_servers.${serverName}.enabled`,
        value: enabled,
        mergeStrategy: "upsert",
      },
    ],
    filePath: filePath ?? null,
    expectedVersion: expectedVersion ?? null,
    reloadUserConfig: true,
  });
}

export function onMcpOauthLoginCompleted(handler: (notification: McpOauthLoginCompletedNotification) => void) {
  return listen<McpOauthLoginCompletedNotification>("mcp-oauth-login-completed", (event) => {
    handler(event.payload);
  });
}

export function onCodexAppServerInitialized(
  handler: (notification: CodexAppServerInitializedNotification) => void,
) {
  return listen<CodexAppServerInitializedNotification>("codex-app-server-initialized", (event) => {
    handler(event.payload);
  });
}

export function parseMcpServers(config: ConfigSnapshot | null) {
  const rawServers = config?.mcpServers;
  if (!rawServers || typeof rawServers !== "object") {
    return [];
  }

  return Object.entries(rawServers)
    .map(([name, raw]) => {
      const server = normalizeMcpServerDraft(raw, name);
      if (!server) {
        return null;
      }
      return { name, server };
    })
    .filter((entry): entry is { name: string; server: McpServerDraft } => entry !== null);
}

export function createBlankMcpServerDraft() {
  return normalizeMcpServerDraft(null, "");
}

export function normalizeMcpServerDraft(raw: unknown, fallbackLabel: string): McpServerDraft {
  const config = isPlainObject(raw) ? raw : {};
  const base = isPlainObject(config.base) ? config.base : config;
  const command = typeof config.command === "string" ? config.command : "";
  const url = typeof config.url === "string" ? config.url : "";
  const transportType: McpTransportType = "url" in config ? "streamable_http" : "stdio";
  const args = readStringArray(config.args);
  const env = readRecordArray(config.env);
  const envVars = readStringArray(config.env_vars);
  const httpHeaders = readRecordArray(config.http_headers);
  const envHttpHeaders = readRecordArray(config.env_http_headers);

  return {
    label: readString(config.name, fallbackLabel),
    transportType,
    base: {
      enabled: readBoolean(base.enabled, true),
      startupTimeoutSec: readOptionalNumber(base.startup_timeout_sec),
      startupTimeoutMs: readOptionalNumber(base.startup_timeout_ms),
      toolTimeoutSec: readOptionalNumber(base.tool_timeout_sec),
      enabledTools: readStringArray(base.enabled_tools),
      disabledTools: readStringArray(base.disabled_tools),
    },
    stdio: {
      command,
      args,
      env,
      envVars,
      cwd: readString(config.cwd, ""),
    },
    http: {
      url,
      bearerTokenEnvVar: readString(config.bearer_token_env_var, ""),
      httpHeaders,
      envHttpHeaders,
    },
  };
}

export function serializeMcpServerDraft(server: McpServerDraft) {
  const base = {
    enabled: server.base.enabled,
    startup_timeout_sec: server.base.startupTimeoutSec ?? undefined,
    startup_timeout_ms: server.base.startupTimeoutMs ?? undefined,
    tool_timeout_sec: server.base.toolTimeoutSec ?? undefined,
    enabled_tools: server.base.enabledTools.length > 0 ? server.base.enabledTools : undefined,
    disabled_tools: server.base.disabledTools.length > 0 ? server.base.disabledTools : undefined,
  };

  if (server.transportType === "streamable_http") {
    return {
      ...base,
      url: server.http.url.trim(),
      bearer_token_env_var: server.http.bearerTokenEnvVar.trim() || undefined,
      http_headers: serializeRecordArray(server.http.httpHeaders),
      env_http_headers: serializeRecordArray(server.http.envHttpHeaders),
    };
  }

  return {
    ...base,
    command: server.stdio.command.trim(),
    args: server.stdio.args.map((value) => value.trim()).filter(Boolean),
    env: serializeRecordArray(server.stdio.env),
    env_vars: server.stdio.envVars.map((value) => value.trim()).filter(Boolean),
    cwd: server.stdio.cwd.trim() || undefined,
  };
}

export function sanitizeMcpServerKey(label: string, existingKeys: string[], initialKey: string | null = null) {
  const trimmed = label.trim().replace(/\s+/gu, "_").replace(/[^a-zA-Z0-9-_]+/gu, "-").replace(/-+/gu, "-");
  const baseKey = trimmed.length > 0 ? trimmed.toLowerCase() : "custom-server";
  const filtered = existingKeys.filter((key) => initialKey == null || key !== initialKey);
  if (!filtered.includes(baseKey)) {
    return baseKey;
  }

  let suffix = 2;
  let nextKey = `${baseKey}-${suffix}`;
  while (filtered.includes(nextKey)) {
    suffix += 1;
    nextKey = `${baseKey}-${suffix}`;
  }
  return nextKey;
}

export function buildMcpServerWriteTarget(config: ConfigSnapshot | null): McpServerWriteTarget | null {
  if (!config) {
    return null;
  }
  return {
    filePath: null,
    expectedVersion: null,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function readRecordArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (!isPlainObject(entry)) {
        return null;
      }
      return {
        key: readString(entry.key, ""),
        value: readString(entry.value, ""),
      };
    })
    .filter((entry): entry is { key: string; value: string } => entry !== null);
}

function serializeRecordArray(values: Array<{ key: string; value: string }>) {
  const output: Record<string, string> = {};
  for (const entry of values) {
    const key = entry.key.trim();
    const value = entry.value.trim();
    if (!key || !value) {
      continue;
    }
    output[key] = value;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeHostId(hostId?: string | null) {
  const trimmed = hostId?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}
