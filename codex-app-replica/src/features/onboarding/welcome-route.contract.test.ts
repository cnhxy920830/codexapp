import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  isExplicitWelcomeOnboardingOverride,
  shouldClearActiveWorkspaceRootOnWelcomeCompletion,
} from "./welcomeRouteModel";

test("simple welcome card is reserved for the explicit welcome override", () => {
  assert.equal(isExplicitWelcomeOnboardingOverride("welcome"), true);
  assert.equal(isExplicitWelcomeOnboardingOverride(" Welcome "), true);
  assert.equal(isExplicitWelcomeOnboardingOverride("auto"), false);
  assert.equal(isExplicitWelcomeOnboardingOverride("workspace"), false);
  assert.equal(isExplicitWelcomeOnboardingOverride(null), false);
});

test("welcome completion only preserves the active workspace root for the explicit welcome override", () => {
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("welcome"), false);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("auto"), true);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("workspace"), true);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion(null), true);
});

test("WelcomePage keeps the extracted route split between auto-complete, simple welcome, and welcome v2", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/WelcomePage.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /if \(!shouldUseWelcomeV2Onboarding\) \{\s*if \(!hasExplicitWelcomeOverride\) \{\s*return \(\s*<AutoCompleteToHome/s,
  );
  assert.match(
    source,
    /return \(\s*<WelcomeShell>\s*<SimpleWelcomeCard onContinue=\{onContinueToWorkspace\} t=\{t\} \/>\s*<\/WelcomeShell>/s,
  );
  assert.match(source, /if \(mode === null\) \{\s*return null;\s*\}/s);
  assert.match(
    source,
    /clearActiveWorkspaceRootOnComplete=\{shouldClearActiveWorkspaceRootOnWelcomeCompletion\(\s*hasExplicitWelcomeOverride \? "welcome" : "auto",\s*\)\}/s,
  );
});

test("App welcome callbacks match the extracted welcome page state writes and routing", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /onAutoCompleteToHome=\{\(\) => \{\s*const completedAt = Math\.floor\(Date\.now\(\) \/ 1_000\);\s*void Promise\.all\(\[\s*setGlobalState\("conversationDetailMode", "STEPS_COMMANDS"\),\s*setGlobalState\("electron:onboarding-welcome-pending", false\),\s*setGlobalState\("electron:onboarding-projectless-completed", true\),\s*setGlobalState\("electron:onboarding-hide-first-new-thread-promos", true\),\s*setGlobalState\("last_completed_onboarding", completedAt\),\s*setGlobalState\("active-remote-project-id", null\),\s*clearActiveWorkspaceRoot\(\),/s,
  );
  assert.match(
    source,
    /onCompleteToHome=\{\(\) => \{\s*if \(typeof window !== "undefined"\) \{\s*window\.history\.replaceState\(\s*window\.history\.state,\s*"",\s*`\/\?\$\{WELCOME_V2_ONBOARDING_QUERY_PARAM\}=1`,\s*\);\s*\}\s*openNewConversation\(\{ focusComposerNonce: Date\.now\(\) \}\);/s,
  );
  assert.match(
    source,
    /onContinueToWorkspace=\{\(\) => \{\s*const pendingUpdates = \[setGlobalState\("electron:onboarding-welcome-pending", false\)\];\s*if \(hasExplicitWelcomeOnboardingOverride\) \{\s*pendingUpdates\.unshift\(setGlobalState\("electron:onboarding-override", "workspace"\)\);\s*\}\s*void Promise\.all\(pendingUpdates\)\.catch\(\(\) => undefined\);\s*if \(typeof window !== "undefined"\) \{\s*window\.history\.replaceState\(window\.history\.state, "", SELECT_WORKSPACE_ROUTE_PATH\);\s*\}\s*setCurrentRoute\("select-workspace"\);/s,
  );
  assert.doesNotMatch(
    source,
    /onContinueToWorkspace=\{\(\) => \{[\s\S]*setCurrentWindowHostId\(LOCAL_SETTINGS_HOST_ID\)[\s\S]*\}\}/,
  );
});
