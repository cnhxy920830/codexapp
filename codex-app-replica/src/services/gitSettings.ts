import { getGlobalState, setGlobalState } from "./settings";

export type GitMergeMethod = "merge" | "squash";

export type GitSettingsSnapshot = {
  branchPrefix: string;
  alwaysForcePush: boolean;
  createDraftPullRequest: boolean;
  pullRequestMergeMethod: GitMergeMethod;
  showSidebarPrIcons: boolean;
  commitInstructions: string;
  pullRequestInstructions: string;
};

export const DEFAULT_GIT_SETTINGS: GitSettingsSnapshot = {
  branchPrefix: "codex/",
  alwaysForcePush: false,
  createDraftPullRequest: true,
  pullRequestMergeMethod: "merge",
  showSidebarPrIcons: false,
  commitInstructions: "",
  pullRequestInstructions: "",
};

const BRANCH_PREFIX_KEY = "git-branch-prefix";
const ALWAYS_FORCE_PUSH_KEY = "git-always-force-push";
const CREATE_DRAFT_PULL_REQUEST_KEY = "git-create-pull-request-as-draft";
const PULL_REQUEST_MERGE_METHOD_KEY = "git-pull-request-merge-method";
const SHOW_SIDEBAR_PR_ICONS_KEY = "git-show-sidebar-pr-icons";
const COMMIT_INSTRUCTIONS_KEY = "git-commit-instructions";
const PR_INSTRUCTIONS_KEY = "git-pr-instructions";

export async function readGitSettingsSnapshot(): Promise<GitSettingsSnapshot> {
  const [
    branchPrefix,
    alwaysForcePush,
    createDraftPullRequest,
    pullRequestMergeMethod,
    showSidebarPrIcons,
    commitInstructions,
    pullRequestInstructions,
  ] = await Promise.all([
    getGlobalState(BRANCH_PREFIX_KEY),
    getGlobalState(ALWAYS_FORCE_PUSH_KEY),
    getGlobalState(CREATE_DRAFT_PULL_REQUEST_KEY),
    getGlobalState(PULL_REQUEST_MERGE_METHOD_KEY),
    getGlobalState(SHOW_SIDEBAR_PR_ICONS_KEY),
    getGlobalState(COMMIT_INSTRUCTIONS_KEY),
    getGlobalState(PR_INSTRUCTIONS_KEY),
  ]);

  return {
    branchPrefix: typeof branchPrefix.value === "string" ? branchPrefix.value : DEFAULT_GIT_SETTINGS.branchPrefix,
    alwaysForcePush:
      typeof alwaysForcePush.value === "boolean" ? alwaysForcePush.value : DEFAULT_GIT_SETTINGS.alwaysForcePush,
    createDraftPullRequest:
      typeof createDraftPullRequest.value === "boolean"
        ? createDraftPullRequest.value
        : DEFAULT_GIT_SETTINGS.createDraftPullRequest,
    pullRequestMergeMethod:
      pullRequestMergeMethod.value === "merge" || pullRequestMergeMethod.value === "squash"
        ? pullRequestMergeMethod.value
        : DEFAULT_GIT_SETTINGS.pullRequestMergeMethod,
    showSidebarPrIcons:
      typeof showSidebarPrIcons.value === "boolean"
        ? showSidebarPrIcons.value
        : DEFAULT_GIT_SETTINGS.showSidebarPrIcons,
    commitInstructions:
      typeof commitInstructions.value === "string"
        ? commitInstructions.value
        : DEFAULT_GIT_SETTINGS.commitInstructions,
    pullRequestInstructions:
      typeof pullRequestInstructions.value === "string"
        ? pullRequestInstructions.value
        : DEFAULT_GIT_SETTINGS.pullRequestInstructions,
  };
}

export async function setGitBranchPrefix(value: string) {
  return setGlobalState(BRANCH_PREFIX_KEY, value);
}

export async function setGitAlwaysForcePush(value: boolean) {
  return setGlobalState(ALWAYS_FORCE_PUSH_KEY, value);
}

export async function setGitCreateDraftPullRequest(value: boolean) {
  return setGlobalState(CREATE_DRAFT_PULL_REQUEST_KEY, value);
}

export async function setGitPullRequestMergeMethod(value: GitMergeMethod) {
  return setGlobalState(PULL_REQUEST_MERGE_METHOD_KEY, value);
}

export async function setGitShowSidebarPrIcons(value: boolean) {
  return setGlobalState(SHOW_SIDEBAR_PR_ICONS_KEY, value);
}

export async function setGitCommitInstructions(value: string) {
  return setGlobalState(COMMIT_INSTRUCTIONS_KEY, value);
}

export async function setGitPullRequestInstructions(value: string) {
  return setGlobalState(PR_INSTRUCTIONS_KEY, value);
}
