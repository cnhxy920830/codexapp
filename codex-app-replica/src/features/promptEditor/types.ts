import type { MessageKey } from "../../i18n/messages";
import type { AppInfo } from "../../services/apps";
import type { SkillSummary } from "../../services/skills";

export type PromptEditorAppMentionCandidate = {
  id: string;
  kind: "app";
  label: string;
  displayLabel: string;
  insertText: string;
  detail: string | null;
  iconSource: string | null;
  scopeLabel: string;
};

export type PromptEditorSkillMentionCandidate = {
  id: string;
  kind: "skill";
  label: string;
  displayLabel: string;
  insertText: string;
  detail: string | null;
  path: string;
  brandColor: string | null;
  iconSource: string | null;
  scopeLabel: string;
};

export type PromptEditorMentionCandidate =
  | PromptEditorAppMentionCandidate
  | PromptEditorSkillMentionCandidate;

export type PromptEditorMentionState = {
  symbol: "@" | "$";
  startIndex: number;
  endIndex: number;
  query: string;
};

export type PromptEditorOverlayLayout = {
  left: number;
  portalContainer: HTMLElement;
  positionClassName: "absolute" | "fixed";
  renderAbove: boolean;
  top: number;
  width: number;
};

export type PromptEditorMentionContext = {
  apps: AppInfo[];
  skills: SkillSummary[];
  activeWorkspaceRoots: string[];
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
};
