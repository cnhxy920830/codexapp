/// <reference types="node" />

import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  CronAutomationRecord,
  HeartbeatAutomationRecord,
} from "../../services/automations";
import type { LocalEnvironmentConfigEntry } from "../../services/localEnvironments";
import {
  getAutomationLocalEnvironmentWorkspaceRoot,
  resolveAutomationLocalEnvironmentSelection,
} from "./useAutomationLocalEnvironmentSelection";

test("automation local environment workspace root only exists for single-cwd worktree cron drafts", () => {
  assert.equal(
    getAutomationLocalEnvironmentWorkspaceRoot(createCronDraft()),
    "D:\\workspace\\codex-app",
  );
  assert.equal(
    getAutomationLocalEnvironmentWorkspaceRoot({
      ...createCronDraft(),
      executionEnvironment: "local",
    }),
    null,
  );
  assert.equal(
    getAutomationLocalEnvironmentWorkspaceRoot({
      ...createCronDraft(),
      cwds: ["D:\\workspace\\codex-app", "D:\\workspace\\other"],
    }),
    null,
  );
  assert.equal(
    getAutomationLocalEnvironmentWorkspaceRoot(createHeartbeatDraft()),
    null,
  );
});

test("automation local environment selection does not auto-pick the default environment on first visit", () => {
  const result = resolveAutomationLocalEnvironmentSelection({
    canValidateSelection: true,
    environments: createEnvironmentEntries(),
    hostId: "local",
    selectionsByWorkspace: {},
    workspaceRoot: "D:\\workspace\\codex-app",
  });

  assert.equal(result.visible, true);
  assert.equal(result.selectedConfigPath, null);
});

test("automation local environment selection falls back to the default environment when a remembered choice disappears", () => {
  const result = resolveAutomationLocalEnvironmentSelection({
    canValidateSelection: true,
    environments: createEnvironmentEntries(),
    hostId: "local",
    selectionsByWorkspace: {
      "local:D:/workspace/codex-app":
        "D:\\workspace\\codex-app\\.codex\\environments\\missing.toml",
    },
    workspaceRoot: "D:\\workspace\\codex-app",
  });

  assert.equal(
    result.selectedConfigPath,
    "D:\\workspace\\codex-app\\.codex\\environments\\environment.toml",
  );
});

function createCronDraft(): CronAutomationRecord {
  return {
    kind: "cron",
    id: "automation-test",
    name: "Cron draft",
    prompt: "Run checks",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    localEnvironmentConfigPath: null,
    model: "gpt-5.4",
    reasoningEffort: "high",
    rrule: "FREQ=DAILY;INTERVAL=1",
  } satisfies CronAutomationRecord;
}

function createHeartbeatDraft(): HeartbeatAutomationRecord {
  return {
    kind: "heartbeat",
    id: "heartbeat-test",
    name: "Heartbeat draft",
    prompt: "Ping the thread",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    targetThreadId: "thread-1",
    model: null,
    reasoningEffort: null,
    rrule: "FREQ=MINUTELY;INTERVAL=30",
  } satisfies HeartbeatAutomationRecord;
}

function createEnvironmentEntries(): LocalEnvironmentConfigEntry[] {
  return [
    {
      configPath: "D:\\workspace\\codex-app\\.codex\\environments\\environment.toml",
      type: "success",
      environment: {
        version: 1,
        name: "Default env",
        setup: { script: "", darwin: null, linux: null, win32: null },
        cleanup: { script: "", darwin: null, linux: null, win32: null },
        actions: [],
      },
    },
    {
      configPath: "D:\\workspace\\codex-app\\.codex\\environments\\environment-2.toml",
      type: "success",
      environment: {
        version: 1,
        name: "Staging env",
        setup: { script: "", darwin: null, linux: null, win32: null },
        cleanup: { script: "", darwin: null, linux: null, win32: null },
        actions: [],
      },
    },
  ];
}
