import type { AppInfo } from "../services/apps";
import type { PluginListSnapshot, PluginSummary } from "../services/plugins";

const MARKETPLACE_PRIORITY = ["openai-bundled", "openai-curated", "local"] as const;
const HERO_PLUGIN_SLUGS = [
  "computer-use",
  "gmail",
  "slack",
  "google-calendar",
  "google-drive",
  "linear",
] as const;
const HERO_FALLBACK_LIMIT = HERO_PLUGIN_SLUGS.length;
const MARKETPLACE_JSON_PATH_SUFFIX = "/marketplace.json";
const AGENTS_MARKETPLACE_PATH_SUFFIX = "/.agents/plugins/marketplace.json";

type HeroPluginSlug = (typeof HERO_PLUGIN_SLUGS)[number];
type MarketplaceMergeOptions = {
  mergeOpenAIBundledMarketplace?: boolean;
};

type PluginSection = {
  section: {
    id: string;
    title: string;
  };
  plugins: PluginCandidate[];
};

export type PluginCandidate = {
  marketplaceName: string;
  marketplaceLabel: string;
  marketplacePath: string | null;
  plugin: PluginSummary;
};

export type ImportedPluginCandidate = {
  importedApp: AppInfo;
  marketplaceName: string;
  marketplaceLabel: string;
  marketplacePath: string | null;
  plugin: PluginSummary;
};

export type PluginMarketplaceFilterOption = {
  label: string;
  subLabel: string | null;
  value: string;
};

export type PluginBrowseSection = PluginSection;

export function listPluginCandidates(snapshot: PluginListSnapshot | null): PluginCandidate[] {
  if (snapshot == null) {
    return [];
  }

  return getOrderedMarketplaces(snapshot).flatMap((marketplace) =>
    marketplace.plugins.map((plugin) => ({
      marketplaceName: marketplace.name,
      marketplaceLabel: marketplace.interface?.displayName ?? marketplace.name,
      marketplacePath: marketplace.path ?? null,
      plugin,
    })),
  );
}

export function selectInstalledPluginsByName(
  snapshot: PluginListSnapshot | null,
  pluginNames: readonly string[],
) {
  return selectPluginCandidatesByName(snapshot, pluginNames)
    .filter(({ plugin }) => plugin.installed)
    .map(({ plugin }) => plugin);
}

export function selectPluginCandidatesByName(
  snapshot: PluginListSnapshot | null,
  pluginNames: readonly string[],
) {
  if (snapshot == null) {
    return [];
  }

  const selectedByName = new Map<string, PluginCandidate>();
  const orderedMarketplaces = getOrderedMarketplaces(snapshot);

  for (const marketplace of orderedMarketplaces) {
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

export function getPluginCandidateDisplayName(candidate: PluginCandidate) {
  return candidate.plugin.interface?.displayName ?? candidate.plugin.name;
}

export function getPluginCandidateDescription(candidate: PluginCandidate) {
  return (
    candidate.plugin.interface?.longDescription ??
    candidate.plugin.interface?.shortDescription ??
    candidate.plugin.name
  );
}

export function getPluginCandidateDefaultPrompt(candidate: PluginCandidate) {
  return getFirstNonEmptyLine(candidate.plugin.interface?.defaultPrompt ?? null);
}

export function buildPluginTryInChatPrompt(candidate: PluginCandidate) {
  const pluginDisplayName = getPluginCandidateDisplayName(candidate);
  const defaultPrompt = getPluginCandidateDefaultPrompt(candidate);
  return `[@${pluginDisplayName}](plugin://${candidate.plugin.id})${defaultPrompt ? ` ${defaultPrompt}` : ""}`;
}

export function getPluginHeroSlug(candidate: PluginCandidate): HeroPluginSlug | null {
  const labels = new Set(
    [
      getPluginCandidateDisplayName(candidate),
      candidate.plugin.id,
      candidate.plugin.name,
    ]
      .map(normalizeHeroMatchKey)
      .filter((value) => value.length > 0),
  );

  return (
    HERO_PLUGIN_SLUGS.find((slug) =>
      getHeroPluginAliases(slug).some((alias) => labels.has(alias)),
    ) ?? null
  );
}

export function buildMarketplaceFilterOptions(
  candidates: readonly PluginCandidate[],
  options: MarketplaceMergeOptions = {},
): PluginMarketplaceFilterOption[] {
  const mergeMap = buildMarketplaceMergeMap(candidates, options);
  const optionsByValue = new Map<
    string,
    { label: string; subLabelSource: string }
  >();

  for (const candidate of candidates) {
    const mergedValue =
      mergeMap.get(normalizeMarketplaceKey(candidate.marketplaceName)) ??
      normalizeMarketplaceKey(candidate.marketplaceName);
    if (mergedValue.length === 0 || optionsByValue.has(mergedValue)) {
      continue;
    }

    const label = getMarketplaceOptionLabel(candidate.marketplaceLabel);
    if (label.trim().length === 0) {
      continue;
    }

    optionsByValue.set(mergedValue, {
      label,
      subLabelSource:
        candidate.marketplacePath == null
          ? candidate.marketplaceName
          : trimMarketplacePath(candidate.marketplacePath),
    });
  }

  const groupedByLabel = new Map<string, Array<{ value: string; subLabelSource: string }>>();
  for (const [value, option] of optionsByValue) {
    const entries = groupedByLabel.get(option.label) ?? [];
    entries.push({ value, subLabelSource: option.subLabelSource });
    groupedByLabel.set(option.label, entries);
  }

  const disambiguatedSubLabels = new Map<string, string>();
  for (const [label, entries] of groupedByLabel) {
    if (entries.length <= 1) {
      continue;
    }
    const labels = buildDisambiguatedSubLabels(entries.map((entry) => entry.subLabelSource));
    entries.forEach((entry, index) => {
      disambiguatedSubLabels.set(`${label}:${entry.value}`, labels[index] ?? entry.subLabelSource);
    });
  }

  return Array.from(optionsByValue.entries())
    .map(([value, option]) => ({
      label: option.label,
      subLabel: disambiguatedSubLabels.get(`${option.label}:${value}`) ?? null,
      value,
    }))
    .sort(compareMarketplaceFilterOptions);
}

export function filterBrowsePluginCandidates<T extends PluginCandidate>({
  candidates,
  marketplaceFilterValue,
  options,
  query,
}: {
  candidates: readonly T[];
  marketplaceFilterValue: string | null;
  options?: MarketplaceMergeOptions;
  query: string;
}) {
  const mergeMap = buildMarketplaceMergeMap(candidates, options);
  const normalizedQuery = query.trim().toLowerCase();

  return candidates.filter((candidate) => {
    const mergedMarketplaceValue =
      mergeMap.get(normalizeMarketplaceKey(candidate.marketplaceName)) ??
      normalizeMarketplaceKey(candidate.marketplaceName);
    if (marketplaceFilterValue != null && mergedMarketplaceValue !== marketplaceFilterValue) {
      return false;
    }

    if (normalizedQuery.length === 0) {
      return true;
    }

    return buildPluginSearchText(candidate).includes(normalizedQuery);
  });
}

export function selectInstalledEnabledPluginCandidates(candidates: readonly PluginCandidate[]) {
  return candidates.filter(({ plugin }) => plugin.installed && plugin.enabled);
}

export function selectHeroPlugins(
  candidates: readonly PluginCandidate[],
  featuredPluginIds: readonly string[] = [],
) {
  const candidatesByAlias = new Map<string, PluginCandidate>();
  for (const candidate of candidates) {
    const matchKeys = [
      getPluginCandidateDisplayName(candidate),
      candidate.plugin.id,
      candidate.plugin.name,
    ]
      .map(normalizeHeroMatchKey)
      .filter((value) => value.length > 0);
    for (const key of matchKeys) {
      if (!candidatesByAlias.has(key)) {
        candidatesByAlias.set(key, candidate);
      }
    }
  }

  const selectedHeroPlugins: PluginCandidate[] = [];
  const seenPluginIds = new Set<string>();
  for (const heroSlug of HERO_PLUGIN_SLUGS) {
    const match = getHeroPluginAliases(heroSlug)
      .map((alias) => candidatesByAlias.get(alias) ?? null)
      .find((candidate) => candidate != null);
    if (match == null || seenPluginIds.has(match.plugin.id)) {
      continue;
    }
    seenPluginIds.add(match.plugin.id);
    selectedHeroPlugins.push(match);
  }

  if (selectedHeroPlugins.length > 0) {
    return selectedHeroPlugins;
  }

  const featuredPlugins = selectPluginCandidatesByIds(candidates, featuredPluginIds);
  if (featuredPlugins.length > 0) {
    return featuredPlugins.slice(0, HERO_FALLBACK_LIMIT);
  }

  return candidates.slice(0, HERO_FALLBACK_LIMIT);
}

export function groupPluginBrowseSections(
  candidates: readonly PluginCandidate[],
  featuredPluginIds: readonly string[] = [],
): PluginBrowseSection[] {
  const featuredPlugins = selectPluginCandidatesByIds(candidates, featuredPluginIds);
  const featuredPluginIdsSet = new Set(featuredPlugins.map(({ plugin }) => plugin.id));
  const sectionsByTitle = new Map<string, PluginCandidate[]>();

  for (const candidate of candidates) {
    if (featuredPluginIdsSet.has(candidate.plugin.id)) {
      continue;
    }

    const title = candidate.plugin.interface?.category?.trim() || "Other";
    const section = sectionsByTitle.get(title) ?? [];
    section.push(candidate);
    sectionsByTitle.set(title, section);
  }

  const groupedSections = Array.from(sectionsByTitle.entries())
    .sort(([leftTitle], [rightTitle]) => leftTitle.localeCompare(rightTitle))
    .map(([title, plugins]) => ({
      section: {
        id: `plugins-${normalizeSectionId(title)}`,
        title,
      },
      plugins,
    }));

  if (featuredPlugins.length === 0) {
    return groupedSections;
  }

  return [
    {
      section: {
        id: "plugins-featured",
        title: "Featured",
      },
      plugins: featuredPlugins,
    },
    ...groupedSections,
  ];
}

export function selectImportedPluginCandidates({
  apps,
  importedPluginNames,
  snapshot,
}: {
  apps: readonly AppInfo[];
  importedPluginNames: readonly string[];
  snapshot: PluginListSnapshot | null;
}) {
  const pluginCandidates = selectPluginCandidatesByName(snapshot, importedPluginNames);
  const matchedApps = selectImportedAppsByPluginNames(apps, importedPluginNames);
  const usedPluginIds = new Set<string>();

  return matchedApps.flatMap((app) => {
    const matchingCandidate = findPluginCandidateForImportedApp(app, pluginCandidates);
    if (matchingCandidate == null || usedPluginIds.has(matchingCandidate.plugin.id)) {
      return [];
    }

    usedPluginIds.add(matchingCandidate.plugin.id);
    return [
      {
        importedApp: app,
        marketplaceName: matchingCandidate.marketplaceName,
        marketplaceLabel: matchingCandidate.marketplaceLabel,
        marketplacePath: matchingCandidate.marketplacePath,
        plugin: {
          ...matchingCandidate.plugin,
          installed: app.isAccessible,
          enabled: app.isEnabled,
        },
      },
    ];
  });
}

function selectImportedAppsByPluginNames(apps: readonly AppInfo[], pluginNames: readonly string[]) {
  const importedNameSet = new Set(
    pluginNames.map(normalizeImportedConnectorName).filter((value) => value.length > 0),
  );

  return apps.filter((app) =>
    [app.name, ...app.pluginDisplayNames].some((name) =>
      importedNameSet.has(normalizeImportedConnectorName(name)),
    ),
  );
}

function findPluginCandidateForImportedApp(
  app: AppInfo,
  pluginCandidates: readonly PluginCandidate[],
) {
  const appNameSet = new Set(
    [app.name, ...app.pluginDisplayNames]
      .map(normalizeImportedConnectorName)
      .filter((value) => value.length > 0),
  );

  return (
    pluginCandidates.find((candidate) =>
      [
        candidate.plugin.name,
        getPluginCandidateDisplayName(candidate),
        candidate.plugin.interface?.displayName ?? "",
      ].some((value) => appNameSet.has(normalizeImportedConnectorName(value))),
    ) ?? null
  );
}

function buildMarketplaceMergeMap(
  candidates: readonly PluginCandidate[],
  options: MarketplaceMergeOptions = {},
) {
  if (options.mergeOpenAIBundledMarketplace === false) {
    return new Map<string, string>();
  }

  const marketplacesByKey = new Map<string, Set<string>>();
  const bundledMarketplaceKeys = new Set<string>();

  for (const candidate of candidates) {
    const normalizedMarketplace = normalizeMarketplaceKey(candidate.marketplaceName);
    if (normalizedMarketplace.length === 0) {
      continue;
    }

    if (normalizeMarketplaceLabel(candidate.marketplaceName) === "openai bundled") {
      bundledMarketplaceKeys.add(normalizedMarketplace);
    }

    const marketplaceVariants = marketplacesByKey.get(normalizedMarketplace) ?? new Set<string>();
    marketplaceVariants.add(normalizedMarketplace);
    marketplacesByKey.set(normalizedMarketplace, marketplaceVariants);
  }

  const mergeMap = new Map<string, string>();
  const mergeRules = [
    {
      sourceMarketplaceName: "openai-bundled",
      targetMarketplaceName: "openai-curated",
    },
    {
      sourceMarketplaceName: "openai-primary-runtime",
      targetMarketplaceName: "openai-curated",
    },
  ];

  for (const rule of mergeRules) {
    const sourceKey = normalizeMarketplaceKey(rule.sourceMarketplaceName);
    const targetKey = normalizeMarketplaceKey(rule.targetMarketplaceName);
    const targetEntries = marketplacesByKey.get(targetKey);
    if (targetEntries == null || targetEntries.size !== 1) {
      continue;
    }

    const sourceEntries =
      rule.sourceMarketplaceName === "openai-bundled"
        ? bundledMarketplaceKeys
        : marketplacesByKey.get(sourceKey);
    if (sourceEntries == null) {
      continue;
    }

    const [targetEntry] = targetEntries;
    for (const sourceEntry of sourceEntries) {
      if (sourceEntry !== targetEntry) {
        mergeMap.set(sourceEntry, targetEntry);
      }
    }
  }

  return mergeMap;
}

function compareMarketplaceFilterOptions(
  left: PluginMarketplaceFilterOption,
  right: PluginMarketplaceFilterOption,
) {
  const rankDifference =
    getMarketplaceFilterOptionRank(left.label) - getMarketplaceFilterOptionRank(right.label);
  if (rankDifference !== 0) {
    return rankDifference;
  }

  return (
    left.label.localeCompare(right.label) ||
    (left.subLabel ?? "").localeCompare(right.subLabel ?? "")
  );
}

function getMarketplaceFilterOptionRank(label: string) {
  switch (normalizeMarketplaceLabel(label)) {
    case "built by openai":
      return 0;
    case "chatgpt official":
      return 1;
    default:
      return 2;
  }
}

function getMarketplaceOptionLabel(label: string) {
  return isOfficialMarketplaceLabel(label) ? "Built by OpenAI" : label;
}

function isOfficialMarketplaceLabel(label: string) {
  switch (normalizeMarketplaceLabel(label)) {
    case "codex official":
    case "openai curated":
    case "openai primary runtime":
    case "built by openai":
      return true;
    default:
      return normalizeMarketplaceKey(label).startsWith("openai-");
  }
}

function buildDisambiguatedSubLabels(paths: string[]) {
  const pathSegments = paths.map((path) =>
    normalizePathForComparison(path)
      .split("/")
      .filter((segment) => segment.length > 0),
  );
  const maxSegmentLength = Math.max(1, ...pathSegments.map((segments) => segments.length));

  for (let segmentCount = 1; segmentCount <= maxSegmentLength; segmentCount += 1) {
    const labels = pathSegments.map((segments) =>
      buildTrailingPathLabel(segments, segmentCount),
    );
    if (new Set(labels).size === labels.length) {
      return labels;
    }
  }

  return paths.map(normalizePathForComparison);
}

function buildTrailingPathLabel(segments: string[], segmentCount: number) {
  const trailingPath = segments.slice(-segmentCount).join("/");
  if (trailingPath.length === 0) {
    return "";
  }
  return segmentCount === 1
    ? trailingPath
    : segments.length > segmentCount
      ? `.../${trailingPath}`
      : trailingPath;
}

function trimMarketplacePath(path: string) {
  const normalizedPath = normalizePathForComparison(path);
  if (normalizedPath.endsWith(AGENTS_MARKETPLACE_PATH_SUFFIX)) {
    return normalizedPath.slice(0, -AGENTS_MARKETPLACE_PATH_SUFFIX.length);
  }
  if (normalizedPath.endsWith(MARKETPLACE_JSON_PATH_SUFFIX)) {
    return normalizedPath.slice(0, -MARKETPLACE_JSON_PATH_SUFFIX.length);
  }
  return normalizedPath;
}

function buildPluginSearchText(candidate: PluginCandidate) {
  return [
    candidate.marketplaceName,
    candidate.marketplaceLabel,
    candidate.marketplacePath ?? "",
    candidate.plugin.id,
    candidate.plugin.name,
    candidate.plugin.interface?.displayName ?? "",
    candidate.plugin.interface?.shortDescription ?? "",
    candidate.plugin.interface?.longDescription ?? "",
    candidate.plugin.keywords.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function selectPluginCandidatesByIds(
  candidates: readonly PluginCandidate[],
  pluginIds: readonly string[],
) {
  const candidatesByPluginId = new Map(
    candidates.map((candidate) => [candidate.plugin.id, candidate]),
  );
  const selected: PluginCandidate[] = [];
  const usedPluginIds = new Set<string>();

  for (const pluginId of pluginIds) {
    const candidate = candidatesByPluginId.get(pluginId);
    if (candidate == null || usedPluginIds.has(candidate.plugin.id)) {
      continue;
    }
    usedPluginIds.add(candidate.plugin.id);
    selected.push(candidate);
  }

  return selected;
}

function getOrderedMarketplaces(snapshot: PluginListSnapshot) {
  const marketplacesByName = new Map(
    snapshot.marketplaces.map((marketplace) => [marketplace.name, marketplace]),
  );

  const prioritized = MARKETPLACE_PRIORITY.flatMap((marketplaceName) => {
    const marketplace = marketplacesByName.get(marketplaceName);
    return marketplace == null ? [] : [marketplace];
  });

  const prioritizedNames = new Set(prioritized.map((marketplace) => marketplace.name));
  const remaining = snapshot.marketplaces.filter(
    (marketplace) => !prioritizedNames.has(marketplace.name),
  );

  return [...prioritized, ...remaining];
}

function getPluginNameMatch(plugin: PluginSummary, pluginNames: readonly string[]) {
  const pluginPrefix = plugin.id.split("@")[0]?.toLowerCase();
  const pluginName = plugin.name.toLowerCase();
  return (
    pluginNames.find(
      (candidate) =>
        candidate.toLowerCase() === pluginName || candidate.toLowerCase() === pluginPrefix,
    ) ?? null
  );
}

function getFirstNonEmptyLine(lines: readonly string[] | null) {
  return lines?.map((line) => line.trim()).find((line) => line.length > 0) ?? null;
}

function getHeroPluginAliases(slug: HeroPluginSlug) {
  return [slug, `connector-${slug}`];
}

function normalizeHeroMatchKey(value: string) {
  return value.trim().toLowerCase().replace(/[_\s]+/g, "-");
}

function normalizeSectionId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function normalizeMarketplaceKey(value: string) {
  return value.trim().toLowerCase();
}

function normalizeMarketplaceLabel(value: string) {
  return normalizeMarketplaceKey(value).replace(/[_-]+/g, " ");
}

function normalizeImportedConnectorName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizePathForComparison(path: string) {
  return path.replaceAll("\\", "/").replace(/\/+$/g, "");
}
