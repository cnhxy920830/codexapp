import type { ExternalAgentImportItem } from "../../../services/externalAgentImport";

export const EXTERNAL_AGENT_PROVIDER_IDS = ["claude-code", "claude-cowork"] as const;

export type ExternalAgentProviderId = (typeof EXTERNAL_AGENT_PROVIDER_IDS)[number];
export type WelcomeMode = "simple" | "intent" | "role";
export type WelcomeWorkMode = "coding" | "non_coding";
export type WelcomeIntentId =
  | "build_software"
  | "design_products"
  | "manage_projects"
  | "search_email_chat"
  | "manage_calendar"
  | "work_with_docs"
  | "analyze_data"
  | "other";
export type WelcomeRoleId =
  | "engineering"
  | "product_management"
  | "finance"
  | "marketing"
  | "sales"
  | "operations"
  | "data_science"
  | "design"
  | "student"
  | "something_else";

export type WelcomeImportGroup = "toolsAndSetup" | "projects";
export type WelcomeImportChoiceKind = WelcomeImportGroup | "chats";
export type WelcomeImportChoiceIcon =
  | "instructions"
  | "settings"
  | "skills"
  | "plugins"
  | "agents"
  | "hooks"
  | "commands"
  | "projects";

export type WelcomeImportChoice = {
  description: string;
  group: WelcomeImportGroup;
  icon: WelcomeImportChoiceIcon;
  id: string;
  title: string;
};

export type WelcomeImportSummary = {
  bothProvidersNote: boolean;
  chatChoiceKey: string | null;
  customizeItems: WelcomeImportChoice[];
  projectChoiceKey: string | null;
  projectCount: number;
  recentChatCount: number;
  toolsAndSetupCount: number;
};

export type WelcomeImportSelection = Record<string, boolean>;

export type WelcomeImportModel = {
  availableProviders: ExternalAgentProviderId[];
  filteredItems: ExternalAgentImportItem[];
  selectedImportItems: ExternalAgentImportItem[];
  selection: WelcomeImportSelection;
  summary: WelcomeImportSummary | null;
};
