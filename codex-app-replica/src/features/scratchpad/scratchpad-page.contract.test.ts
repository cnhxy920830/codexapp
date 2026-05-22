import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const SCRATCHPAD_PAGE_PATH = path.join(process.cwd(), "src/features/scratchpad/ScratchpadPage.tsx");
const SCRATCHPAD_PROMPT_INPUT_PATH = path.join(
  process.cwd(),
  "src/features/scratchpad/ScratchpadPromptInput.tsx",
);
const SHARED_PROMPT_EDITOR_PATH = path.join(
  process.cwd(),
  "src/features/promptEditor/PromptEditor.tsx",
);
const SHARED_PROMPT_EDITOR_DOM_PATH = path.join(
  process.cwd(),
  "src/features/promptEditor/dom.tsx",
);
const SHARED_PROMPT_EDITOR_OVERLAY_PATH = path.join(
  process.cwd(),
  "src/features/promptEditor/MentionOverlay.tsx",
);
const SHARED_PROMPT_EDITOR_CANDIDATES_PATH = path.join(
  process.cwd(),
  "src/features/promptEditor/mentionCandidates.ts",
);
const SHARED_PROMPT_EDITOR_LINKS_PATH = path.join(
  process.cwd(),
  "src/features/promptEditor/promptLinks.ts",
);
const USER_MESSAGE_EDIT_COMPOSER_PATH = path.join(
  process.cwd(),
  "src/features/chat/UserMessageEditComposer.tsx",
);
const APP_PATH = path.join(process.cwd(), "src/App.tsx");
const SHARED_PROMPT_LINK_CONTENT_PATH = path.join(process.cwd(), "src/components/PromptLinkContent.tsx");
const TOOLTIP_PATH = path.join(process.cwd(), "src/components/Tooltip.tsx");
const APPS_SERVICE_PATH = path.join(process.cwd(), "src/services/apps.ts");
const PLUGINS_SERVICE_PATH = path.join(process.cwd(), "src/services/plugins.ts");
const SKILLS_SERVICE_PATH = path.join(process.cwd(), "src/services/skills.ts");

test("scratchpad page owns its registered header content", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");
  const appSource = await readFile(APP_PATH, "utf8");

  assert.match(scratchpadSource, /onRegisterHeaderContent\?\.\(headerContent\)/);
  assert.match(scratchpadSource, /onRegisterHeaderContent\?\.\(null\)/);
  assert.match(appSource, /pageHeaderContent/);
  assert.match(appSource, /onRegisterHeaderContent=\{\(content\) => \{\s*setPageHeaderContent\(content\);?\s*\}\}/s);
});

test("scratchpad submitted row text uses the shared tooltip owner instead of title attributes", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");
  const tooltipSource = await readFile(TOOLTIP_PATH, "utf8");

  assert.match(scratchpadSource, /import\s+\{\s*Tooltip\s*\}\s+from\s+"..\/..\/components\/Tooltip"/);
  assert.match(
    scratchpadSource,
    /<Tooltip[\s\S]*align="start"[\s\S]*disabled=\{!isTruncated\}[\s\S]*side="top"[\s\S]*tooltipBodyClassName="max-w-\[300px\] text-center"[\s\S]*tooltipContent=\{text\}[\s\S]*>/,
  );
  assert.doesNotMatch(scratchpadSource, /function ScratchpadTooltip/);
  assert.doesNotMatch(scratchpadSource, /\stitle=\{/);
  assert.match(tooltipSource, /export function Tooltip/);
  assert.match(tooltipSource, /tooltipContent: ReactNode/);
});

test("scratchpad null summaries stay on the extracted error path", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(scratchpadSource, /const nextSummary = response\.summary;/);
  assert.match(
    scratchpadSource,
    /\[row\.id\]:\s*nextSummary == null\s*\?\s*\{\s*status: "error",\s*message: finalAssistantMessage,\s*summary: null,\s*\}\s*:\s*\{\s*status: "ready",\s*message: finalAssistantMessage,\s*summary: nextSummary,\s*\}/s,
  );
});

test("scratchpad row state icons come from shared app-shell owners instead of page-local SVGs", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(
    scratchpadSource,
    /import\s+\{\s*CheckCircleFilledIcon,\s*FollowUpIcon,\s*UnselectedCircleIcon,\s*XCircleIcon,\s*\}\s+from\s+"..\/..\/components\/AppShellIcons"/s,
  );
  assert.match(scratchpadSource, /icon:\s*<XCircleIcon className="icon-sm shrink-0 text-token-error-foreground" \/>/);
  assert.doesNotMatch(scratchpadSource, /function UnselectedCircleIcon/);
  assert.doesNotMatch(scratchpadSource, /function FollowUpIcon/);
  assert.doesNotMatch(scratchpadSource, /function CheckCircleFilledIcon/);
  assert.doesNotMatch(scratchpadSource, /function ErrorIcon/);
});

test("scratchpad prompt input reuses the shared prompt-editor owner and anchored autocomplete overlay", async () => {
  const promptInputSource = await readFile(SCRATCHPAD_PROMPT_INPUT_PATH, "utf8");
  const sharedPromptEditorOverlaySource = await readFile(SHARED_PROMPT_EDITOR_OVERLAY_PATH, "utf8");

  assert.match(promptInputSource, /export\s+\{\s*PromptEditor as ScratchpadPromptInput\s*\}\s+from\s+"\.\.\/promptEditor";/);
  assert.match(sharedPromptEditorOverlaySource, /import\s+\{\s*createPortal\s*\}\s+from\s+"react-dom"/);
  assert.match(sharedPromptEditorOverlaySource, /createPortal\(/);
  assert.match(sharedPromptEditorOverlaySource, /document\.body/);
  assert.match(sharedPromptEditorOverlaySource, /const dialogContainer = editor\.closest\("\.codex-dialog"\);/);
  assert.match(sharedPromptEditorOverlaySource, /return \(dialogContainer as HTMLElement \| null\) \?\? document\.body;/);
  assert.match(sharedPromptEditorOverlaySource, /positionClassName: portalContainer === document\.body \? "fixed" : "absolute"/);
  assert.match(sharedPromptEditorOverlaySource, /renderAbove: placement === "top"/);
  assert.match(sharedPromptEditorOverlaySource, /"z-\[60\]"/);
  assert.match(sharedPromptEditorOverlaySource, /"-translate-y-full"/);
  assert.doesNotMatch(sharedPromptEditorOverlaySource, /className="absolute top-full left-0 z-50/);
});

test("scratchpad prompt file tokens reuse the shared workspace-file icon instead of a text-only pill", async () => {
  const promptInputSource = await readFile(SHARED_PROMPT_EDITOR_DOM_PATH, "utf8");

  assert.match(promptInputSource, /const displayLabel = segment\.locationSuffix \? `\$\{segment\.label\}\$\{segment\.locationSuffix\}` : segment\.label;/);
  assert.match(promptInputSource, /token\.setAttribute\("at-mention-label", displayLabel\);/);
  assert.match(promptInputSource, /token\.setAttribute\("at-mention-path", segment\.href\);/);
  assert.match(promptInputSource, /token\.setAttribute\("at-mention-fs-path", segment\.path\);/);
  assert.match(promptInputSource, /const icon = createWorkspaceFileIconNode\(\s*documentRef,\s*"h-\[0\.95em\] w-\[0\.95em\] shrink-0 text-token-text-secondary"/s);
  assert.match(promptInputSource, /function createWorkspaceFileIconNode\(documentRef: Document, className: string\)/);
  assert.match(promptInputSource, /WorkspaceFileIcon\(\{ className \}\)/);
  assert.match(promptInputSource, /if \(icon\) \{\s*token\.append\(icon\);\s*\}\s*token\.append\(label\);/s);
});

test("scratchpad prompt app and skill mentions carry extracted prompt-editor owner attributes", async () => {
  const promptInputSource = await readFile(SHARED_PROMPT_EDITOR_DOM_PATH, "utf8");

  assert.match(promptInputSource, /const attributePrefix = `\$\{segment\.type\}-mention`;/);
  assert.match(promptInputSource, /token\.setAttribute\(`\$\{attributePrefix\}-name`, getPromptMentionName\(segment\)\);/);
  assert.match(promptInputSource, /token\.setAttribute\(`\$\{attributePrefix\}-display-name`, segment\.displayLabel\);/);
  assert.match(promptInputSource, /token\.setAttribute\(`\$\{attributePrefix\}-path`, getPromptMentionPath\(segment\)\);/);
  assert.match(
    promptInputSource,
    /if \(segment\.type === "agent"\) \{\s*token\.setAttribute\(`\$\{attributePrefix\}-conversation-id`, segment\.conversationId \?\? ""\);\s*\} else \{/s,
  );
  assert.match(promptInputSource, /token\.setAttribute\(`\$\{attributePrefix\}-icon`, segment\.iconSource \?\? ""\);/);
  assert.match(
    promptInputSource,
    /token\.setAttribute\(\s*`\$\{attributePrefix\}-brand-color`,\s*"brandColor" in segment \? \(segment\.brandColor \?\? ""\) : "",\s*\);/s,
  );
  assert.match(promptInputSource, /function createPromptMentionIconNode\(/);
  assert.match(promptInputSource, /icon\.src = segment\.iconSource;/);
  assert.match(promptInputSource, /label\.textContent = segment\.displayLabel;/);
  assert.match(promptInputSource, /if \(segment\.type === "app"\) \{\s*return segment\.name;\s*\}/s);
  assert.match(
    promptInputSource,
    /const prefix = segment\.type === "agent" \|\| segment\.type === "plugin" \? "@" : "\$";/,
  );
  assert.doesNotMatch(promptInputSource, /prefix\.textContent = segment\.type === "skill" \? "\\$" : "@";/);
});

test("scratchpad prompt parser and renderers keep extracted agent mention family instead of dropping it", async () => {
  const promptLinksSource = await readFile(
    path.join(process.cwd(), "src/features/scratchpad/scratchpadPromptLinks.ts"),
    "utf8",
  );
  const sharedPromptLinksSource = await readFile(SHARED_PROMPT_EDITOR_LINKS_PATH, "utf8");
  const promptInputSource = await readFile(SHARED_PROMPT_EDITOR_DOM_PATH, "utf8");
  const promptContentSource = await readFile(SHARED_PROMPT_LINK_CONTENT_PATH, "utf8");

  assert.match(promptLinksSource, /type PromptEditorMentionSegment as ScratchpadPromptMentionSegment/);
  assert.match(sharedPromptLinksSource, /{ type: "agent" \| "app" \| "plugin" \| "skill" }/);
  assert.match(sharedPromptLinksSource, /case "agent":\s*return segment\.href;/s);
  assert.match(promptInputSource, /segment\.type === "agent" \? "hover:opacity-90" : null/);
  assert.match(promptInputSource, /if \(segment\.type === "agent"\) \{\s*return null;\s*\}/s);
  assert.match(promptInputSource, /label: `\$\$\{candidate\.label\}`/);
  assert.match(promptContentSource, /case "agent":/);
  assert.match(promptContentSource, /label=\{`@\$\{segment\.displayLabel\}`\}/);
  assert.match(promptContentSource, /cursor-default/);
});

test("scratchpad submitted rows reuse the shared prompt-link owner shape and keep unsupported links raw", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");
  const promptContentSource = await readFile(SHARED_PROMPT_LINK_CONTENT_PATH, "utf8");
  const scratchpadPromptContentSource = await readFile(
    path.join(process.cwd(), "src/features/scratchpad/ScratchpadPromptContent.tsx"),
    "utf8",
  );

  assert.match(scratchpadSource, /readPluginsSnapshot\(null, SCRATCHPAD_HOST_ID\)/);
  assert.match(scratchpadSource, /plugins=\{plugins\}/);
  assert.match(scratchpadPromptContentSource, /<I18N_CONTEXT\.Provider value=\{i18nValue\}>/);
  assert.match(scratchpadPromptContentSource, /<PromptLinkContent/);
  assert.match(promptContentSource, /const PROMPT_LINK_PATTERN = /);
  assert.match(promptContentSource, /classifyPromptLink\(\{/);
  assert.match(promptContentSource, /<MarkdownOwnedLink/);
  assert.match(promptContentSource, /return parts\.length === 0 \? \[text\] : parts;/);
  assert.match(promptContentSource, /renderPromptLinkSegment\([\s\S]*\) \?\? raw/);
  assert.match(
    promptContentSource,
    /case "app":[\s\S]*if \(!segment\.resolved\) \{[\s\S]*prefix: "\$",[\s\S]*text: segment\.displayLabel,[\s\S]*\}/,
  );
  assert.match(
    promptContentSource,
    /case "plugin":[\s\S]*if \(!segment\.resolved\) \{[\s\S]*prefix: "@",[\s\S]*text: segment\.displayLabel,[\s\S]*\}/,
  );
  assert.match(
    promptContentSource,
    /case "skill":[\s\S]*if \(!segment\.resolved\) \{[\s\S]*prefix: "\$",[\s\S]*text: segment\.displayLabel,[\s\S]*\}/,
  );
  assert.match(
    promptContentSource,
    /case "agent":[\s\S]*if \(segment\.conversationId == null && segment\.roleName == null\) \{[\s\S]*return null;\s*\}/,
  );
});

test("scratchpad page binds page-owned data and command flows to the explicit local host owner", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(scratchpadSource, /import\s+\{\s*LOCAL_SETTINGS_HOST_ID\s*\}\s+from\s+"..\/..\/services\/settingsHosts"/);
  assert.match(scratchpadSource, /const SCRATCHPAD_HOST_ID = LOCAL_SETTINGS_HOST_ID;/);
  assert.match(
    scratchpadSource,
    /readAppsSnapshot\(\{\s*hostId: SCRATCHPAD_HOST_ID,\s*forceRefetch: options\.forceRefetchApps \?\? false,\s*\}\)/s,
  );
  assert.match(scratchpadSource, /readPluginsSnapshot\(null, SCRATCHPAD_HOST_ID\)/);
  assert.match(
    scratchpadSource,
    /readSkillsSnapshot\(null, \{\s*hostId: SCRATCHPAD_HOST_ID,\s*forceReload: options\.forceReloadSkills \?\? false,\s*\}\)/s,
  );
  assert.match(scratchpadSource, /hostId: SCRATCHPAD_HOST_ID,\s*input: \[createTextInput\(text\)\]/s);
  assert.match(scratchpadSource, /const resumedThread = await maybeResumeConversation\(\{\s*conversationId: row\.conversationId,\s*hostId: SCRATCHPAD_HOST_ID,/s);
  assert.match(scratchpadSource, /<ScratchpadPagePreview[\s\S]*hostId=\{SCRATCHPAD_HOST_ID\}/);
  assert.match(scratchpadSource, /<ScratchpadPromptInput[\s\S]*hostId=\{SCRATCHPAD_HOST_ID\}/);
  assert.match(scratchpadSource, /<ScratchpadPromptRowText[\s\S]*hostId=\{hostId\}/);
  assert.doesNotMatch(scratchpadSource, /readAppsSnapshot\(\{ hostId: null \}\)/);
  assert.doesNotMatch(scratchpadSource, /readPluginsSnapshot\(null, null\)/);
  assert.doesNotMatch(scratchpadSource, /readSkillsSnapshot\(null, \{ hostId: null \}\)/);
});

test("scratchpad page filters skills to enabled items before handing them to row and prompt renderers", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(scratchpadSource, /const enabledSkills = useMemo\(\(\) => skills\.filter\(\(skill\) => skill\.enabled\), \[skills\]\);/);
  assert.match(scratchpadSource, /skills=\{enabledSkills\}/);
  assert.match(
    scratchpadSource,
    /<ScratchpadPagePreview[\s\S]*skills=\{skills\}[\s\S]*\/>/,
  );
  assert.match(
    scratchpadSource,
    /<ScratchpadRowItem[\s\S]*skills=\{enabledSkills\}[\s\S]*\/>/,
  );
});

test("scratchpad pending follow-up gating and trailing states fall back to thread runtime status from hydrated threads", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(
    scratchpadSource,
    /const hasPendingApproval = hasPendingApprovalForTurn\(thread, runtime, row\.turnId\);/,
  );
  assert.match(
    scratchpadSource,
    /const hasPendingUserInput = hasPendingUserInputForTurn\(thread, runtime, row\.turnId\);/,
  );
  assert.match(
    scratchpadSource,
    /hasPendingApprovalForTurn\(thread, runtime, lastTurn\.id\) \|\|\s*hasPendingUserInputForTurn\(thread, runtime, lastTurn\.id\)/s,
  );
  assert.match(
    scratchpadSource,
    /function hasThreadRuntimeFlag\([\s\S]*thread\?\.threadRuntimeStatus\?\.type === "active" && thread\.threadRuntimeStatus\.activeFlags\.includes\(flag\);/s,
  );
  assert.match(
    scratchpadSource,
    /function hasPendingApprovalForTurn\([\s\S]*return hasThreadRuntimeFlag\(thread, turnId, "waitingOnApproval"\);/s,
  );
  assert.match(
    scratchpadSource,
    /function hasPendingUserInputForTurn\([\s\S]*return hasThreadRuntimeFlag\(thread, turnId, "waitingOnUserInput"\);/s,
  );
});

test("scratchpad page refreshes apps, plugins, and skills from query-cache invalidation while the page stays open", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(
    scratchpadSource,
    /import\s+\{\s*onQueryCacheInvalidated,\s*queryKeyMatchesPrefix,\s*type QueryCacheInvalidateNotification,\s*\}\s+from\s+"..\/..\/services\/queryCache"/s,
  );
  assert.match(scratchpadSource, /const PLUGIN_QUERY_KEY = \["plugins"\] as const;/);
  assert.match(scratchpadSource, /const APPS_QUERY_KEY = \["apps", "list"\] as const;/);
  assert.match(scratchpadSource, /const SKILLS_QUERY_KEY = \["skills"\] as const;/);
  assert.match(
    scratchpadSource,
    /const handleQueryCacheInvalidate = useEffectEvent\(\(notification: QueryCacheInvalidateNotification\) => \{/,
  );
  assert.match(
    scratchpadSource,
    /const shouldRefreshPlugins = queryKeyMatchesPrefix\(notification\.queryKey, PLUGIN_QUERY_KEY\);/,
  );
  assert.match(
    scratchpadSource,
    /const shouldRefreshApps =\s*shouldRefreshPlugins \|\| queryKeyMatchesPrefix\(notification\.queryKey, APPS_QUERY_KEY\);/s,
  );
  assert.match(
    scratchpadSource,
    /const shouldRefreshSkills =\s*shouldRefreshPlugins \|\| queryKeyMatchesPrefix\(notification\.queryKey, SKILLS_QUERY_KEY\);/s,
  );
  assert.match(
    scratchpadSource,
    /void refreshPageData\(\{\s*forceRefetchApps: shouldRefreshApps,\s*forceReloadSkills: shouldRefreshSkills,\s*\}\);/s,
  );
  assert.match(scratchpadSource, /void onQueryCacheInvalidated\(\(notification\) => \{/);
});

test("apps, plugins, and skills writes emit query-cache invalidation for scratchpad mention refresh", async () => {
  const appsServiceSource = await readFile(APPS_SERVICE_PATH, "utf8");
  const pluginsServiceSource = await readFile(PLUGINS_SERVICE_PATH, "utf8");
  const skillsServiceSource = await readFile(SKILLS_SERVICE_PATH, "utf8");

  assert.match(appsServiceSource, /import\s+\{\s*emitQueryCacheInvalidated\s*\}\s+from\s+"\.\/queryCache"/);
  assert.match(appsServiceSource, /const APPS_QUERY_KEY = \["apps", "list"\] as const;/);
  assert.match(
    appsServiceSource,
    /await emitQueryCacheInvalidated\(\[\.\.\.APPS_QUERY_KEY, hostId \?\? null\]\);/,
  );

  assert.match(pluginsServiceSource, /import\s+\{\s*emitQueryCacheInvalidated\s*\}\s+from\s+"\.\/queryCache"/);
  assert.match(pluginsServiceSource, /const PLUGIN_QUERY_KEY = \["plugins"\] as const;/);
  assert.match(
    pluginsServiceSource,
    /await emitQueryCacheInvalidated\(\[\.\.\.PLUGIN_QUERY_KEY, hostId \?\? null\]\);/,
  );

  assert.match(skillsServiceSource, /import\s+\{\s*emitQueryCacheInvalidated\s*\}\s+from\s+"\.\/queryCache"/);
  assert.match(skillsServiceSource, /const SKILLS_QUERY_KEY = \["skills"\] as const;/);
  assert.match(
    skillsServiceSource,
    /await emitQueryCacheInvalidated\(\[\.\.\.SKILLS_QUERY_KEY, hostId \?\? null\]\);/,
  );
});

test("scratchpad at-mention autocomplete uses app-only candidates and shared row labels", async () => {
  const promptInputSource = await readFile(SHARED_PROMPT_EDITOR_PATH, "utf8");
  const mentionCandidatesSource = await readFile(SHARED_PROMPT_EDITOR_CANDIDATES_PATH, "utf8");
  const overlaySource = await readFile(SHARED_PROMPT_EDITOR_OVERLAY_PATH, "utf8");

  assert.match(promptInputSource, /const appMentionState = useMemo\(\s*\(\) => getMentionStateForSymbol\(mentionState, "@"\),/s);
  assert.match(promptInputSource, /const skillMentionState = useMemo\(\s*\(\) => getMentionStateForSymbol\(mentionState, "\$"\),/s);
  assert.match(promptInputSource, /const appMentionCandidates = useMemo\(\(\) => \{/);
  assert.match(promptInputSource, /const skillMentionCandidates = useMemo\(\(\) => \{/);
  assert.match(
    promptInputSource,
    /return buildAppMentionCandidates\(\{\s*mentionState: appMentionState,\s*apps,\s*t,\s*\}\);/s,
  );
  assert.match(
    promptInputSource,
    /return buildSkillMentionCandidates\(\{\s*mentionState: skillMentionState,\s*skills,\s*activeWorkspaceRoots,\s*t,\s*\}\);/s,
  );
  assert.match(mentionCandidatesSource, /function buildAppMentionCandidates\(/);
  assert.match(mentionCandidatesSource, /if \(mentionState === null \|\| mentionState\.symbol !== "@"\) \{/);
  assert.match(mentionCandidatesSource, /function buildSkillMentionCandidates\(/);
  assert.match(mentionCandidatesSource, /if \(mentionState === null \|\| mentionState\.symbol !== "\$"\) \{/);
  assert.match(mentionCandidatesSource, /scopeLabel: t\("apps\.appConnectOAuthCallbackPage\.fallbackAppName"\),/);
  assert.match(mentionCandidatesSource, /return appCandidates;/);
  assert.doesNotMatch(mentionCandidatesSource, /return \[\.\.\.appCandidates, \.\.\.fileCandidates\]/);
  assert.match(promptInputSource, /const appMentionOverlay = renderMentionOverlay\(/);
  assert.match(promptInputSource, /const skillMentionOverlay = renderMentionOverlay\(/);
  assert.match(overlaySource, /function renderMentionOverlay<.*>\(/s);
  assert.match(promptInputSource, /const placement = getMentionOverlayPlacement\(editorRef\.current\);/);
  assert.match(promptInputSource, /const nextLayout = getMentionOverlayLayout\(editorRef\.current, placement\);/);
  assert.match(overlaySource, /export function getMentionOverlayPlacement\(editor: HTMLDivElement \| null\)/);
  assert.match(overlaySource, /spaceBelow < OVERLAY_TOP_THRESHOLD && spaceAbove > spaceBelow \? "top" : "bottom"/);
  assert.match(promptInputSource, /if \(appMentionCandidates\.length > 0\) \{/);
  assert.match(promptInputSource, /if \(skillMentionCandidates\.length > 0\) \{/);
  assert.match(overlaySource, /function renderMentionCandidateIcon\(candidate: PromptEditorMentionCandidate\)/);
  assert.match(overlaySource, /className="flex w-full min-w-0 items-center gap-2"/);
  assert.match(overlaySource, /className="ml-auto shrink-0 text-\[12px\] text-token-text-secondary"/);
  assert.match(mentionCandidatesSource, /function getSkillScopeLabel\(/);
  assert.match(mentionCandidatesSource, /t\("skills\.scope\.team"\)/);
  assert.match(mentionCandidatesSource, /t\("skills\.scope\.personal"\)/);
  assert.match(mentionCandidatesSource, /t\("skills\.scope\.adminInstalled"\)/);
  assert.match(mentionCandidatesSource, /t\("skills\.scope\.builtIn"\)/);
  assert.doesNotMatch(overlaySource, /candidate\.kind === "skill" \? "\\$" : "@"/);
});

test("scratchpad prompt input loads active workspace roots for the current page host", async () => {
  const promptInputSource = await readFile(SHARED_PROMPT_EDITOR_PATH, "utf8");
  const chatComposerSource = await readFile(USER_MESSAGE_EDIT_COMPOSER_PATH, "utf8");

  assert.match(promptInputSource, /hostId\?: string \| null;/);
  assert.match(promptInputSource, /export function PromptEditor\(\{\s*[\s\S]*hostId = null,/);
  assert.match(promptInputSource, /const response = await readActiveWorkspaceRoots\(hostId\);/);
  assert.match(promptInputSource, /\}, \[hostId\]\);/);
  assert.doesNotMatch(promptInputSource, /const response = await readActiveWorkspaceRoots\(\);/);
  assert.match(chatComposerSource, /import\s+\{\s*PromptEditor\s*\}\s+from\s+"\.\.\/promptEditor"/);
  assert.match(chatComposerSource, /<PromptEditor[\s\S]*hostId=\{hostId\}/);
});
