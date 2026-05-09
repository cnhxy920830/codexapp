import { invoke } from "@tauri-apps/api/core";
import { batchWriteConfigValueForHost } from "./settings";

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
  shareContext: PluginShareContext | null;
  source: PluginSource;
  installed: boolean;
  enabled: boolean;
  installPolicy: PluginInstallPolicy;
  authPolicy: PluginAuthPolicy;
  availability: PluginAvailability;
  interface: PluginInterface | null;
  keywords: string[];
};

export type PluginSource =
  | {
      type: "local";
      path: string;
    }
  | {
      type: "git";
      url: string;
      path: string | null;
      refName: string | null;
      sha: string | null;
    }
  | {
      type: "remote";
    };

export type PluginShareContext = {
  remotePluginId: string;
  shareUrl: string | null;
  creatorAccountUserId: string | null;
  creatorName: string | null;
  shareTargets: PluginSharePrincipal[] | null;
};

export type PluginSharePrincipal = {
  principalType: PluginSharePrincipalType;
  principalId: string;
  name: string;
};

export type PluginSharePrincipalType = "user" | "group" | "workspace";

export type PluginInstallPolicy = "NOT_AVAILABLE" | "AVAILABLE" | "INSTALLED_BY_DEFAULT";

export type PluginAuthPolicy = "ON_INSTALL" | "ON_USE";

export type PluginAvailability = "AVAILABLE" | "DISABLED_BY_ADMIN";

export type PluginInterface = {
  displayName: string | null;
  shortDescription: string | null;
  longDescription: string | null;
  developerName: string | null;
  category: string | null;
  capabilities: string[];
  websiteUrl: string | null;
  privacyPolicyUrl: string | null;
  termsOfServiceUrl: string | null;
  defaultPrompt: string[] | null;
  brandColor: string | null;
  composerIcon: string | null;
  composerIconUrl: string | null;
  logo: string | null;
  logoUrl: string | null;
  screenshots: string[];
  screenshotUrls: string[];
};

export type PluginReadParams = {
  hostId?: string | null;
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
  hooks: PluginHookSummary[];
  apps: PluginAppSummary[];
  mcpServers: string[];
};

export type PluginSkillInterface = {
  displayName: string | null;
  shortDescription: string | null;
  iconSmall: string | null;
  iconLarge: string | null;
  brandColor: string | null;
  defaultPrompt: string | null;
};

export type PluginSkillSummary = {
  name: string;
  description: string;
  shortDescription: string | null;
  interface: PluginSkillInterface | null;
  path: string | null;
  enabled: boolean;
};

export type PluginHookSummary = {
  key: string;
  eventName: string;
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
  authPolicy: PluginAuthPolicy;
  appsNeedingAuth: PluginAppSummary[];
};

export type PluginUninstallParams = {
  hostId?: string | null;
  pluginId: string;
};

export type PluginSetEnabledParams = {
  hostId?: string | null;
  pluginId: string;
  enabled: boolean;
  filePath?: string | null;
  expectedVersion?: string | null;
};

export type MarketplaceAddParams = {
  hostId?: string | null;
  source: string;
  refName?: string | null;
  sparsePaths?: string[] | null;
};

export type MarketplaceAddResponse = {
  marketplaceName: string;
  installedRoot: string;
  alreadyAdded: boolean;
};

export type MarketplaceRemoveParams = {
  hostId?: string | null;
  marketplaceName: string;
};

export type MarketplaceRemoveResponse = {
  marketplaceName: string;
  installedRoot: string | null;
};

export type MarketplaceUpgradeParams = {
  hostId?: string | null;
  marketplaceName?: string | null;
};

export type MarketplaceUpgradeErrorInfo = {
  marketplaceName: string;
  message: string;
};

export type MarketplaceUpgradeResponse = {
  selectedMarketplaces: string[];
  upgradedRoots: string[];
  errors: MarketplaceUpgradeErrorInfo[];
};

export async function readPluginsSnapshot(cwd: string | null, hostId?: string | null): Promise<PluginListSnapshot> {
  return invoke<PluginListSnapshot>("list-plugins", {
    params: {
      cwds: cwd ? [cwd] : [],
      hostId,
    },
  });
}

export async function readPlugin(params: PluginReadParams): Promise<PluginReadResponse> {
  return invoke<PluginReadResponse>("read-plugin", {
    params,
  });
}

export async function installPlugin(params: PluginInstallParams): Promise<PluginInstallResponse> {
  return invoke<PluginInstallResponse>("install-plugin", {
    params,
  });
}

export async function uninstallPlugin(params: PluginUninstallParams): Promise<void> {
  return invoke<void>("uninstall-plugin", {
    params,
  });
}

export async function setPluginEnabled(params: PluginSetEnabledParams): Promise<void> {
  const { enabled, expectedVersion, filePath, hostId, pluginId } = params;
  return batchWriteConfigValueForHost({
    hostId,
    edits: [
      {
        keyPath: `plugins.${pluginId}.enabled`,
        value: enabled,
        mergeStrategy: "upsert",
      },
    ],
    filePath: filePath ?? null,
    expectedVersion: expectedVersion ?? null,
    reloadUserConfig: true,
  });
}

export async function addMarketplace(params: MarketplaceAddParams): Promise<MarketplaceAddResponse> {
  return invoke<MarketplaceAddResponse>("add-marketplace", {
    params,
  });
}

export async function removeMarketplace(params: MarketplaceRemoveParams): Promise<MarketplaceRemoveResponse> {
  return invoke<MarketplaceRemoveResponse>("remove-marketplace", {
    params,
  });
}

export async function upgradeMarketplaces(params: MarketplaceUpgradeParams): Promise<MarketplaceUpgradeResponse> {
  return invoke<MarketplaceUpgradeResponse>("upgrade-marketplaces", {
    params,
  });
}
