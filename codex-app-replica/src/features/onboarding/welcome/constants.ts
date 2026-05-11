import type { MessageKey } from "../../../i18n/messages";
import type {
  ExternalAgentProviderId,
  WelcomeIntentId,
  WelcomeRoleId,
  WelcomeWorkMode,
} from "./types";

export const DEFAULT_WELCOME_ROLE_ID = "default" as const;

export const WELCOME_ROLE_IDS = [
  "engineering",
  "product_management",
  "finance",
  "marketing",
  "sales",
  "operations",
  "data_science",
  "design",
  "student",
  "something_else",
] as const satisfies WelcomeRoleId[];

export const CODING_ROLE_IDS = new Set<WelcomeRoleId | typeof DEFAULT_WELCOME_ROLE_ID>([
  DEFAULT_WELCOME_ROLE_ID,
  "engineering",
  "data_science",
]);

export const INTENT_OPTIONS: Array<{ badge: string; id: WelcomeIntentId; labelKey: MessageKey }> = [
  { badge: "</>", id: "build_software", labelKey: "onboarding.welcomeV2.intent.buildSoftware" },
  { badge: "UI", id: "design_products", labelKey: "onboarding.welcomeV2.intent.designProducts" },
  { badge: "PR", id: "manage_projects", labelKey: "onboarding.welcomeV2.intent.manageProjects" },
  { badge: "IN", id: "search_email_chat", labelKey: "onboarding.welcomeV2.intent.searchEmailChat" },
  { badge: "CA", id: "manage_calendar", labelKey: "onboarding.welcomeV2.intent.manageCalendar" },
  { badge: "DOC", id: "work_with_docs", labelKey: "onboarding.welcomeV2.intent.workWithDocs" },
  { badge: "DA", id: "analyze_data", labelKey: "onboarding.welcomeV2.intent.analyzeData" },
  { badge: "?", id: "other", labelKey: "onboarding.welcomeV2.intent.other" },
];

export const WORK_MODE_OPTIONS: Array<{
  badge: string;
  descriptionKey: MessageKey;
  id: WelcomeWorkMode;
  titleKey: MessageKey;
}> = [
  {
    badge: "</>",
    descriptionKey: "onboarding.welcomeV2.workMode.coding.description",
    id: "coding",
    titleKey: "onboarding.welcomeV2.workMode.coding.title",
  },
  {
    badge: "AA",
    descriptionKey: "onboarding.welcomeV2.workMode.nonCoding.description",
    id: "non_coding",
    titleKey: "onboarding.welcomeV2.workMode.nonCoding.title",
  },
];

export const ROLE_OPTIONS: Array<{ id: WelcomeRoleId; labelKey: MessageKey }> = [
  { id: "engineering", labelKey: "onboarding.welcomeV2.role.engineering" },
  { id: "product_management", labelKey: "onboarding.welcomeV2.role.product" },
  { id: "finance", labelKey: "onboarding.welcomeV2.role.finance" },
  { id: "marketing", labelKey: "onboarding.welcomeV2.role.marketing" },
  { id: "sales", labelKey: "onboarding.welcomeV2.role.sales" },
  { id: "operations", labelKey: "onboarding.welcomeV2.role.operations" },
  { id: "data_science", labelKey: "onboarding.welcomeV2.role.dataScience" },
  { id: "design", labelKey: "onboarding.welcomeV2.role.design" },
  { id: "student", labelKey: "onboarding.welcomeV2.role.student" },
  { id: "something_else", labelKey: "onboarding.welcomeV2.role.somethingElse" },
];

export const PROVIDER_LABEL_KEYS: Record<ExternalAgentProviderId, MessageKey> = {
  "claude-code": "onboarding.welcomeV2.externalAgentImport.providers.claudeCode",
  "claude-cowork": "onboarding.welcomeV2.externalAgentImport.providers.claudeCowork",
};
