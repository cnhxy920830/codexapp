import { invoke } from "@tauri-apps/api/core";

export type ExternalAgentImportPluginMigration = {
  marketplaceName: string;
  pluginNames: string[];
};

export type ExternalAgentImportSessionMigration = {
  path: string;
  cwd: string;
  title: string | null;
};

export type ExternalAgentImportMcpServerMigration = {
  name: string;
};

export type ExternalAgentImportHookMigration = {
  name: string;
};

export type ExternalAgentImportSubagentMigration = {
  name: string;
};

export type ExternalAgentImportCommandMigration = {
  name: string;
};

export type ExternalAgentImportMigrationDetails = {
  plugins: ExternalAgentImportPluginMigration[];
  sessions: ExternalAgentImportSessionMigration[];
  mcpServers: ExternalAgentImportMcpServerMigration[];
  hooks: ExternalAgentImportHookMigration[];
  subagents: ExternalAgentImportSubagentMigration[];
  commands: ExternalAgentImportCommandMigration[];
};

export type ExternalAgentImportItem = {
  itemType: string;
  description: string;
  cwd: string | null;
  details: ExternalAgentImportMigrationDetails | null;
  providerId: string | null;
};

export type ExternalAgentImportDetectParams = {
  hostId?: string | null;
  includeHome?: boolean;
  providers?: string[];
  workspaceRoots?: string[] | null;
};

export type ExternalAgentImportDetectResponse = {
  items: ExternalAgentImportItem[];
  unsupportedProjects: string[];
};

export type ExternalAgentImportImportParams = {
  hostId?: string | null;
  items: ExternalAgentImportItem[];
};

export type ExternalAgentImportImportResponse = {
  projectRoots: string[];
};

export type ExternalAgentImportStatusParams = {
  hostId?: string | null;
  providers?: string[] | null;
};

export type ExternalAgentImportStatusResponse = {
  importedSessionCount: number;
  latestImportedAtMs: number | null;
};

export async function detectExternalAgentImports(
  params: ExternalAgentImportDetectParams,
): Promise<ExternalAgentImportDetectResponse> {
  return invoke<ExternalAgentImportDetectResponse>("external-agent-import-detect", {
    params,
  });
}

export async function importExternalAgentItems(
  params: ExternalAgentImportImportParams,
): Promise<ExternalAgentImportImportResponse> {
  return invoke<ExternalAgentImportImportResponse>("external-agent-import-import", {
    params,
  });
}

export async function readExternalAgentImportStatus(
  params: ExternalAgentImportStatusParams = {},
): Promise<ExternalAgentImportStatusResponse> {
  return invoke<ExternalAgentImportStatusResponse>("external-agent-import-status", {
    params,
  });
}
