import { useI18n } from "../i18n/i18n";

export type SettingsSectionTitleSlug =
  | "account"
  | "agent"
  | "appearance"
  | "browser-use"
  | "computer-use"
  | "connections"
  | "data-controls"
  | "general-settings"
  | "git-settings"
  | "hooks-settings"
  | "keyboard-shortcuts"
  | "local-environments"
  | "mcp-settings"
  | "personalization"
  | "plugins-settings"
  | "skills-settings"
  | "usage"
  | "worktrees";

const TITLE_KEY_BY_SLUG = {
  account: "settings.section.account",
  agent: "settings.section.agent",
  appearance: "settings.section.appearance",
  "browser-use": "settings.section.browser-use",
  "computer-use": "settings.section.computer-use",
  connections: "settings.section.connections",
  "data-controls": "settings.section.data-controls",
  "general-settings": "settings.section.general-settings",
  "git-settings": "settings.section.git-settings",
  "hooks-settings": "settings.section.hooks-settings",
  "keyboard-shortcuts": "settings.section.keyboard-shortcuts",
  "local-environments": "settings.section.local-environments",
  "mcp-settings": "settings.section.mcp-settings",
  personalization: "settings.section.personalization",
  "plugins-settings": "settings.section.plugins-settings",
  "skills-settings": "settings.section.skills-settings",
  usage: "settings.section.usage",
  worktrees: "settings.section.worktrees",
} as const satisfies Record<SettingsSectionTitleSlug, string>;

export function SettingsSectionTitle({
  slug,
}: {
  slug: SettingsSectionTitleSlug;
}) {
  const { t } = useI18n();

  return <>{t(TITLE_KEY_BY_SLUG[slug])}</>;
}
