/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../../i18n/messages";
import { type AutomationRecord } from "../../services/automations";
import type { LocalEnvironmentConfigEntry } from "../../services/localEnvironments";
import { AutomationFormFields } from "./AutomationFormFields";
import { AutomationLocalEnvironmentSelector } from "./AutomationLocalEnvironmentSelector";
import { AutomationsDetailPane } from "./AutomationsDetailPane";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/automations/__snapshots__/automation-local-environment.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.AUTOMATION_LOCAL_ENVIRONMENT_UPDATE_SNAPSHOTS === "1";

test("automation local environment snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  detailRailSelector: string;
  detailRailSelectorWithHost: string;
  formFieldsSelector: string;
  selectorMenuOpen: string;
};

function buildSnapshots(): SnapshotMap {
  const draft = createCronDraft();
  const localEnvironmentState = createLocalEnvironmentState();

  return {
    detailRailSelector: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[900px]">
          <AutomationsDetailPane
            draft={draft}
            feedback={null}
            hasConnectedRemoteConnections={false}
            heartbeatThreadOptions={[]}
            inboxItems={[]}
            isInboxItemsLoading={false}
            isSaving={false}
            lastRunLabel="Yesterday at 9:41 AM"
            localEnvironmentState={localEnvironmentState}
            locale="en-US"
            modelOptions={[{ id: "gpt-5.4", hidden: false, additionalSpeedTiers: [] }]}
            nextRunLabel="Tomorrow at 8:30 AM"
            onClearDraft={noop}
            onDraftChange={noopDraftChange}
            onOpenThread={noopOpenThread}
            onSetInboxItemReadState={noopSetInboxItemReadState}
            onOpenLocalEnvironmentsSettings={noopOpenSettings}
            threadTitleById={new Map()}
            workspaceRootOptions={["D:\\workspace\\codex-app"]}
            workspaceRootLabels={{
              "D:\\workspace\\codex-app": "codex-app",
            }}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
    detailRailSelectorWithHost: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[900px]">
          <AutomationsDetailPane
            draft={draft}
            feedback={null}
            hasConnectedRemoteConnections
            heartbeatThreadOptions={[]}
            inboxItems={[]}
            isInboxItemsLoading={false}
            isSaving={false}
            lastRunLabel="Yesterday at 9:41 AM"
            localEnvironmentState={localEnvironmentState}
            locale="en-US"
            modelOptions={[{ id: "gpt-5.4", hidden: false, additionalSpeedTiers: [] }]}
            nextRunLabel="Tomorrow at 8:30 AM"
            onClearDraft={noop}
            onDraftChange={noopDraftChange}
            onOpenThread={noopOpenThread}
            onSetInboxItemReadState={noopSetInboxItemReadState}
            onOpenLocalEnvironmentsSettings={noopOpenSettings}
            threadTitleById={new Map()}
            workspaceRootOptions={["D:\\workspace\\codex-app"]}
            workspaceRootLabels={{
              "D:\\workspace\\codex-app": "codex-app",
            }}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
    formFieldsSelector: renderSnapshot(
      <StaticI18nProvider>
        <AutomationFormFields
          draft={draft}
          heartbeatThreadOptions={[]}
          localEnvironmentState={localEnvironmentState}
          onOpenLocalEnvironmentsSettings={noopOpenSettings}
          onDraftChange={noopDraftChange}
          t={translate}
        />
      </StaticI18nProvider>,
    ),
    selectorMenuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[320px]">
          <AutomationLocalEnvironmentSelector
            defaultOpen
            onOpenSettings={noopOpenSettings}
            state={createLocalEnvironmentState({
              selectedConfigPath: null,
            })}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function createCronDraft(): AutomationRecord {
  return {
    kind: "cron",
    id: "automation-local-env",
    name: "Daily triage",
    prompt: "Check the failing jobs and summarize the latest changes.",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    localEnvironmentConfigPath:
      "D:\\workspace\\codex-app\\.codex\\environments\\environment.toml",
    model: "gpt-5.4",
    reasoningEffort: "high",
    rrule: "FREQ=DAILY;INTERVAL=1",
  };
}

function createLocalEnvironmentState(
  overrides: Partial<AutomationLocalEnvironmentState> = {},
): AutomationLocalEnvironmentState {
  const environments = createEnvironmentEntries();
  return {
    environments,
    error: null,
    isLoading: false,
    onSelectConfigPath: noopConfigPathChange,
    selectedConfigPath: environments[0]?.configPath ?? null,
    visible: true,
    workspaceRoot: "D:\\workspace\\codex-app",
    ...overrides,
  };
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
    {
      configPath: "D:\\workspace\\codex-app\\.codex\\environments\\broken.toml",
      type: "error",
      error: {
        message: "bad TOML",
      },
    },
  ];
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function StaticI18nProvider({ children }: { children: ReactElement }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US" as LocaleCode,
        setLocale: noopLocale,
        t: translate,
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(MESSAGES["en-US"][key], values);
}

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

const noop = () => {};
const noopLocale = async (_locale: LocaleCode) => {};
const noopConfigPathChange = (_configPath: string | null) => {};
const noopOpenThread = async (_threadId: string) => {};
const noopSetInboxItemReadState = async (_id: string, _isRead: boolean) => {};
const noopOpenSettings = (_params: {
  configPath: string | null;
  workspaceRoot: string;
}) => {};
const noopDraftChange: Dispatch<SetStateAction<AutomationRecord | null>> = (
  _value,
) => {};
