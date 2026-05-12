import type { AutomationRecord, AutomationStatus } from "../../services/automations";
import type { MessageKey, MessageValues } from "../../i18n/messages";

export type FeedbackState =
  | {
      message: string;
      tone: "error" | "success";
    }
  | null;

export type TranslateFn = (key: MessageKey, values?: MessageValues) => string;

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
  t: TranslateFn,
) {
  if (automation.kind === "heartbeat") {
    return t("inbox.automations.rowSummary.heartbeat", {
      thread: threadNameById.get(automation.targetThreadId) ?? automation.targetThreadId,
    });
  }

  if (automation.cwds.length === 0) {
    return t("inbox.automations.workspaceFallback");
  }

  return automation.cwds.join(" · ");
}

export function formatScheduleSummary(automation: AutomationRecord, t: TranslateFn) {
  const value = automation.rrule.trim();
  return value.length > 0 ? value : t("settings.automations.rruleSummaryFallback");
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

export function formatErrorMessage(prefix: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  return `${prefix}: ${detail}`;
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
