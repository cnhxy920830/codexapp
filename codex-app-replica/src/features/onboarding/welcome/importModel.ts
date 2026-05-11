import type { MessageKey } from "../../../i18n/messages";
import type { ExternalAgentImportItem } from "../../../services/externalAgentImport";
import {
  EXTERNAL_AGENT_PROVIDER_IDS,
  type ExternalAgentProviderId,
  type WelcomeImportChoice,
  type WelcomeImportChoiceIcon,
  type WelcomeImportGroup,
  type WelcomeImportModel,
  type WelcomeImportSelection,
  type WelcomeImportSummary,
  type WelcomeWorkMode,
} from "./types";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

const ITEM_TYPE_ORDER: Record<string, number> = {
  CONFIG: 0,
  AGENTS_MD: 1,
  SKILLS: 2,
  COMMANDS: 3,
  SUBAGENTS: 4,
  HOOKS: 5,
  PLUGINS: 6,
  MCP_SERVER_CONFIG: 7,
  SESSIONS: 8,
};

export function getAvailableExternalAgentProviders(items: ExternalAgentImportItem[]) {
  return EXTERNAL_AGENT_PROVIDER_IDS.filter((providerId) => buildExternalAgentImportModel(items, [providerId], () => "") != null);
}

export function buildExternalAgentImportModel(
  items: ExternalAgentImportItem[],
  providerIds: ExternalAgentProviderId[],
  t: Translate,
): WelcomeImportModel | null {
  const filteredItems = items.filter((item) => {
    const providerId = normalizeProviderId(item);
    return providerId != null && providerIds.includes(providerId);
  });
  const homeItems = filteredItems.filter((item) => isHomeItem(item));
  const projectItems = filteredItems.filter((item) => !isHomeItem(item) && item.itemType !== "SESSIONS");
  const toolsAndSetupItems = sortImportItems(homeItems.filter((item) => item.itemType !== "SESSIONS"));
  const sessions = homeItems.filter((item) => item.itemType === "SESSIONS");

  if (toolsAndSetupItems.length === 0 && projectItems.length === 0 && sessions.length === 0) {
    return null;
  }

  const groupedProjects = sortImportItems(projectItems);
  const projectCount = countProjects(groupedProjects, sessions);
  const recentChatCount = countSessions(sessions);
  const customizeItems = buildCustomizeItems(toolsAndSetupItems, projectCount, t);
  const summary: WelcomeImportSummary = {
    bothProvidersNote: providerIds.includes("claude-code") && providerIds.includes("claude-cowork"),
    chatChoiceKey: recentChatCount > 0 ? "chats" : null,
    customizeItems,
    projectChoiceKey: projectCount > 0 ? "projects" : null,
    projectCount,
    recentChatCount,
    toolsAndSetupCount: toolsAndSetupItems.length,
  };

  return {
    availableProviders: providerIds,
    filteredItems,
    selectedImportItems: [],
    selection: createDefaultExternalAgentImportSelection(summary),
    summary,
  };
}

export function buildExternalAgentImportSummary(
  items: ExternalAgentImportItem[],
  providerIds: ExternalAgentProviderId[],
  t: Translate,
) {
  return buildExternalAgentImportModel(items, providerIds, t)?.summary ?? null;
}

export function createDefaultExternalAgentImportSelection(
  summary: WelcomeImportSummary,
  includeProjects = summary.projectChoiceKey != null,
  includeChats = summary.chatChoiceKey != null,
) {
  const selection: WelcomeImportSelection = Object.fromEntries(summary.customizeItems.map((item) => [item.id, true]));
  if (includeProjects && summary.projectChoiceKey != null) {
    selection[summary.projectChoiceKey] = true;
  }
  if (includeChats && summary.chatChoiceKey != null) {
    selection[summary.chatChoiceKey] = true;
  }
  return selection;
}

export function buildSelectedExternalAgentImportItems(
  items: ExternalAgentImportItem[],
  providerIds: ExternalAgentProviderId[],
  selection: WelcomeImportSelection,
) {
  const model = buildExternalAgentImportSelectionModel(items, providerIds);
  if (model == null) {
    return [];
  }

  const hasPerProjectSelection = model.projectItems.some((item, index) =>
    Object.prototype.hasOwnProperty.call(selection, buildExternalAgentImportProjectChoiceId(item, index)),
  );

  const selectedItems: ExternalAgentImportItem[] = [];

  model.toolsAndSetupItems.forEach((item, index) => {
    if (selection[buildExternalAgentImportChoiceId(item, index)] === true) {
      selectedItems.push(item);
    }
  });

  if (model.projectChoiceKey != null && selection[model.projectChoiceKey] === true) {
    if (hasPerProjectSelection) {
      model.projectItems.forEach((item, index) => {
        if (selection[buildExternalAgentImportProjectChoiceId(item, index)] === true) {
          selectedItems.push(item);
        }
      });
    } else {
      selectedItems.push(...model.projectItems);
    }
  }

  if (model.chatChoiceKey != null && selection[model.chatChoiceKey] === true) {
    selectedItems.push(...model.sessionItems);
  }

  return selectedItems;
}

export function buildExternalAgentImportSelection(
  items: ExternalAgentImportItem[],
  providerIds: ExternalAgentProviderId[],
  t: Translate,
) {
  const model = buildExternalAgentImportModel(items, providerIds, t);
  if (model == null || model.summary == null) {
    return null;
  }

  return {
    ...model,
    selectedImportItems: buildSelectedExternalAgentImportItems(items, providerIds, model.selection),
  };
}

export function hasExternalAgentImportSelection(
  summary: WelcomeImportSummary,
  selection: WelcomeImportSelection,
) {
  return [
    ...summary.customizeItems.map((item) => item.id),
    summary.projectChoiceKey,
    summary.chatChoiceKey,
  ].some((key) => key != null && selection[key] === true);
}

export function describeExternalAgentImportGroupSelection(
  summary: WelcomeImportSummary,
  selection: WelcomeImportSelection,
  group: WelcomeImportGroup,
): "all" | "none" | "partial" {
  const groupItems = summary.customizeItems.filter((item) => item.group === group);
  if (groupItems.length === 0) {
    return "none";
  }

  const selectedCount = groupItems.filter((item) => selection[item.id] === true).length;
  if (selectedCount === 0) {
    return "none";
  }
  if (selectedCount === groupItems.length) {
    return "all";
  }
  return "partial";
}

export function setExternalAgentImportGroupSelection(
  current: WelcomeImportSelection,
  summary: WelcomeImportSummary,
  group: WelcomeImportGroup,
  checked: boolean,
) {
  const next = { ...current };
  for (const item of summary.customizeItems.filter((choice) => choice.group === group)) {
    next[item.id] = checked;
  }
  return next;
}

export function buildExternalAgentImportChoiceId(item: ExternalAgentImportItem, index: number) {
  return `${item.itemType}:${item.cwd ?? "home"}:${index}`;
}

export function buildExternalAgentImportProjectChoiceId(item: ExternalAgentImportItem, index: number) {
  return `projects:${item.itemType}:${item.cwd ?? "project"}:${index}`;
}

export function buildExternalAgentImportChoiceTitle(
  item: ExternalAgentImportItem,
  t: Translate,
  providerId: ExternalAgentProviderId | null,
  index: number,
) {
  if (providerId === "claude-cowork" && isHomeItem(item) && item.itemType === "CONFIG") {
    return "Tools & Setup";
  }

  if (item.itemType === "PLUGINS") {
    const pluginCount = item.details?.plugins.reduce((count, migration) => count + migration.pluginNames.length, 0) ?? 0;
    if (pluginCount > 0) {
      return t("onboarding.welcomeV2.externalAgentImport.customize.pluginsWithCount", { count: pluginCount });
    }
  }

  switch (item.itemType) {
    case "AGENTS_MD":
      return t("externalAgentConfig.itemType.agentsMd");
    case "CONFIG":
      return t("externalAgentConfig.itemType.config");
    case "SKILLS":
      return t("externalAgentConfig.itemType.skills");
    case "PLUGINS":
      return t("externalAgentConfig.itemType.plugins");
    case "SUBAGENTS":
      return t("externalAgentConfig.itemType.subagents");
    case "HOOKS":
      return t("externalAgentConfig.itemType.hooks");
    case "COMMANDS":
      return t("externalAgentConfig.itemType.commands");
    case "MCP_SERVER_CONFIG":
      return t("externalAgentConfig.itemType.mcpServerConfig");
    case "SESSIONS":
      return t("externalAgentConfig.itemType.sessions");
    default:
      return `${item.itemType}:${index}`;
  }
}

export function buildExternalAgentImportChoiceDescription(item: ExternalAgentImportItem) {
  if (!item.description) {
    return "";
  }

  return normalizeExternalAgentImportDescription(normalizeExternalAgentImportPathText(item.description));
}

export function buildExternalAgentImportChoiceIcon(item: ExternalAgentImportItem): WelcomeImportChoiceIcon {
  switch (item.itemType) {
    case "AGENTS_MD":
      return "instructions";
    case "CONFIG":
    case "MCP_SERVER_CONFIG":
      return "settings";
    case "SKILLS":
      return "skills";
    case "PLUGINS":
      return "plugins";
    case "SUBAGENTS":
      return "agents";
    case "HOOKS":
      return "hooks";
    case "COMMANDS":
      return "commands";
    case "SESSIONS":
      return "projects";
    default:
      return "instructions";
  }
}

export function buildExternalAgentImportChoiceSelectionKey(
  item: ExternalAgentImportItem,
  index: number,
  isProjectItem: boolean,
) {
  return isProjectItem ? buildExternalAgentImportProjectChoiceId(item, index) : buildExternalAgentImportChoiceId(item, index);
}

export function normalizeExternalAgentImportProviderId(providerId: string | null | undefined): ExternalAgentProviderId | null {
  const trimmed = providerId?.trim();
  return trimmed === "claude-code" || trimmed === "claude-cowork" ? trimmed : null;
}

export function normalizeExternalAgentImportSelectionKey(value: string) {
  return value.trim();
}

function buildExternalAgentImportSelectionModel(
  items: ExternalAgentImportItem[],
  providerIds: ExternalAgentProviderId[],
) {
  const filteredItems = items.filter((item) => {
    const providerId = normalizeProviderId(item);
    return providerId != null && providerIds.includes(providerId);
  });
  const homeItems = filteredItems.filter((item) => isHomeItem(item));
  const projectItems = filteredItems.filter((item) => !isHomeItem(item) && item.itemType !== "SESSIONS");
  const sessionItems = homeItems.filter((item) => item.itemType === "SESSIONS");

  if (projectItems.length === 0 && sessionItems.length === 0 && homeItems.length === 0) {
    return null;
  }

  return {
    filteredItems,
    homeItems,
    projectItems,
    sessionItems,
    toolsAndSetupItems: sortImportItems(homeItems.filter((item) => item.itemType !== "SESSIONS")),
    projectChoiceKey: projectItems.length > 0 ? "projects" : null,
    chatChoiceKey: sessionItems.length > 0 ? "chats" : null,
  };
}

function buildCustomizeItems(
  toolsAndSetupItems: ExternalAgentImportItem[],
  projectCount: number,
  t: Translate,
) {
  const customizeItems: WelcomeImportChoice[] = toolsAndSetupItems.map((item, index) => ({
    description: buildExternalAgentImportChoiceDescription(item),
    group: "toolsAndSetup" as const,
    icon: buildExternalAgentImportChoiceIcon(item),
    id: buildExternalAgentImportChoiceId(item, index),
    title: buildExternalAgentImportChoiceTitle(item, t, normalizeProviderId(item), index),
  }));

  if (projectCount > 0) {
    customizeItems.push({
      description: t("onboarding.welcomeV2.externalAgentImport.customize.projectsDescription"),
      group: "projects",
      icon: "projects",
      id: "projects",
      title: t("onboarding.welcomeV2.externalAgentImport.customize.projects", { count: projectCount }),
    });
  }

  return customizeItems;
}

function countProjects(projectItems: ExternalAgentImportItem[], sessionItems: ExternalAgentImportItem[]) {
  return new Set(
    [
      ...projectItems.map((item) => item.cwd?.trim() ?? ""),
      ...sessionItems.flatMap((item) => item.details?.sessions.map((session) => session.cwd.trim()) ?? []),
    ].filter((root) => root.length > 0),
  ).size;
}

function countSessions(items: ExternalAgentImportItem[]) {
  return items.reduce((count, item) => count + (item.details?.sessions.length ?? 0), 0);
}

function isHomeItem(item: ExternalAgentImportItem) {
  return item.cwd == null || item.cwd.trim().length === 0;
}

function normalizeProviderId(item: ExternalAgentImportItem): ExternalAgentProviderId | null {
  return normalizeExternalAgentImportProviderId(item.providerId);
}

function normalizeExternalAgentImportDescription(description: string) {
  return description
    .replace(/^Migrate [A-Za-z ]+ from (.+?) (?:to|into) (.+)$/, "$1 to $2")
    .replace(/^Migrate (.+?) (?:to|into) (.+)$/, "$1 to $2")
    .replace(/^Migrate [A-Za-z ]+ from (.+)$/, "$1")
    .replace(/^Migrate /, "")
    .replace(/\binto\b/g, "to");
}

function normalizeExternalAgentImportPathText(text: string) {
  return text
    .replace(/\/(?:private\/)?var\/folders\/\S+?\/T\/codex-claude-import\/\.claude(?=\/|\s|$)/g, "~/.claude")
    .replace(/\/(?:private\/)?var\/folders\/\S+?\/T\/codex-claude-import\/\.codex(?=\/|\s|$)/g, "~/.codex")
    .replace(/\/(?:private\/)?var\/folders\/\S+?\/T\/codex-claude-import\/\.agents(?=\/|\s|$)/g, "~/.agents")
    .replace(/\/(?:private\/)?tmp\/codex-claude-import\/\.claude(?=\/|\s|$)/g, "~/.claude")
    .replace(/\/(?:private\/)?tmp\/codex-claude-import\/\.codex(?=\/|\s|$)/g, "~/.codex")
    .replace(/\/(?:private\/)?tmp\/codex-claude-import\/\.agents(?=\/|\s|$)/g, "~/.agents")
    .replace(/\/Users\/[^/\s]+\/\S+?\/\.stage\/home\/\.claude(?=\/|\s|$)/g, "~/.claude")
    .replace(/\/Users\/[^/\s]+\/\S+?\/\.stage\/codex-home(?=\/|\s|$)/g, "~/.codex")
    .replace(/\/Users\/[^/\s]+\/\S+?\/\.stage\/\.agents(?=\/|\s|$)/g, "~/.agents")
    .replace(/\/Users\/[^/\s]+\/\.claude(?=\/|\s|$)/g, "~/.claude")
    .replace(/\/Users\/[^/\s]+\/\.codex(?=\/|\s|$)/g, "~/.codex")
    .replace(/\/Users\/[^/\s]+\/\.agents(?=\/|\s|$)/g, "~/.agents")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.claude(?=\\|\s|$)/g, "~/.claude")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.codex(?=\\|\s|$)/g, "~/.codex")
    .replace(/[A-Za-z]:\\Users\\[^\\]+\\\.agents(?=\\|\s|$)/g, "~/.agents");
}

function sortImportItems(items: ExternalAgentImportItem[]) {
  return [...items].sort((left, right) => {
    const order = (ITEM_TYPE_ORDER[left.itemType] ?? 99) - (ITEM_TYPE_ORDER[right.itemType] ?? 99);
    if (order !== 0) {
      return order;
    }
    return left.description.localeCompare(right.description);
  });
}
