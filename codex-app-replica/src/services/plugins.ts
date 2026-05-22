import { invoke } from "@tauri-apps/api/core";
import { emitQueryCacheInvalidated } from "./queryCache";
import { batchWriteConfigValueForHost } from "./settings";

const PLUGIN_QUERY_KEY = ["plugins"] as const;

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
  role: PluginSharePrincipalRole | null;
  name: string;
};

export type PluginSharePrincipalType = "user" | "group" | "workspace";

export type PluginSharePrincipalRole = "reader" | "editor" | "owner";

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

export type PluginShareListParams = {
  hostId?: string | null;
};

export type PluginShareListItem = {
  plugin: PluginSummary;
  shareUrl: string;
  localPluginPath: string | null;
};

export type PluginShareListResponse = {
  data: PluginShareListItem[];
};

export type PluginShareSaveParams = {
  hostId?: string | null;
  pluginPath: string;
  remotePluginId?: string | null;
};

export type PluginShareSaveResponse = {
  remotePluginId: string;
  shareUrl: string;
};

export type PluginShareDeleteParams = {
  hostId?: string | null;
  remotePluginId: string;
};

export type PluginShareDeleteResponse = Record<string, never>;

export type ReadPluginSharePrincipalsParams = {
  remotePluginId: string;
};

export type PluginSharePrincipalsResponse = {
  principals: PluginSharePrincipal[];
};

export type PluginShareTarget = {
  principalType: PluginSharePrincipalType;
  principalId: string;
  role: PluginSharePrincipalRole;
};

export type UpdatePluginShareTargetsParams = {
  remotePluginId: string;
  targets: PluginShareTarget[];
};

export type SearchWorkspaceUsersParams = {
  accountId: string;
  query: string;
  limit?: number | null;
  offset?: number | null;
};

export type WorkspaceUserSummary = {
  accountUserId: string;
  email: string | null;
  name: string | null;
};

export type SearchWorkspaceUsersResponse = {
  items: WorkspaceUserSummary[];
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
  await batchWriteConfigValueForHost({
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
  await emitQueryCacheInvalidated([...PLUGIN_QUERY_KEY, hostId ?? null]);
}

export async function listPluginShares(params: PluginShareListParams = {}) {
  return invoke<PluginShareListResponse>("list-plugin-shares", {
    params,
  });
}

export async function savePluginShare(params: PluginShareSaveParams) {
  return invoke<PluginShareSaveResponse>("save-plugin-share", {
    params,
  });
}

export async function deletePluginShare(params: PluginShareDeleteParams) {
  return invoke<PluginShareDeleteResponse>("delete-plugin-share", {
    params,
  });
}

export async function readPluginSharePrincipals(params: ReadPluginSharePrincipalsParams) {
  return invoke<PluginSharePrincipalsResponse>("read-plugin-share-principals", {
    params,
  });
}

export async function updatePluginShareTargets(params: UpdatePluginShareTargetsParams) {
  return invoke<PluginSharePrincipalsResponse>("update-plugin-share-targets", {
    params,
  });
}

export async function searchWorkspaceUsers(params: SearchWorkspaceUsersParams) {
  return invoke<SearchWorkspaceUsersResponse>("search-workspace-users", {
    params,
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
