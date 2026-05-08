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
  completed: boolean;
  images?: string[];
  attachments?: Array<{
    label: string;
    path: string;
  }>;
  comments?: Array<{
    path: string;
    lineRange?: string | null;
    body: string;
  }>;
  referencesPriorConversation?: boolean;
  reviewMode?: boolean;
  pullRequestFixMode?: boolean;
  autoResolveSync?: boolean;
  pullRequestCheckCount?: number | null;
  steeringStatus?: "pending" | "accepted";
};

export type ThreadConversationSteeringUserMessage = {
  type: "steeringUserMessage";
  id: string;
  turnId: string;
  status: "pending" | "accepted";
  text: string;
  cwd: string | null;
};

export type ThreadConversationSteered = {
  type: "steered";
  id: string;
  turnId: string;
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

export type ThreadConversationHookOutputEntry = {
  kind: "warning" | "stop" | "feedback" | "context" | "error" | string;
  text: string;
};

export type ThreadConversationHook = {
  type: "hook";
  id: string;
  turnId: string;
  eventName: "preToolUse" | "permissionRequest" | "postToolUse" | "sessionStart" | "userPromptSubmit" | "stop" | string;
  status: "running" | "completed" | "failed" | "blocked" | "stopped" | string;
  statusMessage: string | null;
  sourcePath: string | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  entries: ThreadConversationHookOutputEntry[];
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
  turns: ThreadConversationTurn[];
  turnTimings: ThreadConversationTurnTiming[];
  items: ThreadConversationItem[];
};

export type ThreadConversationTurn = {
  id: string;
  status: string;
  input: ThreadConversationUserInput[];
};

export type ThreadConversationTurnTiming = {
  turnId: string;
  status: string;
  turnStartedAtMs: number | null;
  finalAssistantStartedAtMs: number | null;
  firstTurnWorkItemStartedAtMs: number | null;
};

export type ThreadConversationTextElement = {
  byteRange: {
    start: number;
    end: number;
  };
  placeholder: string | null;
};

export type ThreadConversationUserInput =
  | {
      type: "text";
      text: string;
      textElements: ThreadConversationTextElement[];
    }
  | {
      type: "image";
      url: string;
    }
  | {
      type: "localImage";
      path: string;
    }
  | {
      type: "skill";
      name: string;
      path: string;
    }
  | {
      type: "mention";
      name: string;
      path: string;
    };

export type ThreadConversationWorkedFor = {
  type: "workedFor";
  id: string;
  turnId: string;
  status: "working" | "worked";
  startedAtMs: number;
  completedAtMs: number | null;
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
  arguments: unknown;
  result: unknown | null;
  error: unknown | null;
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
  arguments: unknown | null;
  contentItems: unknown[];
};

export type ThreadConversationAutomationSnapshot = {
  kind: "cron" | "heartbeat";
  name: string;
  rrule: string;
};

export type ThreadConversationAutomationUpdateResult = {
  automationId: string;
  mode: "create" | "update" | "delete" | null;
  deleteStatus?: "deleted" | "not_found";
  snapshot?: ThreadConversationAutomationSnapshot | null;
};

export type ThreadConversationAutomationUpdateArguments =
  | {
      id?: string;
      mode:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "suggested_create"
        | "suggested_update";
      kind?: "cron" | "heartbeat";
      name?: string;
      prompt?: string;
      rrule?: string;
      cwds?: string[];
      destination?: "local" | "worktree" | "thread";
      executionEnvironment?: "worktree" | "local";
      localEnvironmentConfigPath?: string | null;
      model?: string;
      reasoningEffort?: string;
      targetThreadId?: string;
      status?: "ACTIVE" | "PAUSED";
    }
  | null;

export type ThreadConversationAutomationUpdate = {
  type: "automationUpdate";
  id: string;
  turnId: string;
  arguments: ThreadConversationAutomationUpdateArguments;
  result: ThreadConversationAutomationUpdateResult | null;
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
  source: string;
};

export type ThreadConversationPlanImplementation = {
  type: "planImplementation";
  id: string;
  turnId: string;
  planContent: string;
  isCompleted: boolean;
};

export type ThreadConversationPermissionRequest = {
  type: "permissionRequest";
  id: string;
  turnId: string;
  requestId: JsonRpcId;
  itemId: string;
  cwd: string;
  reason: string | null;
  permissions: PermissionProfile;
  completed: boolean;
  response: PermissionsRequestApprovalResponse | null;
};

export type ThreadConversationMcpServerElicitation = {
  type: "mcpServerElicitation";
  id: string;
  turnId: string | null;
  requestId: JsonRpcId;
  serverName: string;
  request: McpServerElicitationRequest;
  completed: boolean;
  action: McpServerElicitationRequestResponse["action"] | null;
  content: unknown | null;
};

export type ThreadConversationUserInputRequest = {
  type: "userInput";
  id: string;
  turnId: string;
  requestId: JsonRpcId;
  itemId: string;
  questions: ToolRequestUserInputQuestion[];
  completed: boolean;
};

export type ThreadConversationUserInputResponse = {
  type: "userInputResponse";
  id: string;
  turnId: string;
  requestId: JsonRpcId | null;
  questionsAndAnswers: Array<{
    id: string;
    header: string;
    question: string;
    answers: string[];
  }>;
  completed: boolean;
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
  | ThreadConversationSteeringUserMessage
  | ThreadConversationSteered
  | ThreadConversationHook
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
  | ThreadConversationAutomationUpdate
  | ThreadConversationMultiAgentAction
  | ThreadConversationCollabAgentToolCall
  | ThreadConversationWebSearch
  | ThreadConversationImageView
  | ThreadConversationImageGeneration
  | ThreadConversationContextCompaction
  | ThreadConversationPlanImplementation
  | ThreadConversationPermissionRequest
  | ThreadConversationMcpServerElicitation
  | ThreadConversationUserInputRequest
  | ThreadConversationWorkedFor
  | ThreadConversationUserInputResponse
  | ThreadConversationEnteredReviewMode
  | ThreadConversationExitedReviewMode;

export type ThreadEvent =
  | {
      type: "threadItemUpdated";
      threadId: string;
      turnId: string;
      phase: "started" | "completed";
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

export async function startTurnWithInput(params: {
  threadId: string;
  input: ThreadConversationUserInput[];
  cwd: string | null;
}) {
  return invoke<string>("start_turn_with_input", params);
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

export async function rollbackThread(params: { threadId: string; numTurns: number }) {
  return invoke<ThreadConversation>("rollback_thread", params).then(normalizeThreadConversation);
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
    turns: Array.isArray(thread.turns)
      ? thread.turns.map((turn) => ({
          ...turn,
          input: Array.isArray(turn.input)
            ? turn.input
                .map(normalizeThreadConversationUserInput)
                .filter((input): input is ThreadConversationUserInput => input !== null)
            : [],
        }))
      : [],
    turnTimings: Array.isArray(thread.turnTimings) ? thread.turnTimings : [],
    items,
  };
}

function normalizeThreadConversationUserInput(
  input: ThreadConversationUserInput,
): ThreadConversationUserInput | null {
  if (!input || typeof input !== "object" || typeof input.type !== "string") {
    return null;
  }

  if (input.type === "text") {
    return {
      ...input,
      text: typeof input.text === "string" ? input.text : "",
      textElements: Array.isArray(input.textElements)
        ? input.textElements
            .map((element) => ({
              byteRange: {
                start:
                  typeof element?.byteRange?.start === "number" && Number.isFinite(element.byteRange.start)
                    ? element.byteRange.start
                    : 0,
                end:
                  typeof element?.byteRange?.end === "number" && Number.isFinite(element.byteRange.end)
                    ? element.byteRange.end
                    : 0,
              },
              placeholder: typeof element?.placeholder === "string" ? element.placeholder : null,
            }))
            .filter((element) => element.byteRange.end >= element.byteRange.start)
        : [],
    };
  }

  if (input.type === "image") {
    return typeof input.url === "string" ? input : null;
  }
  if (input.type === "localImage") {
    return typeof input.path === "string" ? input : null;
  }
  if (input.type === "skill" || input.type === "mention") {
    return typeof input.name === "string" && typeof input.path === "string" ? input : null;
  }

  return null;
}

export function normalizeThreadConversationItem(item: ThreadConversationItem): ThreadConversationItem | null {
  if (item.type === "hook") {
    return {
      ...item,
      statusMessage: item.statusMessage ?? null,
      sourcePath: item.sourcePath ?? null,
      startedAt: typeof item.startedAt === "number" ? item.startedAt : null,
      completedAt: typeof item.completedAt === "number" ? item.completedAt : null,
      durationMs: typeof item.durationMs === "number" ? item.durationMs : null,
      entries: Array.isArray(item.entries) ? item.entries : [],
    };
  }

  if (item.type === "commandExecution") {
    return {
      ...item,
      commandActions: Array.isArray(item.commandActions) ? item.commandActions : [],
    };
  }

  if (item.type === "collabAgentToolCall") {
    return normalizeCollabAgentToolCall(item);
  }

  if (item.type === "dynamicToolCall") {
    return normalizeDynamicToolCall(item);
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

function normalizeDynamicToolCall(
  item: ThreadConversationDynamicToolCall,
): ThreadConversationAutomationUpdate | ThreadConversationDynamicToolCall | null {
  if (isAutomationUpdateDynamicToolCall(item)) {
    const argumentsValue = parseAutomationUpdateArguments(item.arguments);
    if (argumentsValue !== null) {
      return {
        type: "automationUpdate",
        id: item.id,
        turnId: item.turnId,
        arguments: argumentsValue,
        result: parseAutomationUpdateResult(item.contentItems),
      };
    }
  }

  if (item.tool === "automation_update" || item.tool === "load_workspace_dependencies") {
    return null;
  }

  return {
    ...item,
    arguments: item.arguments ?? null,
    contentItems: Array.isArray(item.contentItems) ? item.contentItems : [],
  };
}

function isAutomationUpdateDynamicToolCall(item: ThreadConversationDynamicToolCall) {
  return item.tool === "automation_update" && item.status === "completed" && item.success === true;
}

function parseAutomationUpdateArguments(value: unknown): ThreadConversationAutomationUpdateArguments {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const mode = normalizeAutomationUpdateMode(record.mode);
  if (mode === null) {
    return null;
  }

  const normalized: NonNullable<ThreadConversationAutomationUpdateArguments> = { mode };
  const id = asNonEmptyString(record.id);
  if (id !== null) {
    normalized.id = id;
  }
  const kind = normalizeAutomationUpdateKind(record.kind);
  if (kind !== null) {
    normalized.kind = kind;
  }
  const name = asNonEmptyString(record.name);
  if (name !== null) {
    normalized.name = name;
  }
  const prompt = asNonEmptyString(record.prompt);
  if (prompt !== null) {
    normalized.prompt = prompt;
  }
  const rrule = asNonEmptyString(record.rrule);
  if (rrule !== null) {
    normalized.rrule = rrule;
  }
  const cwds = asNonEmptyStringArray(record.cwds);
  if (cwds !== null) {
    normalized.cwds = cwds;
  }
  const destination = normalizeAutomationUpdateDestination(record.destination);
  if (destination !== null) {
    normalized.destination = destination;
  }
  const executionEnvironment = normalizeAutomationUpdateExecutionEnvironment(record.executionEnvironment);
  if (executionEnvironment !== null) {
    normalized.executionEnvironment = executionEnvironment;
  }
  if (record.localEnvironmentConfigPath === null) {
    normalized.localEnvironmentConfigPath = null;
  } else {
    const localEnvironmentConfigPath = asNonEmptyString(record.localEnvironmentConfigPath);
    if (localEnvironmentConfigPath !== null) {
      normalized.localEnvironmentConfigPath = localEnvironmentConfigPath;
    }
  }
  const model = asNonEmptyString(record.model);
  if (model !== null) {
    normalized.model = model;
  }
  const reasoningEffort = asNonEmptyString(record.reasoningEffort);
  if (reasoningEffort !== null) {
    normalized.reasoningEffort = reasoningEffort;
  }
  const targetThreadId = asNonEmptyString(record.targetThreadId);
  if (targetThreadId !== null) {
    normalized.targetThreadId = targetThreadId;
  }
  const status = normalizeAutomationUpdateStatus(record.status);
  if (status !== null) {
    normalized.status = status;
  }

  return normalized;
}

function parseAutomationUpdateResult(
  contentItems: unknown[],
): ThreadConversationAutomationUpdateResult | null {
  for (const item of contentItems) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.type !== "inputText") {
      continue;
    }
    const text = typeof record.text === "string" ? record.text.trim() : "";
    if (!looksLikeJsonObject(text)) {
      continue;
    }
    try {
      const parsed = JSON.parse(text) as unknown;
      const result = normalizeAutomationUpdateResult(parsed);
      if (result !== null) {
        return result;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function normalizeAutomationUpdateResult(value: unknown): ThreadConversationAutomationUpdateResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const automationId = asNonEmptyString(record.automationId);
  if (automationId === null) {
    return null;
  }

  const normalized: ThreadConversationAutomationUpdateResult = {
    automationId,
    mode: normalizeAutomationMutationMode(record.mode),
  };

  const deleteStatus = normalizeAutomationDeleteStatus(record.deleteStatus);
  if (deleteStatus !== null) {
    normalized.deleteStatus = deleteStatus;
  }

  if (record.snapshot === null) {
    normalized.snapshot = null;
  } else {
    const snapshot = normalizeAutomationSnapshot(record.snapshot);
    if (snapshot !== null) {
      normalized.snapshot = snapshot;
    }
  }

  return normalized;
}

function normalizeAutomationSnapshot(value: unknown): ThreadConversationAutomationSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const kind = normalizeAutomationUpdateKind(record.kind);
  const name = asNonEmptyString(record.name);
  const rrule = asNonEmptyString(record.rrule);
  if (kind === null || name === null || rrule === null) {
    return null;
  }

  return {
    kind,
    name,
    rrule,
  };
}

function looksLikeJsonObject(value: string) {
  return value.startsWith("{") && value.endsWith("}");
}

function asNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function asNonEmptyStringArray(value: unknown) {
  if (Array.isArray(value)) {
    const items = value.map(asNonEmptyString).filter((item): item is string => item !== null);
    return items.length > 0 ? items : [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.map(asNonEmptyString).filter((item): item is string => item !== null);
      }
    } catch {
      return trimmed
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
  }

  return null;
}

function normalizeAutomationUpdateMode(value: unknown) {
  switch (value) {
    case "view":
    case "create":
    case "update":
    case "delete":
    case "suggested_create":
    case "suggested_update":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationMutationMode(value: unknown) {
  switch (value) {
    case "create":
    case "update":
    case "delete":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationUpdateKind(value: unknown) {
  switch (value) {
    case "cron":
    case "heartbeat":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationUpdateDestination(value: unknown) {
  switch (value) {
    case "local":
    case "worktree":
    case "thread":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationUpdateExecutionEnvironment(value: unknown) {
  switch (value) {
    case "worktree":
    case "local":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationUpdateStatus(value: unknown) {
  switch (value) {
    case "ACTIVE":
    case "PAUSED":
      return value;
    default:
      return null;
  }
}

function normalizeAutomationDeleteStatus(value: unknown) {
  switch (value) {
    case "deleted":
    case "not_found":
      return value;
    default:
      return null;
  }
}
