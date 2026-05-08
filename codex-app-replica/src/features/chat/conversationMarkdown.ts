import type { MessageKey } from "../../i18n/messages";
import type {
  ThreadConversationAutomationUpdate,
  ThreadConversationAutomationUpdateArguments,
  FileChangeSummary,
  ThreadConversation,
  ThreadConversationCommandExecution,
  ThreadConversationContextCompaction,
  ThreadConversationDynamicToolCall,
  ThreadConversationFileChange,
  ThreadConversationForkedFromConversation,
  ThreadConversationHook,
  ThreadConversationImageView,
  ThreadConversationImageGeneration,
  ThreadConversationItem,
  ThreadConversationModelChanged,
  ThreadConversationPersonalityChanged,
  ThreadConversationPlanImplementation,
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
  PendingToolRequestUserInput,
} from "./threadConversationState";
import {
  attachTurnScopedItemsToRenderableConversationGroups,
  buildRenderableConversationGroups,
} from "./renderableConversationGroups";
import {
  buildCollapsedToolActivityDetailLines,
  resolveCollapsedToolActivitySummaryText,
  type CollapsedToolActivityItem,
  type ExplorationGroupItem,
  type MultiAgentGroupItem,
  type WebSearchGroupItem,
} from "./renderableConversationItems";
import {
  buildMultiAgentGroupRows,
  isMultiAgentInProgressStatus,
  resolveMultiAgentActionLabel,
  resolveMultiAgentCountLabel,
  toSingleMultiAgentGroupItem,
} from "./multiAgentAction";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;
type MarkdownConversationItem =
  | ThreadConversationItem
  | CollapsedToolActivityItem
  | ExplorationGroupItem
  | MultiAgentGroupItem
  | WebSearchGroupItem
  | PendingApproval;

type ConversationMarkdownPendingRequests = {
  approvals?: PendingApproval[];
};

export function renderConversationMarkdown(
  threadConversation: ThreadConversation,
  t: Translate,
  pendingRequests: ConversationMarkdownPendingRequests = {},
) {
  const sections = [`# ${sanitizeHeading(threadConversation.title || "Codex conversation")}`];
  const items = buildMarkdownConversationItems(
    threadConversation.items,
    threadConversation.turnTimings,
    pendingRequests,
  );

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
  turnTimings: ThreadConversation["turnTimings"],
  pendingRequests: ConversationMarkdownPendingRequests,
) {
  const groups = buildRenderableConversationGroups(items, {
    turnTimings,
  });
  const groupedConversation = attachTurnScopedItemsToRenderableConversationGroups(groups, {
    approvalItems: pendingRequests.approvals ?? [],
  });

  const mergedItems: MarkdownConversationItem[] = [];
  for (const group of groupedConversation.groups) {
    mergedItems.push(...group.modelChangedItems);
    mergedItems.push(...group.userItems);
    mergedItems.push(...group.modelReroutedItems);
    mergedItems.push(...group.activityItems);
    mergedItems.push(...group.automationUpdateItems);
    mergedItems.push(...group.toolOutputItems);
    mergedItems.push(...group.postAssistantItems);
    if (group.systemEventItem) {
      mergedItems.push(group.systemEventItem);
    }
    if (group.todoListItem) {
      mergedItems.push(group.todoListItem);
    }
    if (group.proposedPlanItem) {
      mergedItems.push(group.proposedPlanItem);
    }
    if (group.planImplementationItem) {
      mergedItems.push(group.planImplementationItem);
    }
    mergedItems.push(...group.mcpServerElicitationItems);
    mergedItems.push(...group.permissionRequestItems);
    if (group.approvalItem) {
      mergedItems.push(group.approvalItem);
    }
    if (group.userInputItem) {
      mergedItems.push(group.userInputItem);
    }
    if (group.assistantMessage) {
      mergedItems.push(group.assistantMessage);
    }
    mergedItems.push(...group.remoteTaskCreatedItems);
    mergedItems.push(...group.personalityChangedItems);
    mergedItems.push(...group.forkedFromConversationItems);
  }

  mergedItems.push(...groupedConversation.unmatchedApprovalItems);

  return mergedItems;
}

function renderConversationItem(item: MarkdownConversationItem, t: Translate): string | null {
  if (item.type === "planImplementation") {
    return renderPlanImplementation(item, t);
  }
  if (item.type === "commandApprovalRequested" || item.type === "fileChangeApprovalRequested") {
    return renderPendingApproval(item);
  }
  switch (item.type) {
    case "userMessage":
      return renderUserMessage(item);
    case "agentMessage":
      return renderAgentMessage(item);
    case "steeringUserMessage":
      return renderUserMessage({
        type: "userMessage",
        id: item.id,
        turnId: item.turnId,
        role: "user",
        text: item.text,
        completed: item.status === "accepted",
        steeringStatus: item.status,
      });
    case "steered":
      return null;
    case "hook":
      return null;
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
      return null;
    case "commandExecution":
      return renderCommandExecution(item);
    case "explorationGroup":
      return renderExplorationGroup(item, t);
    case "collapsedToolActivity":
      return renderCollapsedToolActivity(item);
    case "multiAgentGroup":
      return renderMultiAgentGroup(item, t);
    case "fileChange":
      return renderFileChange(item);
    case "mcpToolCall":
      return renderMcpToolCall(item, t);
    case "dynamicToolCall":
      return renderDynamicToolCall(item);
    case "automationUpdate":
      return renderAutomationUpdate(item);
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
    case "multiAgentAction":
      return renderSingleMultiAgentAction(item);
    case "contextCompaction":
      return renderContextCompaction(item, t);
    case "mcpServerElicitation":
      return renderDetails("MCP server elicitation", [
        item.completed ? "Status: completed" : "Status: pending",
        `Action: ${item.action ?? "none"}`,
      ].join("\n"));
    case "permissionRequest":
      return renderDetails("Permission request", [
        item.completed ? "Status: completed" : "Status: pending",
        `Reason: ${normalizeText(item.reason ?? "Not provided")}`,
        `Response: ${item.response === null ? "none" : "granted"}`,
      ].join("\n"));
    case "userInput":
      return renderDetails(
        item.completed ? "User input request" : "User input requested",
        item.questions.map((question) => `- ${normalizeText(question.question).trim()}`).join("\n"),
      );
    case "userInputResponse":
      return renderUserInputResponse(item);
    case "enteredReviewMode":
    case "exitedReviewMode":
      return null;
    default:
      return null;
  }
}

function renderUserMessage(item: ThreadConversationMessage) {
  const text = normalizeText(item.text);
  const contextLines: string[] = [];
  if (Array.isArray(item.attachments) && item.attachments.length > 0) {
    contextLines.push("Attachments:");
    for (const attachment of item.attachments) {
      const label = normalizeText(attachment.label).trim();
      const path = normalizeText(attachment.path).trim();
      if (label.length === 0 || path.length === 0) {
        continue;
      }
      contextLines.push(`- ${label}: ${path}`);
    }
  }
  if (Array.isArray(item.images) && item.images.length > 0) {
    contextLines.push("Images:");
    for (const image of item.images) {
      const normalizedImage = normalizeText(image).trim();
      if (normalizedImage.length > 0) {
        contextLines.push(`- ${normalizedImage}`);
      }
    }
  }
  if (Array.isArray(item.comments) && item.comments.length > 0) {
    contextLines.push("Comments:");
    for (const comment of item.comments) {
      const path = normalizeText(comment.path).trim();
      const lineRange = typeof comment.lineRange === "string" ? normalizeText(comment.lineRange).trim() : "";
      const body = normalizeText(comment.body).replaceAll("\n", " ").trim();
      if (path.length === 0 || body.length === 0) {
        continue;
      }
      contextLines.push(`- ${path}${lineRange.length > 0 ? ` ${inlineCode(lineRange)}` : ""}: ${body}`);
    }
  }
  if (item.referencesPriorConversation) {
    contextLines.push("Referenced prior conversation");
  }
  if (item.reviewMode) {
    contextLines.push("Mode: code review");
  }
  if (item.pullRequestFixMode) {
    contextLines.push("Mode: pull request fix");
  }
  if (item.autoResolveSync) {
    contextLines.push("Mode: auto resolve merge");
  }
  if (
    typeof item.pullRequestCheckCount === "number"
    && Number.isFinite(item.pullRequestCheckCount)
    && item.pullRequestCheckCount > 0
  ) {
    contextLines.push(`Pull request checks: ${item.pullRequestCheckCount}`);
  }

  const sections: string[] = [];
  if (text.length > 0) {
    sections.push(text);
  }
  if (contextLines.length > 0) {
    sections.push(renderDetails("User context", contextLines.join("\n")));
  }
  if (sections.length === 0) {
    return null;
  }

  return sections
    .join("\n\n")
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
  return renderDetails("Model changed", `${fromModel} -> ${toModel}`);
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

function renderPlanImplementation(item: ThreadConversationPlanImplementation, t: Translate) {
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

function renderUserInputResponse(
  item: Extract<ThreadConversationItem, { type: "userInputResponse" }>,
) {
  const lines = item.questionsAndAnswers.flatMap((entry) => {
    const question = normalizeText(entry.question).trim();
    const answers = entry.answers
      .map((answer) => normalizeText(answer).trim())
      .filter((answer) => answer.length > 0);
    const sections: string[] = [];
    if (question.length > 0) {
      sections.push(`- ${question}`);
    }
    for (const answer of answers) {
      sections.push(`  - ${answer}`);
    }
    return sections;
  });

  if (lines.length === 0) {
    return renderDetails("User input response", item.completed ? "Status: completed" : "Status: pending");
  }

  return renderDetails("User input response", lines.join("\n"));
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
    for (const action of getThreadCommandActions(groupedItem)) {
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

function renderCollapsedToolActivity(item: CollapsedToolActivityItem) {
  const summary = resolveCollapsedToolActivitySummaryText(item.summary);
  const detailLines = buildCollapsedToolActivityDetailLines(item);

  if (detailLines.length === 0) {
    return summary;
  }

  return renderDetails(summary, detailLines.map((line) => `- ${line}`).join("\n"));
}

function getThreadCommandActions(item: Extract<ThreadConversationItem, { type: "commandExecution" }>) {
  return Array.isArray(item.commandActions) ? item.commandActions : [];
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
  const result = normalizeText(item.result).trim();
  if (result.length === 0) {
    return renderDetails("Generated image", [`Status: ${normalizeText(item.status).trim()}`].join("\n\n"));
  }
  return `Generated image\n\n![Generated image](${result})`;
}

function renderImageView(item: ThreadConversationImageView) {
  const path = normalizeText(item.path).trim();
  if (path.length === 0) {
    return null;
  }
  return `![Image](${path})`;
}

function renderMultiAgentGroup(item: MultiAgentGroupItem, t: Translate) {
  const firstItem = item.items[0];
  return renderDetails(
    "Subagent action",
    [
      firstItem ? `Action: ${firstItem.action}` : null,
      firstItem ? `Status: ${firstItem.status}` : null,
      `Receiver threads: ${item.items.length}`,
    ]
      .filter((section): section is string => section !== null && section.trim().length > 0)
      .join("\n\n"),
  );
}

function renderSingleMultiAgentAction(
  item: Extract<ThreadConversationItem, { type: "multiAgentAction" }>,
) {
  return renderDetails(
    "Subagent action",
    [
      `Action: ${item.action}`,
      `Status: ${item.status}`,
      `Receiver threads: ${item.receiverThreads.length}`,
      item.prompt ? `Prompt: ${normalizeText(item.prompt).trim()}` : null,
    ]
      .filter((section): section is string => section !== null && section.trim().length > 0)
      .join("\n\n"),
  );
}

function renderMcpToolCall(item: ThreadConversationMcpToolCall, t: Translate) {
  const invocationLabel = `${item.server}.${item.tool}`.trim();
  if (invocationLabel.length === 0) {
    return null;
  }

  const sections = [`MCP tool call\n\n${normalizeText(invocationLabel)}`];
  sections.push(renderCodeBlock("json", JSON.stringify(item.arguments ?? null, null, 2)));

  const resultRecord = asRecord(item.result);
  const resultContent = Array.isArray(resultRecord?.content)
    ? resultRecord.content
        .map(renderMcpToolResultContentItem)
        .filter((value): value is string => value !== null)
        .join("\n\n")
    : "";
  if (resultContent.length > 0) {
    sections.push(resultContent);
  }

  if (resultRecord && "structuredContent" in resultRecord) {
    sections.push(renderCodeBlock("json", JSON.stringify(resultRecord.structuredContent ?? null, null, 2)));
  }

  const errorMessage = extractMcpToolCallErrorMessage(item.error) ?? item.errorMessage;
  if (errorMessage) {
    sections.push(normalizeText(errorMessage).trim());
  } else if (item.result === null && item.status === "inProgress") {
    sections.push("Status: running");
  } else if (item.result === null) {
    sections.push("Result: none");
  }

  return sections.join("\n\n");
}

function renderDynamicToolCall(item: ThreadConversationDynamicToolCall) {
  const tool = normalizeText(item.tool).trim();
  if (tool.length === 0) {
    return null;
  }

  const status = item.status === "inProgress" ? "running" : "completed";
  return renderDetails("Tool call", [`Tool: ${tool}`, `Status: ${status}`].join("\n\n"));
}

function renderAutomationUpdate(item: ThreadConversationAutomationUpdate) {
  const sections: string[] = [];
  sections.push(`Mode: ${item.result?.mode ?? "pending"}`);
  sections.push(`Automation ID: ${item.result?.automationId ?? "pending"}`);

  return renderDetails("Automation update", sections.join("\n\n"));
}

function renderMcpToolResultContentItem(value: unknown): string | null {
  const record = asRecord(value);
  if (record === null) {
    return null;
  }
  const type = typeof record.type === "string" ? record.type : null;
  switch (type) {
    case "text": {
      const text = typeof record.text === "string" ? normalizeText(record.text).trim() : "";
      return text.length === 0 ? null : renderCodeBlock("text", text);
    }
    case "image": {
      const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim() : "";
      return mimeType.length === 0 ? null : `Image output: ${mimeType}`;
    }
    case "audio": {
      const mimeType = typeof record.mimeType === "string" ? record.mimeType.trim() : "";
      return mimeType.length === 0 ? null : `Audio output: ${mimeType}`;
    }
    case "resource_link": {
      const uri = typeof record.uri === "string" ? record.uri.trim() : "";
      const title = firstNonEmptyString(record.title, record.name, uri);
      return title === null ? null : `Resource: ${title}${uri.length > 0 ? ` (${uri})` : ""}`;
    }
    case "embedded_resource": {
      const resource = asRecord(record.resource);
      const title = firstNonEmptyString(resource?.title, resource?.name, resource?.uri);
      const text = typeof resource?.text === "string" ? normalizeText(resource.text).trim() : "";
      if (title === null) {
        return text.length > 0 ? renderCodeBlock("text", text) : null;
      }
      if (text.length > 0) {
        return `Resource: ${title}\n\n${renderCodeBlock("text", text)}`;
      }
      return `Resource: ${title}`;
    }
    case "unknown":
      return renderCodeBlock("json", JSON.stringify(record.raw ?? null, null, 2));
    default:
      return null;
  }
}

function extractMcpToolCallErrorMessage(error: unknown): string | null {
  const record = asRecord(error);
  const message = typeof record?.message === "string" ? normalizeText(record.message).trim() : "";
  return message.length === 0 ? null : `Error: ${message}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

function getAutomationUpdateArgumentMode(argumentsValue: ThreadConversationAutomationUpdateArguments) {
  return argumentsValue?.mode;
}

function normalizeAutomationUpdateModeLabel(mode: ReturnType<typeof getAutomationUpdateArgumentMode>) {
  switch (mode) {
    case "create":
    case "suggested_create":
      return "create";
    case "update":
    case "suggested_update":
      return "update";
    case "delete":
      return "delete";
    case "view":
      return "view";
    default:
      return null;
  }
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
  const source = normalizeText(item.source).trim() || "automatic";
  return renderDetails(
    "Context compaction",
    [
      `Source: ${source}`,
      item.isCompleted ? t("app.chat.status.completed") : t("app.chat.status.inProgress"),
    ].join("\n\n"),
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
