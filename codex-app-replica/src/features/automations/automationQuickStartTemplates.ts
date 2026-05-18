import type { MessageKey } from "../../i18n/messages";
import type { CronAutomationRecord } from "../../services/automations";
import type { AutomationQuickStartIconName } from "./automationQuickStartIcons";

type TemplateId =
  | "daily-bug-scan"
  | "weekly-release-notes"
  | "daily-standup"
  | "nightly-ci-report"
  | "daily-classic-game"
  | "skill-progression-map"
  | "weekly-engineering-summary"
  | "performance-regression-watch"
  | "dependency-sdk-drift"
  | "test-gap-detection"
  | "pre-release-check"
  | "agents-docs-sync"
  | "weekly-pr-summary"
  | "issue-triage"
  | "ci-monitor"
  | "dependency-sweep"
  | "performance-audit"
  | "changelog-update";

type ScheduleConfig = {
  customRrule: string;
  intervalHours: number;
  intervalMinutes: number | null;
  mode: "custom" | "daily" | "weekdays" | "weekly";
  time: string;
  weekdays: string[];
};

export type AutomationQuickStartTemplate = {
  draftNameKey: MessageKey;
  iconName: AutomationQuickStartIconName;
  id: TemplateId;
  promptKey: MessageKey;
  scheduleConfig: ScheduleConfig;
};

export type AutomationQuickStartSection = {
  id: string;
  templateIds: TemplateId[];
  titleKey: MessageKey;
};

const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR"] as const;
const ALL_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

function schedule(config: ScheduleConfig): ScheduleConfig {
  return config;
}

export const AUTOMATION_QUICK_START_TEMPLATES: AutomationQuickStartTemplate[] = [
  {
    id: "daily-bug-scan",
    draftNameKey: "inbox.rightPanel.quickStart.home.dailyBugScan.draftName",
    promptKey: "home.useCases.dailyBugScan.automationPrompt",
    iconName: "ladybug",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "09:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "weekly-release-notes",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.weeklyReleaseNotes.draftName",
    promptKey: "home.useCases.weeklyReleaseNotes.automationPrompt",
    iconName: "book-open",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["FR"],
      time: "09:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "daily-standup",
    draftNameKey: "inbox.rightPanel.quickStart.home.dailyStandup.draftName",
    promptKey: "home.useCases.dailyStandup.automationPrompt",
    iconName: "bubble-on-bubble",
    scheduleConfig: schedule({
      mode: "weekdays",
      weekdays: [...WEEKDAYS],
      time: "09:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "nightly-ci-report",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.nightlyCiReport.draftName",
    promptKey: "home.useCases.nightlyCiReport.automationPrompt",
    iconName: "radar",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "21:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "daily-classic-game",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.dailyClassicGame.draftName",
    promptKey: "home.useCases.dailyClassicGame.automationPrompt",
    iconName: "star-app",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "14:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "skill-progression-map",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.skillProgressionMap.draftName",
    promptKey: "home.useCases.skillProgressionMap.automationPrompt",
    iconName: "hierarchy",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["FR"],
      time: "10:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "weekly-engineering-summary",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.weeklyEngineeringSummary.draftName",
    promptKey: "home.useCases.weeklyEngineeringSummary.automationPrompt",
    iconName: "figure-text-document",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["FR"],
      time: "16:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "performance-regression-watch",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.performanceRegressionWatch.draftName",
    promptKey: "home.useCases.performanceRegressionWatch.automationPrompt",
    iconName: "bar-chart",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "09:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "dependency-sdk-drift",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.dependencySdkDrift.draftName",
    promptKey: "home.useCases.dependencySdkDrift.automationPrompt",
    iconName: "checkmark-circle",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "11:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "test-gap-detection",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.testGapDetection.draftName",
    promptKey: "home.useCases.testGapDetection.automationPrompt",
    iconName: "puzzle",
    scheduleConfig: schedule({
      mode: "daily",
      weekdays: [...ALL_DAYS],
      time: "15:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "pre-release-check",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.preReleaseCheck.draftName",
    promptKey: "home.useCases.preReleaseCheck.automationPrompt",
    iconName: "checkmark-circle",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["TH"],
      time: "13:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "agents-docs-sync",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.agentsDocsSync.draftName",
    promptKey: "home.useCases.agentsDocsSync.automationPrompt",
    iconName: "text-document",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["FR"],
      time: "11:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "weekly-pr-summary",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.weeklyPrSummary.draftName",
    promptKey: "home.useCases.weeklyPrSummary.automationPrompt",
    iconName: "newspaper",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["MO"],
      time: "09:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "issue-triage",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.issueTriage.draftName",
    promptKey: "home.useCases.issueTriage.automationPrompt",
    iconName: "exclamationmark-bubble",
    scheduleConfig: schedule({
      mode: "weekdays",
      weekdays: [...WEEKDAYS],
      time: "09:30",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "ci-monitor",
    draftNameKey: "inbox.rightPanel.quickStart.home.ciMonitor.draftName",
    promptKey: "home.useCases.ciMonitor.automationPrompt",
    iconName: "terminal",
    scheduleConfig: schedule({
      mode: "custom",
      weekdays: [...WEEKDAYS],
      time: "09:00",
      intervalHours: 2,
      intervalMinutes: null,
      customRrule:
        "RRULE:FREQ=HOURLY;INTERVAL=2;BYMINUTE=0;BYDAY=MO,TU,WE,TH,FR",
    }),
  },
  {
    id: "dependency-sweep",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.dependencySweep.draftName",
    promptKey: "home.useCases.dependencySweep.automationPrompt",
    iconName: "block-stack, skills",
    scheduleConfig: schedule({
      mode: "custom",
      weekdays: [...ALL_DAYS],
      time: "09:00",
      intervalHours: 720,
      intervalMinutes: null,
      customRrule:
        "RRULE:FREQ=HOURLY;INTERVAL=720;BYMINUTE=0;BYDAY=MO,TU,WE,TH,FR,SA,SU",
    }),
  },
  {
    id: "performance-audit",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.performanceAudit.draftName",
    promptKey: "home.useCases.performanceAudit.automationPrompt",
    iconName: "compass",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["MO"],
      time: "14:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
  {
    id: "changelog-update",
    draftNameKey:
      "inbox.rightPanel.quickStart.home.changelogUpdate.draftName",
    promptKey: "home.useCases.changelogUpdate.automationPrompt",
    iconName: "pencil",
    scheduleConfig: schedule({
      mode: "weekly",
      weekdays: ["FR"],
      time: "16:00",
      intervalHours: 24,
      intervalMinutes: null,
      customRrule: "",
    }),
  },
];

export const AUTOMATION_QUICK_START_SECTIONS: AutomationQuickStartSection[] = [
  {
    id: "automation-templates-status-reports",
    titleKey: "inbox.rightPanel.quickStart.section.statusReports",
    templateIds: [
      "daily-standup",
      "weekly-engineering-summary",
      "weekly-pr-summary",
    ],
  },
  {
    id: "automation-templates-release-prep",
    titleKey: "inbox.rightPanel.quickStart.section.releasePrep",
    templateIds: [
      "weekly-release-notes",
      "pre-release-check",
      "changelog-update",
    ],
  },
  {
    id: "automation-templates-incidents-triage",
    titleKey: "inbox.rightPanel.quickStart.section.incidentsAndTriage",
    templateIds: [
      "nightly-ci-report",
      "ci-monitor",
      "issue-triage",
    ],
  },
  {
    id: "automation-templates-code-quality",
    titleKey: "inbox.rightPanel.quickStart.section.codeQuality",
    templateIds: [
      "daily-bug-scan",
      "test-gap-detection",
      "performance-regression-watch",
    ],
  },
  {
    id: "automation-templates-repo-maintenance",
    titleKey: "inbox.rightPanel.quickStart.section.repoMaintenance",
    templateIds: ["dependency-sdk-drift", "dependency-sweep", "agents-docs-sync"],
  },
  {
    id: "automation-templates-growth-exploration",
    titleKey: "inbox.rightPanel.quickStart.section.growthAndExploration",
    templateIds: ["skill-progression-map", "performance-audit"],
  },
];

const TEMPLATE_BY_ID = new Map(
  AUTOMATION_QUICK_START_TEMPLATES.map((template) => [template.id, template]),
);

export function getAutomationQuickStartSectionTemplates(
  section: AutomationQuickStartSection,
) {
  return section.templateIds.flatMap((id) => {
    const template = TEMPLATE_BY_ID.get(id);
    return template ? [template] : [];
  });
}

export function buildQuickStartAutomationDraft(
  template: AutomationQuickStartTemplate,
  draft: CronAutomationRecord,
  translate: (key: MessageKey) => string,
): CronAutomationRecord {
  return {
    ...draft,
    name:
      translate(template.draftNameKey).trim() ||
      translate("inbox.rightPanel.quickStart.home.defaultDraftName"),
    prompt: translate(template.promptKey),
    rrule: scheduleConfigToRrule(template.scheduleConfig),
  };
}

export function scheduleConfigToRrule(scheduleConfig: ScheduleConfig) {
  if (scheduleConfig.mode === "custom") {
    return scheduleConfig.customRrule;
  }

  const [hour, minute] = scheduleConfig.time.split(":").map(Number);
  const byDay =
    scheduleConfig.mode === "daily"
      ? ALL_DAYS
      : scheduleConfig.mode === "weekdays"
        ? WEEKDAYS
        : scheduleConfig.weekdays;

  const parts = [
    "FREQ=WEEKLY",
    "INTERVAL=1",
    `BYHOUR=${hour}`,
    `BYMINUTE=${minute}`,
    `BYDAY=${byDay.join(",")}`,
  ];

  return parts.join(";");
}
