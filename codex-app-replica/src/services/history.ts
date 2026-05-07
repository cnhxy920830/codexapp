import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type ThreadHistoryEntry = {
  id: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  cwd: string;
  path: string | null;
  name: string | null;
};

export type HistoryThreadView = {
  id: string;
  title: string;
  age: string;
  active?: boolean;
};

export type HistoryProjectGroup = {
  name: string;
  threads: HistoryThreadView[];
};

export type ThreadConversationMessage = {
  type: "userMessage" | "agentMessage";
  id: string;
  turnId: string;
  role: "user" | "assistant";
  text: string;
};

export type ThreadConversationPlan = {
  type: "plan";
  id: string;
  turnId: string;
  text: string;
};

export type ThreadConversationTodoList = {
  type: "todoList";
  id: string;
  turnId: string;
  explanation: string | null;
  plan: Array<{
    step: string;
    status: string;
  }>;
};

export type ThreadConversationTurnDiff = {
  type: "turnDiff";
  id: string;
  turnId: string;
  unifiedDiff: string;
};

export type ThreadConversationModelRerouted = {
  type: "modelRerouted";
  id: string;
  turnId: string;
  fromModel: string;
  toModel: string;
  reason: string;
};

export type ThreadConversationModelChanged = {
  type: "modelChanged";
  id: string;
  turnId: string;
  fromModel: string;
  toModel: string;
};

export type ThreadConversationPersonalityChanged = {
  type: "personalityChanged";
  id: string;
  turnId: string;
  personality: string;
};

export type ThreadConversationForkedFromConversation = {
  type: "forkedFromConversation";
  id: string;
  turnId: string;
  sourceConversationId: string;
  sourceConversationTitle: string | null;
};

export type ThreadConversationRemoteTaskCreated = {
  type: "remoteTaskCreated";
  id: string;
  turnId: string;
  taskId: string;
};

export type ThreadConversationAutomaticApprovalReview = {
  type: "automaticApprovalReview";
  id: string;
  turnId: string;
  status: string;
  riskLevel: string | null;
  rationale: string | null;
};

export type ThreadConversationAutoReviewInterruptionWarning = {
  type: "autoReviewInterruptionWarning";
  id: string;
  turnId: string;
};

export type ThreadConversationSystemError = {
  type: "systemError";
  id: string;
  turnId: string;
  content: string;
};

export type ThreadConversationStreamError = {
  type: "streamError";
  id: string;
  turnId: string;
  content: string;
  additionalDetails: string | null;
};

export type ThreadConversationReasoning = {
  type: "reasoning";
  id: string;
  turnId: string;
  summary: string[];
  content: string[];
};

export type ThreadConversationHookPrompt = {
  type: "hookPrompt";
  id: string;
  turnId: string;
  fragments: Array<{
    text: string;
    hookRunId: string;
  }>;
};

export type ThreadCommandAction =
  | {
      type: "read";
      command: string;
      name: string;
      path: string;
    }
  | {
      type: "listFiles";
      command: string;
      path: string | null;
    }
  | {
      type: "search";
      command: string;
      query: string | null;
      path: string | null;
    }
  | {
      type: "unknown";
      command: string;
    };

export type ThreadConversationCommandExecution = {
  type: "commandExecution";
  id: string;
  turnId: string;
  command: string;
  cwd: string;
  status: string;
  commandActions: ThreadCommandAction[];
  aggregatedOutput: string | null;
  exitCode: number | null;
  durationMs: number | null;
};

export type ThreadConversation = {
  id: string;
  title: string;
  cwd: string;
  items: ThreadConversationItem[];
};

export type JsonRpcId = number | string;

export type ApprovalDecision = "accept" | "acceptForSession" | "decline" | "cancel";

export type ToolRequestUserInputQuestion = {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: Array<{
    label: string;
    description: string;
  }> | null;
};

export type ToolRequestUserInputAnswer = {
  answers: string[];
};

export type ToolRequestUserInputResponse = {
  answers: Record<string, ToolRequestUserInputAnswer>;
};

export type PermissionProfile = {
  network: { enabled: boolean | null } | null;
  fileSystem: {
    read: string[] | null;
    write: string[] | null;
    entries: Array<{
      path: string;
      access: "read" | "write" | "none" | string;
    }> | null;
  } | null;
};

export type GrantedPermissionProfile = {
  network?: { enabled: boolean | null };
  fileSystem?: {
    read: string[] | null;
    write: string[] | null;
    entries: Array<{
      path: string;
      access: "read" | "write" | "none" | string;
    }> | null;
  };
};

export type PermissionsRequestApprovalResponse = {
  permissions: GrantedPermissionProfile;
  scope: "turn" | "session";
  strictAutoReview?: boolean;
};

export type NetworkApprovalContext = {
  host: string;
  protocol: "http" | "https" | "socks5Tcp" | "socks5Udp" | string;
};

export type NetworkPolicyAmendment = {
  host: string;
  action: "allow" | "deny" | string;
};

export type CommandAction =
  | {
      type: "read";
      command: string;
      name: string;
      path: string;
    }
  | {
      type: "listFiles";
      command: string;
      path: string | null;
    }
  | {
      type: "search";
      command: string;
      query: string | null;
      path: string | null;
    }
  | {
      type: "unknown";
      command: string;
    };

export type McpServerElicitationRequest =
  | {
      mode: "form";
      message: string;
      meta: unknown;
      requestedSchema: {
        $schema?: string;
        type: string;
        properties: Record<string, unknown>;
        required?: string[];
      };
    }
  | {
      mode: "url";
      message: string;
      meta: unknown;
      url: string;
      elicitationId: string;
    };

export type McpServerElicitationRequestResponse = {
  action: "accept" | "decline" | "cancel";
  content: unknown | null;
  meta: unknown | null;
};

export type FileChangeSummary = {
  path: string;
  kind: string;
  diff: string | null;
  movePath: string | null;
};

export type ThreadConversationFileChange = {
  type: "fileChange";
  id: string;
  turnId: string;
  status: string;
  changes: FileChangeSummary[];
};

export type ThreadConversationMcpToolCall = {
  type: "mcpToolCall";
  id: string;
  turnId: string;
  server: string;
  tool: string;
  status: string;
  resultSummary: string | null;
  errorMessage: string | null;
};

export type ThreadConversationDynamicToolCall = {
  type: "dynamicToolCall";
  id: string;
  turnId: string;
  namespace: string | null;
  tool: string;
  status: string;
  resultSummary: string | null;
  success: boolean | null;
};

export type ThreadConversationCollabAgentState = {
  status: "pendingInit" | "running" | "interrupted" | "completed" | "errored" | "shutdown" | "notFound" | string;
  message: string | null;
};

export type ThreadConversationCollabAgentToolCall = {
  type: "collabAgentToolCall";
  id: string;
  turnId: string;
  tool: "spawnAgent" | "sendInput" | "resumeAgent" | "wait" | "closeAgent";
  status: string;
  senderThreadId: string;
  receiverThreadIds: string[];
  prompt: string | null;
  model: string | null;
  reasoningEffort: string | null;
  agentsStates: Record<string, ThreadConversationCollabAgentState>;
};

export type ThreadConversationReceiverThread = {
  threadId: string;
  thread: { id: string } | null;
};

export type ThreadConversationMultiAgentAction = {
  type: "multiAgentAction";
  id: string;
  turnId: string;
  action: Exclude<ThreadConversationCollabAgentToolCall["tool"], "wait">;
  status: string;
  senderThreadId: string;
  receiverThreads: ThreadConversationReceiverThread[];
  prompt: string | null;
  model: string | null;
  agentsStates: Record<string, ThreadConversationCollabAgentState>;
};

export type ThreadConversationWebSearchAction =
  | {
      type: "search";
      query: string | null;
      queries: string[] | null;
    }
  | {
      type: "openPage";
      url: string | null;
    }
  | {
      type: "findInPage";
      pattern: string | null;
      url: string | null;
    }
  | {
      type: "other";
    };

export type ThreadConversationWebSearch = {
  type: "webSearch";
  id: string;
  turnId: string;
  query: string;
  action: ThreadConversationWebSearchAction | null;
  completed: boolean;
};

export type ThreadConversationImageView = {
  type: "imageView";
  id: string;
  turnId: string;
  path: string;
};

export type ThreadConversationImageGeneration = {
  type: "imageGeneration";
  id: string;
  turnId: string;
  status: string;
  revisedPrompt: string | null;
  result: string;
  savedPath: string | null;
};

export type ThreadConversationContextCompaction = {
  type: "contextCompaction";
  id: string;
  turnId: string;
  isCompleted: boolean;
};

export type ThreadConversationEnteredReviewMode = {
  type: "enteredReviewMode";
  id: string;
  turnId: string;
  review: string;
};

export type ThreadConversationExitedReviewMode = {
  type: "exitedReviewMode";
  id: string;
  turnId: string;
  review: string;
};

export type ThreadConversationItem =
  | ThreadConversationMessage
  | ThreadConversationHookPrompt
  | ThreadConversationTodoList
  | ThreadConversationTurnDiff
  | ThreadConversationPersonalityChanged
  | ThreadConversationModelChanged
  | ThreadConversationModelRerouted
  | ThreadConversationForkedFromConversation
  | ThreadConversationRemoteTaskCreated
  | ThreadConversationAutomaticApprovalReview
  | ThreadConversationAutoReviewInterruptionWarning
  | ThreadConversationSystemError
  | ThreadConversationStreamError
  | ThreadConversationPlan
  | ThreadConversationReasoning
  | ThreadConversationCommandExecution
  | ThreadConversationFileChange
  | ThreadConversationMcpToolCall
  | ThreadConversationDynamicToolCall
  | ThreadConversationMultiAgentAction
  | ThreadConversationCollabAgentToolCall
  | ThreadConversationWebSearch
  | ThreadConversationImageView
  | ThreadConversationImageGeneration
  | ThreadConversationContextCompaction
  | ThreadConversationEnteredReviewMode
  | ThreadConversationExitedReviewMode;

export type ThreadEvent =
  | {
      type: "threadItemUpdated";
      threadId: string;
      turnId: string;
      item: ThreadConversationItem;
    }
  | {
      type: "turnCompleted";
      threadId: string;
      turnId: string;
      status: string;
      error: string | null;
    }
  | {
      type: "commandApprovalRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      reason: string | null;
      networkApprovalContext: NetworkApprovalContext | null;
      command: string | null;
      cwd: string | null;
      commandActions: CommandAction[] | null;
      additionalPermissions: PermissionProfile | null;
      proposedExecpolicyAmendment: string[] | null;
      proposedNetworkPolicyAmendments: NetworkPolicyAmendment[] | null;
      availableDecisions: ApprovalDecision[] | null;
    }
  | {
      type: "fileChangeApprovalRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      reason: string | null;
      grantRoot: string | null;
      changes: FileChangeSummary[];
    }
  | {
      type: "permissionsRequestApprovalRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      cwd: string;
      reason: string | null;
      permissions: PermissionProfile;
    }
  | {
      type: "mcpServerElicitationRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string | null;
      serverName: string;
      request: McpServerElicitationRequest;
    }
  | {
      type: "toolRequestUserInputRequested";
      requestId: JsonRpcId;
      threadId: string;
      turnId: string;
      itemId: string;
      questions: ToolRequestUserInputQuestion[];
    }
  | {
      type: "serverRequestResolved";
      requestId: JsonRpcId;
      threadId: string;
    };

export type ReviewDelivery = "inline" | "detached";

export type ReviewStartResponse = {
  turnId: string;
  reviewThreadId: string;
};

export async function getRecentThreads() {
  return invoke<ThreadHistoryEntry[]>("list_recent_threads");
}

export async function getArchivedThreads() {
  return invoke<ThreadHistoryEntry[]>("list_archived_threads");
}

export async function startThread(cwd: string | null) {
  return invoke<string>("start_thread", { cwd });
}

export async function forkThread(threadId: string) {
  return invoke<string>("fork_thread", { threadId });
}

export async function archiveThread(threadId: string) {
  return invoke<void>("archive_thread", { threadId });
}

export async function unarchiveThread(threadId: string) {
  return invoke<string>("unarchive_thread", { threadId });
}

export async function setThreadName(params: { threadId: string; name: string | null }) {
  return invoke<void>("set_thread_name", params);
}

export async function startTurn(params: { threadId: string; text: string; cwd: string | null }) {
  return invoke<string>("start_turn", params);
}

export async function startReview(params: { threadId: string; delivery: ReviewDelivery }) {
  return invoke<ReviewStartResponse>("start_review", { params });
}

export async function steerTurn(params: { threadId: string; turnId: string; text: string }) {
  return invoke<string>("steer_turn", params);
}

export async function interruptTurn(params: { threadId: string; turnId: string }) {
  return invoke<void>("interrupt_turn", params);
}

export async function respondToApprovalRequest(params: { requestId: JsonRpcId; decision: ApprovalDecision }) {
  return invoke<void>("respond_to_approval_request", params);
}

export async function respondToToolRequestUserInput(params: {
  requestId: JsonRpcId;
  response: ToolRequestUserInputResponse;
}) {
  return invoke<void>("respond_to_tool_request_user_input", params);
}

export async function respondToPermissionsRequestApproval(params: {
  requestId: JsonRpcId;
  response: PermissionsRequestApprovalResponse;
}) {
  return invoke<void>("respond_to_permissions_request_approval", params);
}

export async function respondToMcpServerElicitationRequest(params: {
  requestId: JsonRpcId;
  response: McpServerElicitationRequestResponse;
}) {
  return invoke<void>("respond_to_mcp_server_elicitation_request", params);
}

export async function readThread(threadId: string) {
  return invoke<ThreadConversation>("read_thread", { threadId }).then(normalizeThreadConversation);
}

export function onThreadEvent(handler: (event: ThreadEvent) => void) {
  return listen<ThreadEvent>("thread-event", (event) => {
    const normalizedEvent = normalizeThreadEvent(event.payload);
    if (normalizedEvent !== null) {
      handler(normalizedEvent);
    }
  });
}

export function buildProjectGroups(
  entries: ThreadHistoryEntry[],
  options?: { activeThreadId?: string | null; locale?: string; now?: Date; noMessageLabel?: string },
) {
  const now = options?.now ?? new Date();
  const activeThreadId = options?.activeThreadId ?? null;
  const locale = options?.locale ?? "en-US";
  const noMessageLabel = options?.noMessageLabel ?? "(no message yet)";
  const groups = new Map<string, HistoryProjectGroup>();

  for (const entry of entries) {
    const groupName = deriveProjectName(entry.cwd);
    const current = groups.get(groupName) ?? { name: groupName, threads: [] };
    current.threads.push({
      id: entry.id,
      title: (entry.name ?? entry.preview).trim() || noMessageLabel,
      age: formatRelativeTime(entry.updatedAt, now, locale),
      active: activeThreadId === entry.id,
    });
    groups.set(groupName, current);
  }

  return Array.from(groups.values());
}

function deriveProjectName(cwd: string) {
  const segments = cwd.split(/[/\\]+/).filter(Boolean);
  return segments.at(-1) ?? cwd;
}

function formatRelativeTime(unixSeconds: number, now: Date, locale: string) {
  const diffMs = now.getTime() - unixSeconds * 1000;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (diffMs < minute) {
    return formatter.format(0, "minute");
  }
  if (diffMs < hour) {
    return formatter.format(-Math.floor(diffMs / minute), "minute");
  }
  if (diffMs < day) {
    return formatter.format(-Math.floor(diffMs / hour), "hour");
  }
  return formatter.format(-Math.floor(diffMs / day), "day");
}

export function normalizeThreadConversation(thread: ThreadConversation): ThreadConversation {
  const items: ThreadConversationItem[] = [];
  for (const item of thread.items) {
    const normalizedItem = normalizeThreadConversationItem(item);
    if (normalizedItem !== null) {
      items.push(normalizedItem);
    }
  }

  return {
    ...thread,
    items,
  };
}

export function normalizeThreadConversationItem(item: ThreadConversationItem): ThreadConversationItem | null {
  if (item.type === "commandExecution") {
    return {
      ...item,
      commandActions: Array.isArray(item.commandActions) ? item.commandActions : [],
    };
  }

  if (item.type === "collabAgentToolCall") {
    return normalizeCollabAgentToolCall(item);
  }

  return item;
}

export function normalizeThreadEvent(event: ThreadEvent): ThreadEvent | null {
  if (event.type !== "threadItemUpdated") {
    return event;
  }

  const normalizedItem = normalizeThreadConversationItem(event.item);
  if (normalizedItem === null) {
    return null;
  }

  return {
    ...event,
    item: normalizedItem,
  };
}

function normalizeCollabAgentToolCall(
  item: ThreadConversationCollabAgentToolCall,
): ThreadConversationMultiAgentAction | null {
  if (item.tool === "wait") {
    return null;
  }

  const receiverThreadIds = Array.isArray(item.receiverThreadIds) ? item.receiverThreadIds : [];
  const agentsStates =
    item.agentsStates && typeof item.agentsStates === "object" && !Array.isArray(item.agentsStates)
      ? item.agentsStates
      : {};

  return {
    type: "multiAgentAction",
    id: item.id,
    turnId: item.turnId,
    action: item.tool,
    status: item.status,
    senderThreadId: item.senderThreadId,
    receiverThreads: receiverThreadIds.map((threadId) => ({
      threadId,
      thread: null,
    })),
    prompt: item.prompt,
    model: item.model,
    agentsStates,
  };
}
