import {
  forkConversationFromLatest,
  forkConversationFromTurn,
  setThreadGoal,
  setThreadName,
  startConversation,
  startThread,
  type TurnStartPermissionOverrides,
  type ThreadConversationUserInput,
} from "../../services/history";
import {
  setWorktreeOwnerThread,
} from "../../services/worktrees";
import type { PendingWorktreeEntry } from "../../services/pendingWorktrees";

export async function startPendingWorktreeConversationWithMetadata(
  entry: PendingWorktreeEntry,
  workspaceRoot: string,
) {
  const conversationId = await startPendingWorktreeConversation(entry, workspaceRoot);
  await applyStartedConversationMetadata(entry, conversationId);
  return conversationId;
}

async function startPendingWorktreeConversation(
  entry: PendingWorktreeEntry,
  workspaceRoot: string,
) {
  if (entry.launchMode === "fork-conversation") {
    const sourceConversationId = entry.sourceConversationId?.trim();
    if (!sourceConversationId) {
      throw new Error("Missing source conversation id.");
    }

    if (entry.targetTurnId !== null) {
      return forkConversationFromTurn({
        conversationId: sourceConversationId,
        targetTurnId: entry.targetTurnId,
        cwd: workspaceRoot,
      });
    }

    return forkConversationFromLatest({
      conversationId: sourceConversationId,
      cwd: workspaceRoot,
    });
  }

  if (entry.launchMode !== "start-conversation") {
    throw new Error(`Unsupported launch mode: ${entry.launchMode}`);
  }

  const input = normalizePendingConversationInput(entry.startConversationParamsInput, entry.prompt);
  const permissionOverrides = normalizePendingConversationPermissionOverrides(
    entry.startConversationParamsInput,
  );

  if (input.length > 0) {
    return startConversation({
      hostId: entry.hostId,
      input,
      text: entry.prompt,
      cwd: workspaceRoot,
      workspaceRoots: [workspaceRoot],
      skipAutoTitleGeneration: entry.initialThreadTitle != null,
      ...permissionOverrides,
    });
  }

  return startThread(workspaceRoot);
}

async function applyStartedConversationMetadata(
  entry: PendingWorktreeEntry,
  conversationId: string,
) {
  if (entry.worktreeGitRoot !== null) {
    await setWorktreeOwnerThread({
      hostId: entry.hostId,
      worktree: entry.worktreeGitRoot,
      conversationId,
    }).catch(() => undefined);
  }

  if (entry.threadGoalObjective !== null) {
    await setThreadGoal({
      threadId: conversationId,
      objective: entry.threadGoalObjective,
      hostId: entry.hostId,
    });
  }

  const title = (entry.initialThreadTitle ?? (entry.labelEdited ? entry.label ?? "" : "")).trim();
  if (title.length > 0) {
    await setThreadName({
      threadId: conversationId,
      name: title,
    });
  }
}

function normalizePendingConversationInput(
  value: Record<string, unknown> | null,
  fallbackPrompt: string,
): ThreadConversationUserInput[] {
  const input = Array.isArray(value?.input) ? value.input : null;
  if (input === null) {
    return fallbackPrompt.trim().length > 0
      ? [{ type: "text", text: fallbackPrompt, textElements: [] }]
      : [];
  }

  const normalized = input
    .map(normalizePendingConversationInputItem)
    .filter((item): item is ThreadConversationUserInput => item !== null);
  if (normalized.length > 0) {
    return normalized;
  }

  return fallbackPrompt.trim().length > 0
    ? [{ type: "text", text: fallbackPrompt, textElements: [] }]
    : [];
}

function normalizePendingConversationInputItem(value: unknown): ThreadConversationUserInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "text":
      return {
        type: "text",
        text: typeof record.text === "string" ? record.text : "",
        textElements: [],
      };
    case "image":
      return typeof record.url === "string" ? { type: "image", url: record.url } : null;
    case "localImage":
      return typeof record.path === "string" ? { type: "localImage", path: record.path } : null;
    case "skill":
      return typeof record.name === "string" && typeof record.path === "string"
        ? { type: "skill", name: record.name, path: record.path }
        : null;
    case "mention":
      return typeof record.name === "string" && typeof record.path === "string"
        ? { type: "mention", name: record.name, path: record.path }
        : null;
    default:
      return null;
  }
}

function normalizePendingConversationPermissionOverrides(
  value: Record<string, unknown> | null,
): TurnStartPermissionOverrides {
  return {
    approvalPolicy: normalizePendingConversationApprovalPolicy(value?.approvalPolicy),
    approvalsReviewer:
      typeof value?.approvalsReviewer === "string" && value.approvalsReviewer.trim().length > 0
        ? value.approvalsReviewer.trim()
        : null,
    sandboxPolicy: normalizePendingConversationSandboxPolicy(value?.sandboxPolicy),
  };
}

function normalizePendingConversationApprovalPolicy(value: unknown) {
  if (
    value === "untrusted" ||
    value === "on-failure" ||
    value === "on-request" ||
    value === "never"
  ) {
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const granularValue = (value as Record<string, unknown>).granular;
  if (!granularValue || typeof granularValue !== "object" || Array.isArray(granularValue)) {
    return null;
  }
  const granularRecord = granularValue as Record<string, unknown>;

  return {
    granular: {
      sandbox_approval: granularRecord.sandbox_approval === true,
      rules: granularRecord.rules === true,
      skill_approval: granularRecord.skill_approval === true,
      request_permissions: granularRecord.request_permissions === true,
      mcp_elicitations: granularRecord.mcp_elicitations === true,
    },
  };
}

function normalizePendingConversationSandboxPolicy(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "readOnly":
      return {
        type: "readOnly" as const,
        networkAccess: record.networkAccess === true,
      };
    case "workspaceWrite":
      return {
        type: "workspaceWrite" as const,
        writableRoots: Array.isArray(record.writableRoots)
          ? record.writableRoots.filter(
              (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
            )
          : [],
        excludeSlashTmp: record.excludeSlashTmp === true,
        excludeTmpdirEnvVar: record.excludeTmpdirEnvVar === true,
        networkAccess: record.networkAccess === true,
      };
    case "dangerFullAccess":
      return {
        type: "dangerFullAccess" as const,
      };
    default:
      return null;
  }
}
