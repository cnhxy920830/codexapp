import type { MessageKey } from "../../i18n/messages";
import type {
  ThreadConversationCollabAgentToolCall,
  FileChangeSummary,
  ThreadConversation,
  ThreadConversationCommandExecution,
  ThreadConversationContextCompaction,
  ThreadConversationDynamicToolCall,
  ThreadConversationFileChange,
  ThreadConversationForkedFromConversation,
  ThreadConversationHookPrompt,
  ThreadConversationImageView,
  ThreadConversationImageGeneration,
  ThreadConversationItem,
  ThreadConversationModelChanged,
  ThreadConversationPersonalityChanged,
  ThreadConversationModelRerouted,
  ThreadConversationMcpToolCall,
  ThreadConversationMessage,
  ThreadConversationPlan,
  ThreadConversationReasoning,
  ThreadConversationTodoList,
  ThreadConversationTurnDiff,
  ThreadConversationWebSearch,
} from "../../services/history";
import type {
  PendingApproval,
  PendingMcpServerElicitationRequest,
  PendingPermissionsRequestApproval,
  PendingToolRequestUserInput,
  PlanImplementationItem,
} from "./threadConversationState";
import {
  attachTurnScopedItemsToRenderableConversationGroups,
  buildRenderableConversationGroups,
} from "./renderableConversationGroups";
import {
  type ExplorationGroupItem,
  type MultiAgentGroupItem,
  type WebSearchGroupItem,
} from "./renderableConversationItems";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;
type MarkdownConversationItem =
  | ThreadConversationItem
  | ExplorationGroupItem
  | MultiAgentGroupItem
  | WebSearchGroupItem
  | PlanImplementationItem
  | PendingApproval
  | PendingMcpServerElicitationRequest
  | PendingPermissionsRequestApproval
  | PendingToolRequestUserInput;

type ConversationMarkdownPendingRequests = {
  approvals?: PendingApproval[];
  mcpRequests?: PendingMcpServerElicitationRequest[];
  permissionsRequests?: PendingPermissionsRequestApproval[];
  userInputRequests?: PendingToolRequestUserInput[];
};

export function renderConversationMarkdown(
  threadConversation: ThreadConversation,
  t: Translate,
  planImplementationItems: PlanImplementationItem[] = [],
  pendingRequests: ConversationMarkdownPendingRequests = {},
) {
  const sections = [`# ${sanitizeHeading(threadConversation.title || "Codex conversation")}`];
  const items = buildMarkdownConversationItems(threadConversation.items, planImplementationItems, pendingRequests);

  for (const item of items) {
    const rendered = renderConversationItem(item, t);
    if (rendered) {
      sections.push(rendered);
    }
  }

  return `${sections.join("\n\n").trimEnd()}\n`;
}

function buildMarkdownConversationItems(
  items: ThreadConversationItem[],
  planImplementationItems: PlanImplementationItem[],
  pendingRequests: ConversationMarkdownPendingRequests,
) {
  const groups = buildRenderableConversationGroups(items);
  const groupedConversation = attachTurnScopedItemsToRenderableConversationGroups(groups, {
    approvalItems: pendingRequests.approvals ?? [],
    mcpServerElicitationItems: pendingRequests.mcpRequests ?? [],
    permissionRequestItems: pendingRequests.permissionsRequests ?? [],
    planImplementationItems,
    userInputItems: pendingRequests.userInputRequests ?? [],
  });

  const mergedItems: MarkdownConversationItem[] = [];
  for (const group of groupedConversation.groups) {
    mergedItems.push(...group.preUserItems);
    mergedItems.push(...group.userItems);
    mergedItems.push(...group.activityItems);
    if (group.assistantMessage) {
      mergedItems.push(group.assistantMessage);
    }
    mergedItems.push(...group.toolOutputItems);
    mergedItems.push(...group.postAssistantItems);
    if (group.systemEventItem) {
      mergedItems.push(group.systemEventItem);
    }
    if (group.unifiedDiffItem) {
      mergedItems.push(group.unifiedDiffItem);
    }
    mergedItems.push(...group.remoteTaskCreatedItems);
    mergedItems.push(...group.personalityChangedItems);
    mergedItems.push(...group.forkedFromConversationItems);
    mergedItems.push(...group.modelChangedItems);
    mergedItems.push(...group.modelReroutedItems);
    if (group.todoListItem) {
      mergedItems.push(group.todoListItem);
    }
    mergedItems.push(...group.proposedPlanItems);
    mergedItems.push(...group.planImplementationItems);
    mergedItems.push(...group.mcpServerElicitationItems);
    mergedItems.push(...group.permissionRequestItems);
    mergedItems.push(...group.approvalItems);
    mergedItems.push(...group.userInputItems);
  }

  mergedItems.push(...groupedConversation.unmatchedPlanImplementationItems);
  mergedItems.push(...groupedConversation.unmatchedMcpServerElicitationItems);
  mergedItems.push(...groupedConversation.unmatchedPermissionRequestItems);
  mergedItems.push(...groupedConversation.unmatchedApprovalItems);
  mergedItems.push(...groupedConversation.unmatchedUserInputItems);

  return mergedItems;
}

function renderConversationItem(item: MarkdownConversationItem, t: Translate): string | null {
  if ("threadId" in item && "planContent" in item) {
    return renderPlanImplementation(item, t);
  }
  if (item.type === "commandApprovalRequested" || item.type === "fileChangeApprovalRequested") {
    return renderPendingApproval(item);
  }
  if (item.type === "permissionsRequestApprovalRequested") {
    return renderPendingPermissionsRequest(item);
  }
  if (item.type === "mcpServerElicitationRequested") {
    return renderPendingMcpRequest(item);
  }
  if (item.type === "toolRequestUserInputRequested") {
    return renderPendingUserInputRequest(item);
  }

  switch (item.type) {
    case "userMessage":
      return renderUserMessage(item);
    case "agentMessage":
      return renderAgentMessage(item);
    case "hookPrompt":
      return renderHookPrompt(item, t);
    case "todoList":
      return renderTodoList(item);
    case "turnDiff":
      return renderTurnDiff(item);
    case "remoteTaskCreated":
      return renderRemoteTaskCreated(item);
    case "personalityChanged":
      return renderPersonalityChanged(item);
    case "modelChanged":
      return renderModelChanged(item, t);
    case "modelRerouted":
      return renderModelRerouted(item);
    case "forkedFromConversation":
      return renderForkedFromConversation(item);
    case "plan":
      return renderPlan(item);
    case "reasoning":
      return renderReasoning(item, t);
    case "commandExecution":
      return renderCommandExecution(item);
    case "explorationGroup":
      return renderExplorationGroup(item, t);
    case "multiAgentGroup":
      return renderMultiAgentGroup(item, t);
    case "fileChange":
      return renderFileChange(item);
    case "mcpToolCall":
      return renderMcpToolCall(item, t);
    case "dynamicToolCall":
      return renderDynamicToolCall(item, t);
    case "automaticApprovalReview":
      return renderAutomaticApprovalReview(item);
    case "autoReviewInterruptionWarning":
      return null;
    case "systemError":
      return renderSystemError(item);
    case "streamError":
      return renderStreamError(item);
    case "webSearch":
      return renderWebSearch(item);
    case "webSearchGroup":
      return renderWebSearchGroup(item);
    case "imageView":
      return renderImageView(item);
    case "imageGeneration":
      return renderImageGeneration(item, t);
    case "collabAgentToolCall":
      return renderCollabAgentToolCall(item, t);
    case "contextCompaction":
      return renderContextCompaction(item, t);
    case "enteredReviewMode":
      return renderDetails("Code review", formatReviewModeLabel(item.review, t));
    case "exitedReviewMode":
      return renderDetails("Code review", normalizeText(item.review));
    default:
      return null;
  }
}

function renderUserMessage(item: ThreadConversationMessage) {
  const text = normalizeText(item.text);
  if (text.length === 0) {
    return null;
  }
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? ">" : `> ${line}`))
    .join("\n");
}

function renderAgentMessage(item: ThreadConversationMessage) {
  const text = normalizeText(item.text);
  if (text.length === 0) {
    return null;
  }
  return escapeDetailsTags(text);
}

function renderHookPrompt(item: ThreadConversationHookPrompt, t: Translate) {
  const fragments = item.fragments.map((fragment) => normalizeText(fragment.text).trim()).filter((text) => text.length > 0);
  if (fragments.length === 0) {
    return null;
  }
  return renderDetails(t("app.chat.hookPrompt"), fragments.join("\n\n"));
}

function renderPlan(item: ThreadConversationPlan) {
  const text = normalizeText(item.text).trim();
  if (text.length === 0) {
    return null;
  }
  return renderDetails("Plan", text);
}

function renderTodoList(item: ThreadConversationTodoList) {
  const sections: string[] = [];
  const explanation = item.explanation ? normalizeText(item.explanation).trim() : "";
  if (explanation.length > 0) {
    sections.push(explanation);
  }
  const steps = item.plan
    .map((entry) => {
      const step = normalizeText(entry.step).trim();
      if (step.length === 0) {
        return null;
      }
      return `- [${todoListStepCheckmark(entry.status)}] ${step}`;
    })
    .filter((entry): entry is string => entry !== null);
  if (steps.length > 0) {
    sections.push(steps.join("\n"));
  }
  if (sections.length === 0) {
    return null;
  }
  return renderDetails("Plan", sections.join("\n\n"));
}

function renderTurnDiff(item: ThreadConversationTurnDiff) {
  const unifiedDiff = normalizeText(item.unifiedDiff).trimEnd();
  if (unifiedDiff.trim().length === 0) {
    return null;
  }
  return renderDetails("Diff", renderCodeBlock("diff", unifiedDiff));
}

function renderModelRerouted(item: ThreadConversationModelRerouted) {
  const transition = `${normalizeText(item.fromModel).trim()} -> ${normalizeText(item.toModel).trim()}`.trim();
  const sections = [transition];
  const reason = normalizeText(item.reason).trim();
  if (reason.length > 0) {
    sections.push(`Reason: ${reason}`);
  }
  const filteredSections = sections.filter((section) => section.trim().length > 0);
  if (filteredSections.length === 0) {
    return null;
  }
  return renderDetails("Model rerouted", filteredSections.join("\n\n"));
}

function renderModelChanged(item: ThreadConversationModelChanged, t: Translate) {
  const fromModel = normalizeText(item.fromModel).trim();
  const toModel = normalizeText(item.toModel).trim();
  if (fromModel.length === 0 || toModel.length === 0) {
    return null;
  }
  return renderDetails("Model changed", t("localConversation.modelChanged", { fromModel, toModel }));
}

function renderPersonalityChanged(item: ThreadConversationPersonalityChanged) {
  const personality = normalizeText(item.personality).trim();
  if (personality.length === 0) {
    return null;
  }
  return renderDetails("Personality changed", `Personality: ${personality}`);
}

function renderForkedFromConversation(item: ThreadConversationForkedFromConversation) {
  const sourceConversationId = normalizeText(item.sourceConversationId).trim();
  if (sourceConversationId.length === 0) {
    return null;
  }
  return renderDetails("Forked conversation", `Source conversation: ${sourceConversationId}`);
}

function renderRemoteTaskCreated(item: Extract<ThreadConversationItem, { type: "remoteTaskCreated" }>) {
  const taskId = normalizeText(item.taskId).trim();
  if (taskId.length === 0) {
    return null;
  }
  return renderDetails("Remote task created", `Task ID: ${taskId}`);
}

function renderReasoning(item: ThreadConversationReasoning, t: Translate) {
  const sections = [...item.summary, ...item.content].map(normalizeText).filter((line) => line.trim().length > 0);
  if (sections.length === 0) {
    return null;
  }
  return renderDetails(t("thinkingShimmer.default"), sections.join("\n\n"));
}

function renderPlanImplementation(item: PlanImplementationItem, t: Translate) {
  const text = normalizeText(item.planContent).trim();
  const sections = [item.isCompleted ? t("app.chat.status.completed") : t("app.chat.status.inProgress")];
  if (text.length > 0) {
    sections.push(text);
  }
  return renderDetails(t("app.chat.planImplementation"), sections.join("\n\n"));
}

function renderPendingApproval(item: PendingApproval) {
  const title = item.type === "commandApprovalRequested" ? "Command approval request" : "File change approval request";
  const sections: string[] = ["Status: pending"];
  const reason = item.reason ? normalizeText(item.reason).trim() : "";
  if (reason.length > 0) {
    sections.push(`Reason: ${reason}`);
  }
  if (item.type === "commandApprovalRequested") {
    const command = item.command ? normalizeText(item.command).trim() : "";
    if (command.length > 0) {
      sections.push(`Command: ${command}`);
    }
    const cwd = item.cwd ? normalizeText(item.cwd).trim() : "";
    if (cwd.length > 0) {
      sections.push(`Working directory: ${cwd}`);
    }
    if (item.networkApprovalContext) {
      sections.push(
        `Network access: ${item.networkApprovalContext.protocol}://${item.networkApprovalContext.host}`,
      );
    }
  } else if (item.changes.length > 0) {
    sections.push(...item.changes.map((change) => `Change: ${change.path} (${change.kind})`));
  }
  return renderDetails(title, sections.join("\n\n"));
}

function renderPendingPermissionsRequest(item: PendingPermissionsRequestApproval) {
  const sections = ["Status: pending"];
  const reason = item.reason ? normalizeText(item.reason).trim() : "";
  sections.push(`Reason: ${reason.length > 0 ? reason : "Not provided"}`);
  sections.push("Response: none");
  return renderDetails("Permission request", sections.join("\n\n"));
}

function renderPendingMcpRequest(item: PendingMcpServerElicitationRequest) {
  const sections = ["Status: pending", "Action: none"];
  const serverName = normalizeText(item.serverName).trim();
  if (serverName.length > 0) {
    sections.push(`Server: ${serverName}`);
  }
  const message = normalizeText(item.request.message).trim();
  if (message.length > 0) {
    sections.push(message);
  }
  return renderDetails("MCP server elicitation", sections.join("\n\n"));
}

function renderPendingUserInputRequest(item: PendingToolRequestUserInput) {
  const questions = item.questions
    .map((question) => normalizeText(question.question).trim())
    .filter((question) => question.length > 0)
    .map((question) => `- ${question}`);
  const title = questions.length > 0 ? "User input request" : "User input requested";
  return renderDetails(title, questions.length > 0 ? questions.join("\n") : "Status: pending");
}

function renderCommandExecution(item: ThreadConversationCommandExecution) {
  const sections = [renderCodeBlock("bash", `$ ${item.command}`)];
  const output = item.aggregatedOutput ? normalizeText(item.aggregatedOutput).trimEnd() : "";
  if (output.length > 0) {
    sections.push(renderCodeBlock("text", output));
  }
  sections.push(renderCommandStatus(item));
  return renderDetails(`Ran ${inlineCode(item.command)}`, sections.join("\n\n"));
}

function renderExplorationGroup(item: ExplorationGroupItem, t: Translate) {
  const sections: string[] = [];

  for (const groupedItem of item.items) {
    if (groupedItem.type === "reasoning") {
      const lines = [...groupedItem.summary, ...groupedItem.content]
        .map(normalizeText)
        .filter((line) => line.trim().length > 0);
      if (lines.length > 0) {
        sections.push(lines.join("\n"));
      }
      continue;
    }

    const isInProgress = isCommandExecutionStillRunning(groupedItem);
    for (const action of groupedItem.commandActions) {
      if (action.type === "read") {
        const fileName = getCommandActionDisplayName(action.path || action.name);
        if (fileName.length > 0) {
          sections.push(
            t(
              isInProgress ? "avatarOverlay.session.readingFile" : "avatarOverlay.session.readFile",
              { fileName },
            ),
          );
        }
        continue;
      }
      if (action.type === "listFiles") {
        sections.push(
          t(
            isInProgress ? "avatarOverlay.session.listingFiles" : "avatarOverlay.session.listedFiles",
          ),
        );
        continue;
      }
      if (action.type === "search") {
        const query = action.query?.trim() ?? "";
        sections.push(
          query.length > 0
            ? t(
                isInProgress
                  ? "avatarOverlay.session.searchingQuery"
                  : "avatarOverlay.session.searchedQuery",
                { query },
              )
            : t(
                isInProgress
                  ? "avatarOverlay.session.searchingFiles"
                  : "avatarOverlay.session.searchedFiles",
              ),
        );
      }
    }
  }

  if (sections.length === 0) {
    return null;
  }

  return renderDetails("Exploration", sections.join("\n\n"));
}

function renderFileChange(item: ThreadConversationFileChange) {
  const blocks = item.changes.map((change) => renderSingleFileChange(change)).filter(Boolean);
  return blocks.length > 0 ? blocks.join("\n") : null;
}

function renderWebSearch(item: ThreadConversationWebSearch) {
  const query = normalizeText(item.query).trim();
  if (query.length === 0) {
    return null;
  }
  return `Searched web for ${query}`;
}

function renderWebSearchGroup(item: WebSearchGroupItem) {
  const sections = item.items.map(renderWebSearch).filter((section): section is string => section !== null);
  if (sections.length === 0) {
    return null;
  }
  return renderDetails("Web search", sections.join("\n"));
}

function renderImageGeneration(item: ThreadConversationImageGeneration, t: Translate) {
  const sections: string[] = [];
  const result = normalizeText(item.result).trim();
  if (item.revisedPrompt) {
    sections.push(`${t("app.chat.revisedPrompt")}: ${normalizeText(item.revisedPrompt).trim()}`);
  }
  if (result.length > 0) {
    sections.push(`${t("app.chat.output")}: ${result}`);
  }
  if (item.savedPath) {
    sections.push(`${t("app.chat.savedPath")}: ${item.savedPath}`);
  }
  if (sections.length === 0) {
    sections.push(t("app.chat.status.inProgress"));
  }
  return renderDetails(t("app.chat.imageGeneration"), sections.join("\n\n"));
}

function renderImageView(item: ThreadConversationImageView) {
  const path = normalizeText(item.path).trim();
  if (path.length === 0) {
    return null;
  }
  return `![Image](${path})`;
}

function renderCollabAgentToolCall(item: ThreadConversationCollabAgentToolCall, t: Translate) {
  const sections = [`${t("app.chat.agentTool")}: ${item.tool}`, `${t("app.chat.senderThread")}: ${item.senderThreadId}`];
  if (item.receiverThreadIds.length > 0) {
    sections.push(`${t("app.chat.receiverThreads")}: ${item.receiverThreadIds.join(", ")}`);
  }
  if (item.prompt) {
    sections.push(`${t("app.chat.prompt")}: ${normalizeText(item.prompt).trim()}`);
  }
  if (item.model) {
    sections.push(`${t("app.chat.model")}: ${item.model}`);
  }
  if (item.reasoningEffort) {
    sections.push(`${t("app.chat.reasoningEffort")}: ${item.reasoningEffort}`);
  }
  if (item.receiverSummary) {
    sections.push(`${t("app.chat.agentStatus")}: ${item.receiverSummary}`);
  }
  return renderDetails(t("app.chat.collabAgentToolCall"), sections.join("\n\n"));
}

function renderMultiAgentGroup(item: MultiAgentGroupItem, t: Translate) {
  const action = resolveMultiAgentActionLabel(item.tool, item.status, t, "header");
  const count = resolveMultiAgentReceiverCount(item.items);
  const countLabel =
    count > 0 ? t("localConversation.multiAgentAction.header.count", { count }) : "";
  const rows = buildMultiAgentGroupRows(item.items, t);
  const prompt = resolveMultiAgentGroupPrompt(item.items);
  const sections: string[] = [];

  if (rows.length > 0) {
    sections.push(rows.map((row) => `- ${row}`).join("\n"));
  }
  if (prompt) {
    sections.push(
      t("localConversation.multiAgentAction.meta.prompt", {
        prompt: normalizeText(prompt).trim(),
      }),
    );
  }

  return renderDetails(
    t("localConversation.multiAgentAction.header", {
      action,
      countLabel,
    }),
    sections.join("\n\n"),
  );
}

function renderMcpToolCall(item: ThreadConversationMcpToolCall, t: Translate) {
  const sections = [`${t("app.chat.mcpServer")}: ${item.server}`, `${t("app.chat.mcpTool")}: ${item.tool}`];
  if (item.resultSummary) {
    sections.push(renderCodeBlock("text", normalizeText(item.resultSummary).trim()));
  }
  if (item.errorMessage) {
    sections.push(item.errorMessage);
  }
  return renderDetails(t("avatarOverlay.session.calledToolName", { toolName: item.tool }), sections.join("\n\n"));
}

function renderDynamicToolCall(item: ThreadConversationDynamicToolCall, t: Translate) {
  const tool = normalizeText(item.tool).trim();
  if (tool.length === 0) {
    return null;
  }

  const status = item.status === "inProgress" ? "running" : "completed";
  return renderDetails("Tool call", [`Tool: ${tool}`, `Status: ${status}`].join("\n\n"));
}

const multiAgentHeaderLabelKeys: Partial<
  Record<
    Extract<MultiAgentGroupItem["tool"], "closeAgent" | "resumeAgent" | "sendInput" | "spawnAgent">,
    Partial<Record<Extract<MultiAgentGroupItem["status"], "completed" | "failed" | "inProgress">, MessageKey>>
  >
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.header.close.completed",
    failed: "localConversation.multiAgentAction.header.close.failed",
    inProgress: "localConversation.multiAgentAction.header.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.header.resume.completed",
    failed: "localConversation.multiAgentAction.header.resume.failed",
    inProgress: "localConversation.multiAgentAction.header.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.header.sendInput.completed",
    failed: "localConversation.multiAgentAction.header.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.header.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.header.spawn.completed",
    failed: "localConversation.multiAgentAction.header.spawn.failed",
    inProgress: "localConversation.multiAgentAction.header.spawn.inProgress",
  },
};

const multiAgentRowLabelKeys: Partial<
  Record<
    Extract<MultiAgentGroupItem["tool"], "closeAgent" | "resumeAgent" | "sendInput" | "spawnAgent">,
    Partial<Record<Extract<MultiAgentGroupItem["status"], "completed" | "failed" | "inProgress">, MessageKey>>
  >
> = {
  closeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.close.completed",
    failed: "localConversation.multiAgentAction.rowAction.close.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.close.inProgress",
  },
  resumeAgent: {
    completed: "localConversation.multiAgentAction.rowAction.resume.completed",
    failed: "localConversation.multiAgentAction.rowAction.resume.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.resume.inProgress",
  },
  sendInput: {
    completed: "localConversation.multiAgentAction.rowAction.sendInput.completed",
    failed: "localConversation.multiAgentAction.rowAction.sendInput.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.sendInput.inProgress",
  },
  spawnAgent: {
    completed: "localConversation.multiAgentAction.rowAction.spawn.completed",
    failed: "localConversation.multiAgentAction.rowAction.spawn.failed",
    inProgress: "localConversation.multiAgentAction.rowAction.spawn.inProgress",
  },
};

function buildMultiAgentGroupRows(items: MultiAgentGroupItem["items"], t: Translate) {
  const rows: string[] = [];

  for (const item of items) {
    const action = resolveMultiAgentActionLabel(item.tool, item.status, t, "row");
    if (item.receiverThreadIds.length === 0) {
      rows.push(t("localConversation.multiAgentAction.row.generic", { action }));
      continue;
    }

    for (const receiverThreadId of item.receiverThreadIds) {
      rows.push(
        t("localConversation.multiAgentAction.row.agent", {
          action,
          agent: receiverThreadId,
        }),
      );
    }
  }

  return rows;
}

function resolveMultiAgentGroupPrompt(items: MultiAgentGroupItem["items"]) {
  for (const item of items) {
    const prompt = item.prompt?.trim();
    if (prompt) {
      return prompt;
    }
  }
  return null;
}

function resolveMultiAgentReceiverCount(items: MultiAgentGroupItem["items"]) {
  const receiverThreadIds = new Set(items.flatMap((item) => item.receiverThreadIds));
  if (receiverThreadIds.size > 0) {
    return receiverThreadIds.size;
  }
  return items.length;
}

function resolveMultiAgentActionLabel(
  tool: MultiAgentGroupItem["tool"],
  status: MultiAgentGroupItem["status"],
  t: Translate,
  context: "header" | "row",
) {
  const resolvedStatus = normalizeMultiAgentStatus(status);
  const labelKey =
    context === "header"
      ? multiAgentHeaderLabelKeys[tool]?.[resolvedStatus]
      : multiAgentRowLabelKeys[tool]?.[resolvedStatus];

  if (labelKey) {
    return t(labelKey);
  }

  const normalizedTool = tool
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  if (normalizedTool.length === 0) {
    return resolvedStatus === "failed" ? t("app.chat.status.failed") : t("app.chat.status.completed");
  }

  const verb = normalizedTool.replaceAll(/\b\w/g, (character) => character.toUpperCase());
  return resolvedStatus === "failed" ? `${t("app.chat.status.failed")} ${verb}` : verb;
}

function normalizeMultiAgentStatus(status: MultiAgentGroupItem["status"]) {
  if (status === "completed" || status === "failed" || status === "inProgress") {
    return status;
  }
  return status.trim().toLowerCase() === "inprogress" ? "inProgress" : "completed";
}

function renderAutomaticApprovalReview(
  item: Extract<ThreadConversationItem, { type: "automaticApprovalReview" }>,
) {
  const sections = [`Status: ${normalizeText(item.status).trim()}`];
  const riskLevel = item.riskLevel ? normalizeText(item.riskLevel).trim() : "";
  if (riskLevel.length > 0) {
    sections.push(`Risk: ${riskLevel}`);
  }
  const rationale = item.rationale ? normalizeText(item.rationale).trim() : "";
  if (rationale.length > 0) {
    sections.push(`Rationale: ${rationale}`);
  }
  return renderDetails("Auto-review", sections.join("\n\n"));
}

function renderSystemError(item: Extract<ThreadConversationItem, { type: "systemError" }>) {
  const content = normalizeText(item.content).trim();
  if (content.length === 0) {
    return null;
  }
  return renderDetails("System error", content);
}

function renderStreamError(item: Extract<ThreadConversationItem, { type: "streamError" }>) {
  const sections = [normalizeText(item.content).trim()];
  if (item.additionalDetails) {
    sections.push(normalizeText(item.additionalDetails).trim());
  }
  const filteredSections = sections.filter((section) => section.length > 0);
  if (filteredSections.length === 0) {
    return null;
  }
  return renderDetails("Stream error", filteredSections.join("\n\n"));
}

function renderContextCompaction(item: ThreadConversationContextCompaction, t: Translate) {
  return renderDetails(
    t("app.chat.contextCompaction"),
    [item.isCompleted ? t("app.chat.status.completed") : t("app.chat.status.inProgress"), t("app.chat.contextCompactionDescription")].join(
      "\n\n",
    ),
  );
}


function renderSingleFileChange(change: FileChangeSummary) {
  const diff = change.diff ? normalizeText(change.diff).trimEnd() : "";
  const stats = diff.length > 0 ? countDiffStats(diff) : { additions: 0, deletions: 0 };
  const sections: string[] = [];

  if (change.movePath) {
    sections.push(`Moved to: ${change.movePath}`);
  }
  if (diff.length > 0) {
    sections.push(renderCodeBlock("diff", diff));
  }

  const summary = `${formatChangeVerb(change.kind)} ${inlineMarkdownCode(change.path)} (+${stats.additions} -${stats.deletions})`;
  if (sections.length === 0) {
    return summary;
  }
  return renderDetails(summary, sections.join("\n\n"));
}

function renderCommandStatus(item: ThreadConversationCommandExecution) {
  if (item.status === "interrupted") {
    return "Stopped";
  }
  if (item.exitCode == null) {
    return item.status === "completed" ? "Success" : "Running";
  }
  return item.exitCode === 0 ? "Success" : `Failed with exit code ${item.exitCode}`;
}

function getCommandActionDisplayName(path: string) {
  const normalizedPath = path.trim().replaceAll("\\", "/");
  if (normalizedPath.length === 0) {
    return "";
  }
  return normalizedPath.split("/").filter((segment) => segment.length > 0).at(-1) ?? normalizedPath;
}

function isCommandExecutionStillRunning(item: ThreadConversationCommandExecution) {
  const normalizedStatus = item.status.trim().toLowerCase();
  if (normalizedStatus === "inprogress" || normalizedStatus === "pending") {
    return true;
  }
  return item.exitCode === null && normalizedStatus !== "completed" && normalizedStatus !== "interrupted";
}

function formatReviewModeLabel(review: string, t: Translate) {
  const normalized = review.trim().toLowerCase();
  if (normalized === "current changes" || normalized === "uncommitted changes") {
    return t("composer.reviewMode.option.unstaged.simple");
  }
  return review;
}

function renderDetails(summary: string, body: string) {
  const normalizedBody = normalizeText(body).trim();
  return `<details><summary>${summary}</summary>\n\n${normalizedBody}\n\n</details>`;
}

function todoListStepCheckmark(status: string) {
  return status === "completed" ? "x" : " ";
}

function renderCodeBlock(language: string, content: string) {
  const normalized = normalizeText(content).trimEnd();
  const fence = "`".repeat(Math.max(3, longestBacktickRun(normalized) + 1));
  return `${fence}${language}\n${normalized}\n${fence}`;
}

function inlineCode(value: string) {
  const fence = "`".repeat(longestBacktickRun(value) + 1);
  return `<code>${escapeHtml(`${fence}${value}${fence}`)}</code>`;
}

function inlineMarkdownCode(value: string) {
  const fence = "`".repeat(longestBacktickRun(value) + 1);
  return `${fence}${value}${fence}`;
}

function formatChangeVerb(kind: string) {
  switch (kind) {
    case "add":
    case "update":
      return "Wrote";
    case "delete":
      return "Deleted";
    default:
      return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

function countDiffStats(diff: string) {
  let additions = 0;
  let deletions = 0;

  for (const line of normalizeText(diff).split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      additions += 1;
      continue;
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      deletions += 1;
    }
  }

  return { additions, deletions };
}

function sanitizeHeading(value: string) {
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return (normalized.length === 0 ? "Codex conversation" : normalized).replaceAll("#", "\\#");
}

function longestBacktickRun(value: string) {
  let longest = 0;

  for (const match of value.matchAll(/`+/g)) {
    longest = Math.max(longest, match[0].length);
  }

  return longest;
}

function normalizeText(value: string) {
  return value.replaceAll(/\r\n?/g, "\n");
}

function escapeDetailsTags(value: string) {
  return normalizeText(value).replaceAll(/<\/?details(?=[\s>])[^>]*>/gi, (tag) => escapeHtml(tag));
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
