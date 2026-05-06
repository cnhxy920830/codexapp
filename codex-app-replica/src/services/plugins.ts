import { invoke } from "@tauri-apps/api/core";

export type PluginListSnapshot = {
  marketplaces: PluginMarketplaceEntry[];
  marketplaceLoadErrors: MarketplaceLoadErrorInfo[];
  featuredPluginIds: string[];
};

export type PluginMarketplaceEntry = {
  name: string;
  path: string | null;
  interface: MarketplaceInterface | null;
  plugins: PluginSummary[];
};

export type MarketplaceInterface = {
  displayName: string | null;
};

export type MarketplaceLoadErrorInfo = {
  marketplacePath: string;
  message: string;
};

export type PluginSummary = {
  id: string;
  name: string;
  installed: boolean;
  enabled: boolean;
  interface: PluginInterface | null;
};

export type PluginInterface = {
  displayName: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  developerName?: string | null;
  category?: string | null;
  capabilities?: string[] | null;
};

export type PluginReadParams = {
  marketplacePath?: string | null;
  remoteMarketplaceName?: string | null;
  pluginName: string;
};

export type PluginReadResponse = {
  plugin: PluginDetail;
};

export type PluginDetail = {
  marketplaceName: string;
  marketplacePath: string | null;
  summary: PluginSummary;
  description: string | null;
  skills: PluginSkillSummary[];
  apps: PluginAppSummary[];
  mcpServers: string[];
};

export type PluginSkillSummary = {
  name: string;
  description: string;
  shortDescription: string | null;
  enabled: boolean;
};

export type PluginAppSummary = {
  id: string;
  name: string;
  description: string | null;
  installUrl: string | null;
  needsAuth: boolean;
};

export type PluginInstallParams = PluginReadParams;

export type PluginInstallResponse = {
  authPolicy: string;
  appsNeedingAuth: PluginAppSummary[];
};

export type PluginUninstallParams = {
  pluginId: string;
};

export async function readPluginsSnapshot(cwd: string | null): Promise<PluginListSnapshot> {
  return invoke<PluginListSnapshot>("list_plugins", {
    params: {
      cwd,
    },
  });
}

export async function readPlugin(params: PluginReadParams): Promise<PluginReadResponse> {
  return invoke<PluginReadResponse>("read_plugin", {
    params,
  });
}

export async function installPlugin(params: PluginInstallParams): Promise<PluginInstallResponse> {
  return invoke<PluginInstallResponse>("install_plugin", {
    params,
  });
}

export async function uninstallPlugin(params: PluginUninstallParams): Promise<void> {
  return invoke<void>("uninstall_plugin", {
    params,
  });
}
