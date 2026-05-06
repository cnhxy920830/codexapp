import type { MessageKey } from "../../i18n/messages";
import type {
  FileChangeSummary,
  ThreadConversation,
  ThreadConversationCommandExecution,
  ThreadConversationFileChange,
  ThreadConversationItem,
  ThreadConversationMessage,
} from "../../services/history";
import { buildRenderableConversationItems } from "./renderableConversationItems";

type Translate = (key: MessageKey, values?: Record<string, number | string>) => string;

export function renderConversationMarkdown(
  threadConversation: ThreadConversation,
  t: Translate,
) {
  const sections = [`# ${sanitizeHeading(threadConversation.title || "Codex conversation")}`];
  const items = buildRenderableConversationItems(threadConversation.items);

  for (const item of items) {
    const rendered = renderConversationItem(item, t);
    if (rendered) {
      sections.push(rendered);
    }
  }

  return `${sections.join("\n\n").trimEnd()}\n`;
}

function renderConversationItem(item: ThreadConversationItem, t: Translate): string | null {
  switch (item.type) {
    case "userMessage":
      return renderUserMessage(item);
    case "agentMessage":
      return renderAgentMessage(item);
    case "commandExecution":
      return renderCommandExecution(item);
    case "fileChange":
      return renderFileChange(item);
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

function renderCommandExecution(item: ThreadConversationCommandExecution) {
  const sections = [renderCodeBlock("bash", `$ ${item.command}`)];
  const output = item.aggregatedOutput ? normalizeText(item.aggregatedOutput).trimEnd() : "";
  if (output.length > 0) {
    sections.push(renderCodeBlock("text", output));
  }
  sections.push(renderCommandStatus(item));
  return renderDetails(`Ran ${inlineCode(item.command)}`, sections.join("\n\n"));
}

function renderFileChange(item: ThreadConversationFileChange) {
  const blocks = item.changes.map((change) => renderSingleFileChange(change)).filter(Boolean);
  return blocks.length > 0 ? blocks.join("\n") : null;
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
