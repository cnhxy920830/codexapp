import type { PluginListSnapshot, PluginSummary } from "../services/plugins";

const MARKETPLACE_PRIORITY = ["openai-bundled", "openai-curated", "local"] as const;

export type PluginCandidate = {
  marketplaceName: string;
  marketplaceLabel: string;
  marketplacePath: string | null;
  plugin: PluginSummary;
};

export function selectInstalledPluginsByName(
  snapshot: PluginListSnapshot | null,
  pluginNames: readonly string[],
) {
  return selectPluginCandidatesByName(snapshot, pluginNames).filter(({ plugin }) => plugin.installed).map(({ plugin }) => plugin);
}

export function selectPluginCandidatesByName(
  snapshot: PluginListSnapshot | null,
  pluginNames: readonly string[],
) {
  if (snapshot == null) {
    return [];
  }

  const selectedByName = new Map<string, PluginCandidate>();

  for (const marketplaceName of MARKETPLACE_PRIORITY) {
    const marketplace = snapshot.marketplaces.find((entry) => entry.name === marketplaceName);
    if (marketplace == null) {
      continue;
    }

    for (const plugin of marketplace.plugins) {
      const matchedName = getPluginNameMatch(plugin, pluginNames);
      if (matchedName == null || selectedByName.has(matchedName)) {
        continue;
      }
      selectedByName.set(matchedName, {
        marketplaceName: marketplace.name,
        marketplaceLabel: marketplace.interface?.displayName ?? marketplace.name,
        marketplacePath: marketplace.path ?? null,
        plugin,
      });
    }
  }

  return pluginNames.flatMap((pluginName) => {
    const plugin = selectedByName.get(pluginName);
    return plugin == null ? [] : [plugin];
  });
}

function getPluginNameMatch(plugin: PluginSummary, pluginNames: readonly string[]) {
  const pluginPrefix = plugin.id.split("@")[0]?.toLowerCase();
  const pluginName = plugin.name.toLowerCase();
  return (
    pluginNames.find((candidate) => candidate.toLowerCase() === pluginName || candidate.toLowerCase() === pluginPrefix) ??
    null
  );
}
