import type { MessageKey } from "../../i18n/messages";
import type { AutomationStatus } from "../../services/automations";

const DAY_MS = 86_400_000;
const FUTURE_WEEKDAY_WINDOW_DAYS = 7;
const PAST_WEEKDAY_WINDOW_DAYS = -7;

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

type AutomationTimeFormatterArgs = {
  locale: string;
  nowMs?: number;
  t: Translate;
};

export function formatAutomationNextRunLabel({
  locale,
  nextRunAt,
  nowMs = Date.now(),
  status,
  t,
}: AutomationTimeFormatterArgs & {
  nextRunAt: number | null;
  status: AutomationStatus;
}) {
  if (status === "PAUSED") {
    return "-";
  }
  const timestamp = typeof nextRunAt === "number" && Number.isFinite(nextRunAt) ? nextRunAt : null;
  if (timestamp === null) {
    return t("inbox.automations.nextRun.none");
  }

  const date = new Date(timestamp);
  const now = new Date(nowMs);
  const dayDiff = diffCalendarDays(date, now);
  const timeLabel = formatDatePart(date, locale, { timeStyle: "short" });
  if (dayDiff === 0) {
    return t("inbox.automations.relativeDate.today", { time: timeLabel });
  }
  if (dayDiff === 1) {
    return t("inbox.automations.relativeDate.tomorrow", { time: timeLabel });
  }
  if (dayDiff > 1 && dayDiff < FUTURE_WEEKDAY_WINDOW_DAYS) {
    return t("inbox.automations.relativeDate.weekday", {
      time: timeLabel,
      weekday: formatDatePart(date, locale, { weekday: "long" }),
    });
  }

  return formatDatePart(date, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatAutomationLastRunLabel({
  lastRunAt,
  locale,
  nowMs = Date.now(),
  t,
}: AutomationTimeFormatterArgs & {
  lastRunAt: number | null;
}) {
  const timestamp = typeof lastRunAt === "number" && Number.isFinite(lastRunAt) ? lastRunAt : null;
  if (timestamp === null) {
    return t("inbox.automations.lastRun.none");
  }

  const date = new Date(timestamp);
  const now = new Date(nowMs);
  const dayDiff = diffCalendarDays(date, now);
  const timeLabel = formatDatePart(date, locale, { timeStyle: "short" });
  if (dayDiff === 0) {
    return t("inbox.automations.relativeDate.pastToday", { time: timeLabel });
  }
  if (dayDiff === -1) {
    return t("inbox.automations.relativeDate.yesterday", { time: timeLabel });
  }
  if (dayDiff < -1 && dayDiff > PAST_WEEKDAY_WINDOW_DAYS) {
    return t("inbox.automations.relativeDate.pastWeekday", {
      time: timeLabel,
      weekday: formatDatePart(date, locale, { weekday: "long" }),
    });
  }

  return formatDatePart(date, locale, { dateStyle: "medium", timeStyle: "short" });
}

export function formatHeartbeatAutomationTooltip({
  locale,
  nextRunAt,
  nowMs,
  status,
  t,
}: AutomationTimeFormatterArgs & {
  nextRunAt: number | null;
  status: AutomationStatus;
}) {
  return t("localConversation.header.heartbeatAutomationNextRun", {
    nextRunLabel: formatAutomationNextRunLabel({
      locale,
      nextRunAt,
      nowMs,
      status,
      t,
    }),
  });
}

function diffCalendarDays(target: Date, base: Date) {
  return Math.round((startOfDayMs(target) - startOfDayMs(base)) / DAY_MS);
}

function startOfDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatDatePart(date: Date, locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale, options).format(date);
}
