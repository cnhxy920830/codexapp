/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const LOGIN_ROUTE_PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/auth/LoginRoutePage.tsx",
);
const AUTH_SERVICE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/services/auth.ts",
);
const APP_SOURCE_PATH = path.join(process.cwd(), "src/App.tsx");

test("login route page waits for browser completion before the welcome handoff", () => {
  const source = readSource(LOGIN_ROUTE_PAGE_SOURCE_PATH);

  assert.match(source, /loginChatGptWithCompletion/);
  assert.match(source, /const completion = await result\.completion;/);
  assert.match(
    source,
    /const completion = await result\.completion;[\s\S]*await completeLoginSuccess\(\);\s*onNavigateToWelcome\("chatgpt"\);/,
  );
  assert.match(
    source,
    /const pendingController = browserLoginAbortController;[\s\S]*if \(pendingController !== null\) \{\s*pendingController\.abort\(\);\s*return;\s*\}[\s\S]*if \(!authSnapshot\.activeLoginId\) \{\s*return;\s*\}/,
  );
  assert.match(
    source,
    /onPlaySnake=\{\(\) => \{\s*prepareSnakeAudio\(\);\s*setIsSnakeVisible\(true\);\s*\}\}/,
  );
  assert.match(
    source,
    /<LoginSnakeGame\s+audioContextRef=\{audioContextRef\}\s+onExit=\{\(\) => setIsSnakeVisible\(false\)\}\s+\/>/,
  );
});

test("auth service waits for local auth snapshot completion instead of returning immediate success", () => {
  const source = readSource(AUTH_SERVICE_SOURCE_PATH);

  assert.doesNotMatch(
    source,
    /completion:\s*Promise\.resolve\(\s*\{[\s\S]*success:\s*true[\s\S]*\}\s*\)/,
  );
  assert.match(
    source,
    /normalizedHostId == null\s*\?\s*onAuthSnapshotChange\(handleLocalSnapshot\)\s*:\s*onRemoteChatGptLoginCompleted\(handleRemoteCompletion\)/,
  );
  assert.match(source, /if \(snapshot\.activeLoginId === start\.loginId\) \{\s*return;\s*\}/);
  assert.match(source, /if \(snapshot\.activeLoginId !== null\) \{\s*return;\s*\}/);
  assert.match(
    source,
    /success:\s*snapshot\.lastLoginError == null,\s*error:\s*snapshot\.lastLoginError,/,
  );
});

test("app route keeps a frontend auth handoff for login success before welcome navigation", () => {
  const source = readSource(APP_SOURCE_PATH);

  assert.match(source, /onNavigateToWelcome=\{\(authMethod\) => \{/);
  assert.match(
    source,
    /setRawAuthSnapshot\(\(current\) => \(\{[\s\S]*authMethod,[\s\S]*isLoading:\s*false,[\s\S]*lastLoginError:\s*null,/,
  );
  assert.match(source, /window\.history\.replaceState\(window\.history\.state,\s*"",\s*WELCOME_ROUTE_PATH\)/);
  assert.match(source, /setCurrentRoute\("welcome"\)/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
