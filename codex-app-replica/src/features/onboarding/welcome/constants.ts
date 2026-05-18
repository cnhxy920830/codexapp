import type { ComponentType, SVGProps } from "react";
import type { MessageKey } from "../../../i18n/messages";
import {
  WelcomeAnalyzeDataIcon,
  WelcomeCalendarIcon,
  WelcomeDesignProductsIcon,
  WelcomeManageProjectsIcon,
  WelcomeNonCodingIcon,
  WelcomeOtherIntentIcon,
  WelcomeSearchEmailChatIcon,
  WelcomeTerminalIcon,
  WelcomeWorkWithDocsIcon,
} from "./optionIcons";
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

type WelcomeOptionIcon = ComponentType<SVGProps<SVGSVGElement>>;

export const INTENT_OPTIONS: Array<{ icon: WelcomeOptionIcon; id: WelcomeIntentId; labelKey: MessageKey }> = [
  { icon: WelcomeTerminalIcon, id: "build_software", labelKey: "onboarding.welcomeV2.intent.buildSoftware" },
  { icon: WelcomeDesignProductsIcon, id: "design_products", labelKey: "onboarding.welcomeV2.intent.designProducts" },
  { icon: WelcomeManageProjectsIcon, id: "manage_projects", labelKey: "onboarding.welcomeV2.intent.manageProjects" },
  { icon: WelcomeSearchEmailChatIcon, id: "search_email_chat", labelKey: "onboarding.welcomeV2.intent.searchEmailChat" },
  { icon: WelcomeCalendarIcon, id: "manage_calendar", labelKey: "onboarding.welcomeV2.intent.manageCalendar" },
  { icon: WelcomeWorkWithDocsIcon, id: "work_with_docs", labelKey: "onboarding.welcomeV2.intent.workWithDocs" },
  { icon: WelcomeAnalyzeDataIcon, id: "analyze_data", labelKey: "onboarding.welcomeV2.intent.analyzeData" },
  { icon: WelcomeOtherIntentIcon, id: "other", labelKey: "onboarding.welcomeV2.intent.other" },
];

export const WORK_MODE_OPTIONS: Array<{
  descriptionKey: MessageKey;
  icon: WelcomeOptionIcon;
  id: WelcomeWorkMode;
  titleKey: MessageKey;
}> = [
  {
    descriptionKey: "onboarding.welcomeV2.workMode.coding.description",
    icon: WelcomeTerminalIcon,
    id: "coding",
    titleKey: "onboarding.welcomeV2.workMode.coding.title",
  },
  {
    descriptionKey: "onboarding.welcomeV2.workMode.nonCoding.description",
    icon: WelcomeNonCodingIcon,
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
