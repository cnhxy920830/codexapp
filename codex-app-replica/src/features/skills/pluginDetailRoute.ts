import type { PluginCandidate } from "../../lib/pluginSelectors";

export type PluginDetailRouteSource = "manage";

export type PluginDetailRouteQuery = {
  hostId: string | null;
  marketplacePath: string | null;
  pluginName: string | null;
  remoteMarketplaceName: string | null;
  source: PluginDetailRouteSource | null;
};

export type PluginDetailRouteDirectSelection = {
  directMarketplacePath: string | null;
  directPluginName: string | null;
  directRemoteMarketplaceName: string | null;
};

const PLUGIN_DETAIL_ROUTE_PREFIX = "/skills/plugins/";
const DEFAULT_REMOTE_MARKETPLACE_NAME = "chatgpt-workspace";

export function buildPluginDetailRoutePath(
  candidate: PluginCandidate,
  options?: {
    hostId?: string | null;
    source?: PluginDetailRouteSource | null;
  },
) {
  const pluginId = encodeURIComponent(candidate.plugin.id);
  const searchParams = new URLSearchParams();

  if (candidate.marketplacePath != null) {
    searchParams.set("marketplacePath", candidate.marketplacePath);
  } else {
    searchParams.set("remoteMarketplaceName", candidate.marketplaceName);
  }
  searchParams.set("pluginName", candidate.plugin.name);

  const hostId = options?.hostId?.trim();
  if (hostId) {
    searchParams.set("hostId", hostId);
  }

  if (options?.source === "manage") {
    searchParams.set("source", "manage");
  }

  const search = searchParams.toString();
  return search.length > 0
    ? `${PLUGIN_DETAIL_ROUTE_PREFIX}${pluginId}?${search}`
    : `${PLUGIN_DETAIL_ROUTE_PREFIX}${pluginId}`;
}

export function isPluginDetailRoute(path: string) {
  return parsePluginDetailRoute(path) != null;
}

export function parsePluginDetailRoute(path: string) {
  const normalizedPath = stripRouteSearchAndHash(path);
  const match = /^\/skills\/plugins\/([^/?#]+)$/.exec(normalizedPath);
  if (match == null) {
    return null;
  }

  const pluginId = decodeRouteSegment(match[1]);
  if (pluginId == null || pluginId.length === 0) {
    return null;
  }

  return {
    pluginId,
  };
}

export function parsePluginDetailRouteQuery(search: string): PluginDetailRouteQuery | null {
  const searchParams = new URLSearchParams(search);
  const marketplacePath = searchParams.get("marketplacePath")?.trim() || null;
  const remoteMarketplaceName = searchParams.get("remoteMarketplaceName")?.trim() || null;
  const pluginName = searchParams.get("pluginName")?.trim() || null;
  const hostId = searchParams.get("hostId")?.trim() || null;
  const sourceValue = searchParams.get("source")?.trim() || null;
  const hasDirectMarketplaceSelection = marketplacePath != null || remoteMarketplaceName != null;

  if (marketplacePath != null && remoteMarketplaceName != null) {
    return null;
  }

  if (hasDirectMarketplaceSelection && pluginName == null) {
    return null;
  }

  if (!hasDirectMarketplaceSelection && pluginName != null) {
    return null;
  }

  return {
    hostId,
    marketplacePath,
    pluginName,
    remoteMarketplaceName,
    source: sourceValue === "manage" ? "manage" : null,
  };
}

export function resolvePluginDetailDirectSelection({
  explicitMarketplacePath,
  explicitPluginName,
  explicitRemoteMarketplaceName,
  requestedPluginId,
  routeQuery,
}: {
  explicitMarketplacePath?: string | null;
  explicitPluginName?: string | null;
  explicitRemoteMarketplaceName?: string | null;
  requestedPluginId: string | null;
  routeQuery: PluginDetailRouteQuery | null;
}): PluginDetailRouteDirectSelection {
  const normalizedPluginId =
    requestedPluginId != null && requestedPluginId.trim().length > 0 ? requestedPluginId : null;
  const hasExplicitMarketplaceSelection =
    explicitMarketplacePath != null || explicitRemoteMarketplaceName != null;

  return {
    directMarketplacePath: hasExplicitMarketplaceSelection
      ? explicitMarketplacePath ?? null
      : routeQuery?.marketplacePath ?? null,
    directPluginName:
      explicitPluginName ?? routeQuery?.pluginName ?? normalizedPluginId,
    directRemoteMarketplaceName: hasExplicitMarketplaceSelection
      ? explicitRemoteMarketplaceName ?? null
      : routeQuery?.remoteMarketplaceName ??
        (normalizedPluginId == null ? null : DEFAULT_REMOTE_MARKETPLACE_NAME),
  };
}

function stripRouteSearchAndHash(path: string) {
  const searchIndex = path.indexOf("?");
  const hashIndex = path.indexOf("#");
  const cutoffIndex =
    searchIndex === -1
      ? hashIndex
      : hashIndex === -1
        ? searchIndex
        : Math.min(searchIndex, hashIndex);
  return cutoffIndex === -1 ? path : path.slice(0, cutoffIndex);
}

function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
