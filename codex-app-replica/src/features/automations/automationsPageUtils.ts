import type { AutomationRecord, AutomationStatus } from "../../services/automations";
import type { ThreadHistoryEntry } from "../../services/history";
import {
  getLocalEnvironmentProjectName,
  normalizePathForComparison,
} from "../../services/localEnvironments";
import type { MessageKey, MessageValues } from "../../i18n/messages";

export type FeedbackState =
  | {
      message: string;
      tone: "error" | "success";
    }
  | null;

export type TranslateFn = (key: MessageKey, values?: MessageValues) => string;

export type ScheduleConfig = {
  customRrule: string;
  intervalHours: number;
  intervalMinutes: number | null;
  mode: "custom" | "daily" | "hourly" | "weekdays" | "weekly";
  time: string;
  weekdays: string[];
};

export type HeartbeatThreadOption = {
  createdAt: number | null;
  id: string;
  isPinned: boolean;
  title: string;
  unavailable: boolean;
};

const WEEKDAY_ORDER = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;
const ALL_WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const BUSINESS_WEEKDAYS = ["MO", "TU", "WE", "TH", "FR"] as const;
const WEEKEND_DAYS = ["SA", "SU"] as const;
const DEFAULT_SCHEDULE_TIME = "09:00";

export function isPaused(automation: AutomationRecord) {
  return automation.status === "PAUSED";
}

export function copyAutomation(automation: AutomationRecord): AutomationRecord {
  if (automation.kind === "heartbeat") {
    return { ...automation };
  }

  return { ...automation, cwds: [...automation.cwds] };
}

export function sortAutomations(items: AutomationRecord[]) {
  return [...items].sort((left, right) => {
    const leftNextRun = left.nextRunAt ?? Number.POSITIVE_INFINITY;
    const rightNextRun = right.nextRunAt ?? Number.POSITIVE_INFINITY;
    if (leftNextRun !== rightNextRun) {
      return leftNextRun - rightNextRun;
    }

    const leftName = left.name.trim();
    const rightName = right.name.trim();
    if (leftName !== rightName) {
      return leftName.localeCompare(rightName);
    }

    return left.id.localeCompare(right.id);
  });
}

export function describeAutomation(
  automation: AutomationRecord,
  threadNameById: Map<string, string>,
  locale: string,
  workspaceRootLabels: Record<string, string>,
  t: TranslateFn,
) {
  if (automation.kind === "heartbeat") {
    return t("inbox.automations.rowSummary.heartbeat", {
      thread: threadNameById.get(automation.targetThreadId) ?? automation.targetThreadId,
    });
  }

  return formatWorkspaceRootsLabel(
    automation.cwds,
    locale,
    workspaceRootLabels,
    t,
  );
}

export function formatScheduleSummary(
  automation: AutomationRecord,
  locale: string,
  t: TranslateFn,
) {
  const value = automation.rrule.trim();
  if (value.length === 0) {
    return t("settings.automations.rruleSummaryFallback");
  }

  return describeRruleSummary(value, locale, t);
}

export function formatStatusLabel(status: AutomationStatus, t: TranslateFn) {
  switch (status) {
    case "ACTIVE":
      return t("inbox.automations.status.active");
    case "PAUSED":
      return t("inbox.automations.status.paused");
    case "DELETED":
      return t("inbox.automations.status.deleted");
  }
}

export function getScheduleConfigForAutomation(
  automation: Pick<AutomationRecord, "kind" | "rrule">,
): ScheduleConfig {
  if (automation.kind === "heartbeat") {
    return parseHeartbeatScheduleConfig(automation.rrule);
  }
  return parseCronScheduleConfig(automation.rrule);
}

export function scheduleConfigToRrule(scheduleConfig: ScheduleConfig) {
  if (scheduleConfig.mode === "custom") {
    return scheduleConfig.customRrule.trim();
  }

  if (scheduleConfig.mode === "hourly") {
    if (scheduleConfig.intervalMinutes !== null) {
      const intervalMinutes = Math.max(1, Math.round(scheduleConfig.intervalMinutes));
      return `FREQ=MINUTELY;INTERVAL=${intervalMinutes}`;
    }
    const intervalHours = Math.max(1, Math.round(scheduleConfig.intervalHours));
    return [
      "FREQ=HOURLY",
      `INTERVAL=${intervalHours}`,
      "BYMINUTE=0",
      `BYDAY=${ALL_WEEKDAYS.join(",")}`,
    ].join(";");
  }

  const time = parseTimeValue(scheduleConfig.time) ?? parseTimeValue(DEFAULT_SCHEDULE_TIME)!;
  const weekdays =
    scheduleConfig.mode === "daily"
      ? [...ALL_WEEKDAYS]
      : scheduleConfig.mode === "weekdays"
        ? [...BUSINESS_WEEKDAYS]
        : normalizeScheduleWeekdays(scheduleConfig.weekdays);

  return [
    "FREQ=WEEKLY",
    "INTERVAL=1",
    `BYHOUR=${time.hour}`,
    `BYMINUTE=${time.minute}`,
    `BYDAY=${weekdays.join(",")}`,
  ].join(";");
}

export function transitionScheduleMode(
  scheduleConfig: ScheduleConfig,
  nextMode: ScheduleConfig["mode"],
) {
  if (nextMode === "custom") {
    return {
      ...scheduleConfig,
      mode: "custom",
      customRrule:
        scheduleConfig.mode === "custom" && scheduleConfig.customRrule.trim().length > 0
          ? scheduleConfig.customRrule
          : scheduleConfigToRrule(scheduleConfig),
    } satisfies ScheduleConfig;
  }

  if (nextMode === "hourly") {
    return {
      ...scheduleConfig,
      mode: "hourly",
      intervalHours:
        scheduleConfig.mode === "hourly"
          ? normalizeScheduleIntervalHours(scheduleConfig.intervalHours) ?? 1
          : 1,
      intervalMinutes:
        scheduleConfig.intervalMinutes === null
          ? null
          : normalizeScheduleIntervalMinutes(scheduleConfig.intervalMinutes) ?? 30,
    } satisfies ScheduleConfig;
  }

  if (nextMode === "daily") {
    return {
      ...scheduleConfig,
      mode: "daily",
      weekdays: [...ALL_WEEKDAYS],
    } satisfies ScheduleConfig;
  }

  if (nextMode === "weekdays") {
    return {
      ...scheduleConfig,
      mode: "weekdays",
      weekdays: [...BUSINESS_WEEKDAYS],
    } satisfies ScheduleConfig;
  }

  return {
    ...scheduleConfig,
    mode: "weekly",
    weekdays: [getPrimaryWeekday(scheduleConfig.weekdays)],
  } satisfies ScheduleConfig;
}

export function describeScheduleConfig(
  scheduleConfig: ScheduleConfig,
  locale: string,
  t: TranslateFn,
) {
  return describeRruleSummary(scheduleConfigToRrule(scheduleConfig), locale, t);
}

export function formatWorkspaceRootsLabel(
  workspaceRoots: string[],
  locale: string,
  workspaceRootLabels: Record<string, string>,
  t: TranslateFn,
) {
  if (workspaceRoots.length === 0) {
    return t("inbox.automations.workspaceFallback");
  }

  return new Intl.ListFormat(locale, { type: "conjunction" }).format(
    workspaceRoots.map((workspaceRoot) =>
      getWorkspaceRootLabel(workspaceRoot, workspaceRootLabels, t),
    ),
  );
}

export function buildHeartbeatThreadOptions({
  occupiedThreadIds,
  pinnedThreadIds,
  recentThreads,
  selectedThreadId,
  threadNameById,
}: {
  occupiedThreadIds: ReadonlySet<string>;
  pinnedThreadIds: string[];
  recentThreads: ThreadHistoryEntry[];
  selectedThreadId: string;
  threadNameById: ReadonlyMap<string, string>;
}) {
  const recentThreadById = new Map(recentThreads.map((thread) => [thread.id, thread]));
  const options: HeartbeatThreadOption[] = [];
  const seenThreadIds = new Set<string>();

  for (const pinnedThreadId of pinnedThreadIds) {
    const normalizedPinnedThreadId = pinnedThreadId.trim();
    if (
      normalizedPinnedThreadId.length === 0 ||
      seenThreadIds.has(normalizedPinnedThreadId)
    ) {
      continue;
    }

    const recentThread = recentThreadById.get(normalizedPinnedThreadId);
    if (!recentThread) {
      continue;
    }

    seenThreadIds.add(normalizedPinnedThreadId);
    options.push({
      createdAt: recentThread.createdAt,
      id: normalizedPinnedThreadId,
      isPinned: true,
      title:
        recentThread.name?.trim() ||
        recentThread.preview.trim() ||
        normalizedPinnedThreadId,
      unavailable: occupiedThreadIds.has(normalizedPinnedThreadId),
    });
  }

  const normalizedSelectedThreadId = selectedThreadId.trim();
  if (
    normalizedSelectedThreadId.length > 0 &&
    !seenThreadIds.has(normalizedSelectedThreadId)
  ) {
    const recentThread = recentThreadById.get(normalizedSelectedThreadId);
    options.unshift({
      createdAt: recentThread?.createdAt ?? null,
      id: normalizedSelectedThreadId,
      isPinned: false,
      title:
        recentThread?.name?.trim() ||
        recentThread?.preview.trim() ||
        threadNameById.get(normalizedSelectedThreadId) ||
        normalizedSelectedThreadId,
      unavailable: occupiedThreadIds.has(normalizedSelectedThreadId),
    });
  }

  return options;
}

export function getWorkspaceRootLabel(
  workspaceRoot: string,
  workspaceRootLabels: Record<string, string>,
  t: TranslateFn,
) {
  if (workspaceRoot === "~") {
    return t("settings.automations.projectDropdown.projectless");
  }

  const matchingLabelEntry = Object.entries(workspaceRootLabels).find(([root]) =>
    areSamePath(root, workspaceRoot),
  );
  const label = matchingLabelEntry?.[1]?.trim();
  if (label && label.length > 0) {
    return label;
  }

  return getLocalEnvironmentProjectName(workspaceRoot) ?? workspaceRoot;
}

export function formatErrorMessage(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${detail}`;
}

type ParsedRrule = {
  byday: string[];
  byhour: number | null;
  byminute: number | null;
  freq: string;
  interval: number;
};

function describeRruleSummary(rrule: string, locale: string, t: TranslateFn) {
  const parsed = parseRrule(rrule);
  if (!parsed) {
    return t("settings.automations.rruleSummaryFallback");
  }

  const weekdays = parsed.byday.length > 0 ? parsed.byday : [...ALL_WEEKDAYS];
  const isEveryDay = areSameDays(weekdays, ALL_WEEKDAYS);

  if (parsed.freq === "MINUTELY") {
    const intervalSummary = formatMinuteIntervalSummary(parsed.interval, t);
    if (isEveryDay) {
      return intervalSummary;
    }

    return t("settings.automations.scheduleSummary.intervalDays", {
      interval: intervalSummary,
      days: t("settings.automations.scheduleSummary.intervalDayCount", {
        count: weekdays.length,
      }),
    });
  }

  if (parsed.freq === "HOURLY") {
    const intervalSummary =
      parsed.interval === 1
        ? t("settings.automations.scheduleSummary.intervalHourly")
        : t("settings.automations.scheduleSummary.interval", {
            count: parsed.interval,
          });
    if (isEveryDay) {
      return intervalSummary;
    }

    return t("settings.automations.scheduleSummary.intervalDays", {
      interval: intervalSummary,
      days: t("settings.automations.scheduleSummary.intervalDayCount", {
        count: weekdays.length,
      }),
    });
  }

  if (parsed.freq !== "DAILY" && parsed.freq !== "WEEKLY") {
    return t("settings.automations.rruleSummaryFallback");
  }

  const timeLabel = formatScheduleTimeLabel(locale, parsed.byhour, parsed.byminute);
  if (!timeLabel) {
    return t("settings.automations.rruleSummaryFallback");
  }

  if (isEveryDay) {
    return t("settings.automations.scheduleSummary.daily", { time: timeLabel });
  }

  if (areSameDays(weekdays, BUSINESS_WEEKDAYS)) {
    return t("settings.automations.scheduleSummary.weekdays", {
      time: timeLabel,
    });
  }

  if (areSameDays(weekdays, WEEKEND_DAYS)) {
    return t("settings.automations.scheduleSummary.weekends", {
      time: timeLabel,
    });
  }

  const days = formatWeekdaySummary(weekdays, locale, t);
  return days
    ? t("settings.automations.scheduleSummary.weekly", {
        days,
        time: timeLabel,
      })
    : t("settings.automations.rruleSummaryFallback");
}

function parseCronScheduleConfig(rrule: string): ScheduleConfig {
  const parsed = parseRrule(rrule);
  if (!parsed) {
    return {
      customRrule: rrule,
      intervalHours: 24,
      intervalMinutes: null,
      mode: "custom",
      time: DEFAULT_SCHEDULE_TIME,
      weekdays: [...ALL_WEEKDAYS],
    };
  }

  const weekdays = parsed.byday.length > 0 ? parsed.byday : [...ALL_WEEKDAYS];
  const time =
    formatTimeValue(parsed.byhour, parsed.byminute) ?? DEFAULT_SCHEDULE_TIME;
  const mode =
    parsed.interval === 1 && (parsed.freq === "DAILY" || parsed.freq === "WEEKLY")
      ? areSameDays(weekdays, ALL_WEEKDAYS)
        ? "daily"
        : areSameDays(weekdays, BUSINESS_WEEKDAYS)
          ? "weekdays"
          : weekdays.length === 1
            ? "weekly"
            : "custom"
      : "custom";

  return {
    customRrule: mode === "custom" ? rrule : "",
    intervalHours: 24,
    intervalMinutes: null,
    mode,
    time,
    weekdays,
  };
}

function parseHeartbeatScheduleConfig(rrule: string): ScheduleConfig {
  const parsed = parseRrule(rrule);
  if (!parsed) {
    return {
      customRrule: rrule,
      intervalHours: 1,
      intervalMinutes: 30,
      mode: "hourly",
      time: DEFAULT_SCHEDULE_TIME,
      weekdays: [...ALL_WEEKDAYS],
    };
  }

  const weekdays = parsed.byday.length > 0 ? parsed.byday : [...ALL_WEEKDAYS];
  const time =
    formatTimeValue(parsed.byhour, parsed.byminute) ?? DEFAULT_SCHEDULE_TIME;

  if (parsed.freq === "MINUTELY") {
    return {
      customRrule: "",
      intervalHours: 1,
      intervalMinutes: parsed.interval,
      mode: "hourly",
      time,
      weekdays,
    };
  }

  if (parsed.freq === "HOURLY") {
    return {
      customRrule: "",
      intervalHours: parsed.interval,
      intervalMinutes: null,
      mode: "hourly",
      time,
      weekdays,
    };
  }

  const cronConfig = parseCronScheduleConfig(rrule);
  return {
    ...cronConfig,
    mode: cronConfig.mode,
    intervalHours: 1,
    intervalMinutes: null,
  };
}

function parseRrule(rrule: string): ParsedRrule | null {
  const normalizedRrule = normalizeRrule(rrule);
  const fields = new Map<string, string>();
  for (const part of normalizedRrule.split(";")) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) {
      continue;
    }
    fields.set(key.toUpperCase(), value.trim());
  }

  const freq = fields.get("FREQ");
  if (!freq) {
    return null;
  }

  const interval = Number(fields.get("INTERVAL") ?? "1");
  if (!Number.isFinite(interval) || interval < 1) {
    return null;
  }

  const byhour = parseOptionalNumber(fields.get("BYHOUR"));
  const byminute = parseOptionalNumber(fields.get("BYMINUTE"));
  const byday = parseByday(fields.get("BYDAY"));

  return {
    byday,
    byhour,
    byminute,
    freq,
    interval: Math.round(interval),
  };
}

function normalizeRrule(rrule: string) {
  const trimmed = rrule.trim();
  return trimmed.toUpperCase().startsWith("RRULE:")
    ? trimmed.slice("RRULE:".length)
    : trimmed;
}

function parseByday(byday: string | undefined) {
  if (!byday) {
    return [];
  }

  const values = byday
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value): value is (typeof WEEKDAY_ORDER)[number] =>
      WEEKDAY_ORDER.includes(value as (typeof WEEKDAY_ORDER)[number]),
    );

  return sortUniqueWeekdays(values);
}

function parseOptionalNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseTimeValue(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  return { hour, minute };
}

function formatTimeValue(hour: number | null, minute: number | null) {
  if (hour === null || minute === null) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizeScheduleWeekdays(weekdays: string[]) {
  const filtered = weekdays.filter((weekday): weekday is (typeof WEEKDAY_ORDER)[number] =>
    WEEKDAY_ORDER.includes(weekday as (typeof WEEKDAY_ORDER)[number]),
  );
  const normalized = sortUniqueWeekdays(
    filtered.length > 0 ? filtered : [...ALL_WEEKDAYS],
  );
  return normalized.length > 0 ? normalized : [...ALL_WEEKDAYS];
}

function getPrimaryWeekday(weekdays: string[]) {
  return normalizeScheduleWeekdays(weekdays)[0] ?? "MO";
}

function sortUniqueWeekdays(
  weekdays: readonly (typeof WEEKDAY_ORDER)[number][],
) {
  const order = new Map(WEEKDAY_ORDER.map((day, index) => [day, index]));
  return [...new Set(weekdays)].sort(
    (left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0),
  );
}

function areSameDays(
  left: readonly string[],
  right: readonly string[],
) {
  return (
    left.length === right.length && right.every((day) => left.includes(day))
  );
}

function formatMinuteIntervalSummary(intervalMinutes: number, t: TranslateFn) {
  if (intervalMinutes === 1) {
    return t("settings.automations.scheduleSummary.intervalMinute");
  }
  if (intervalMinutes === 60) {
    return t("settings.automations.scheduleSummary.intervalHourly");
  }
  if (intervalMinutes === 1_440) {
    return t("settings.automations.scheduleSummary.intervalDaily");
  }
  if (intervalMinutes === 10_080) {
    return t("settings.automations.scheduleSummary.intervalWeekly");
  }

  return t("settings.automations.scheduleSummary.intervalMinutes", {
    count: intervalMinutes,
  });
}

export function normalizeScheduleIntervalHours(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  return normalized < 1 ? null : normalized;
}

export function normalizeScheduleIntervalMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);
  return normalized < 1 ? null : normalized;
}

function areSamePath(left: string, right: string) {
  return normalizeComparablePath(left) === normalizeComparablePath(right);
}

function normalizeComparablePath(path: string) {
  return normalizePathForComparison(path).replace(/\/+$/, "").toLowerCase();
}

function formatScheduleTimeLabel(
  locale: string,
  hour: number | null,
  minute: number | null,
) {
  if (hour === null || minute === null) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2024, 0, 1, hour, minute));
}

function formatWeekdaySummary(
  weekdays: readonly string[],
  locale: string,
  t: TranslateFn,
) {
  if (weekdays.length === 0) {
    return null;
  }

  if (weekdays.length === 1) {
    return formatPluralWeekdayLabel(weekdays[0]!, t);
  }

  if (weekdays.length > 2 && areConsecutiveWeekdays(weekdays)) {
    const first = formatShortWeekdayLabel(weekdays[0], locale);
    const last = formatShortWeekdayLabel(weekdays[weekdays.length - 1], locale);
    return first && last ? `${first}-${last}` : null;
  }

  const formatter = new Intl.ListFormat(locale, { type: "conjunction" });
  const labels = weekdays
    .map((day) =>
      weekdays.length > 2
        ? formatShortWeekdayLabel(day, locale)
        : formatLongWeekdayLabel(day, locale),
    )
    .filter((value): value is string => value !== null);

  return labels.length > 0 ? formatter.format(labels) : null;
}

function areConsecutiveWeekdays(weekdays: readonly string[]) {
  const ordered = sortUniqueWeekdays(
    weekdays as readonly (typeof WEEKDAY_ORDER)[number][],
  );
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = WEEKDAY_ORDER.indexOf(ordered[index - 1]!);
    const current = WEEKDAY_ORDER.indexOf(ordered[index]!);
    if (previous < 0 || current !== previous + 1) {
      return false;
    }
  }

  return true;
}

function formatShortWeekdayLabel(day: string, locale: string) {
  const date = weekdayToDate(day);
  if (!date) {
    return null;
  }

  const shortLabel = new Intl.DateTimeFormat(locale, {
    weekday: "short",
  }).format(date);
  const longLabel = new Intl.DateTimeFormat(locale, {
    weekday: "long",
  }).format(date);

  return shortLabel.length >= longLabel.length
    ? new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(date)
    : shortLabel;
}

function formatLongWeekdayLabel(day: string, locale: string) {
  const date = weekdayToDate(day);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
}

function weekdayToDate(day: string) {
  const index = WEEKDAY_ORDER.indexOf(day as (typeof WEEKDAY_ORDER)[number]);
  if (index < 0) {
    return null;
  }

  return new Date(2024, 0, 7 + index);
}

function formatPluralWeekdayLabel(day: string, t: TranslateFn) {
  switch (day) {
    case "SU":
      return t("settings.automations.scheduleSummary.sundaysLabel");
    case "MO":
      return t("settings.automations.scheduleSummary.mondaysLabel");
    case "TU":
      return t("settings.automations.scheduleSummary.tuesdaysLabel");
    case "WE":
      return t("settings.automations.scheduleSummary.wednesdaysLabel");
    case "TH":
      return t("settings.automations.scheduleSummary.thursdaysLabel");
    case "FR":
      return t("settings.automations.scheduleSummary.fridaysLabel");
    case "SA":
      return t("settings.automations.scheduleSummary.saturdaysLabel");
    default:
      return null;
  }
}

export function hasAutomationRequiredFields(automation: AutomationRecord) {
  if (
    automation.name.trim().length === 0 ||
    automation.prompt.trim().length === 0 ||
    automation.rrule.trim().length === 0
  ) {
    return false;
  }

  if (automation.kind === "heartbeat") {
    return automation.targetThreadId.trim().length > 0;
  }

  return automation.executionEnvironment.trim().length > 0;
}

export function areAutomationsEqual(
  left: AutomationRecord | null,
  right: AutomationRecord | null,
) {
  if (left === right) {
    return true;
  }

  if (left === null || right === null) {
    return false;
  }

  if (
    left.id !== right.id ||
    left.kind !== right.kind ||
    left.name !== right.name ||
    left.prompt !== right.prompt ||
    left.status !== right.status ||
    left.rrule !== right.rrule
  ) {
    return false;
  }

  if (left.kind === "heartbeat" && right.kind === "heartbeat") {
    return left.targetThreadId === right.targetThreadId;
  }

  if (left.kind === "cron" && right.kind === "cron") {
    return (
      left.executionEnvironment === right.executionEnvironment &&
      left.localEnvironmentConfigPath === right.localEnvironmentConfigPath &&
      left.model === right.model &&
      left.reasoningEffort === right.reasoningEffort &&
      left.cwds.length === right.cwds.length &&
      left.cwds.every((cwd, index) => cwd === right.cwds[index])
    );
  }

  return false;
}
