/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AutomationsOverviewPane } from "./AutomationsOverviewPane";
import { I18N_CONTEXT } from "../../i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../../i18n/messages";
import type {
  AutomationRecord,
  CronAutomationRecord,
} from "../../services/automations";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/automations/__snapshots__/automations-overview.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.AUTOMATIONS_OVERVIEW_UPDATE_SNAPSHOTS === "1";

test("automations overview snapshots", async (t) => {
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
  emptyState: string;
  populatedState: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    emptyState: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[1280px] h-[900px]">
          <AutomationsOverviewPane
            isLoading={false}
            isRunningNowId={null}
            items={[]}
            locale="en-US"
            openRowMenuId={null}
            quickStartBaseDraft={createBaseDraft()}
            selectedId={null}
            threadNameById={new Map()}
            workspaceRootLabels={{}}
            onDeleteAutomation={noopAutomation}
            onPauseAutomation={noopAutomation}
            onSelectQuickStart={noopCronDraft}
            onResumeAutomation={noopAutomation}
            onRunAutomationNow={noopAutomation}
            onSelectAutomation={noopAutomation}
            onToggleMenu={noopMenu}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
    populatedState: renderSnapshot(
      <StaticI18nProvider>
        <div className="w-[1280px] h-[900px]">
          <AutomationsOverviewPane
            isLoading={false}
            isRunningNowId="current-1"
            items={[createCurrentAutomation(), createPausedAutomation()]}
            locale="en-US"
            openRowMenuId="paused-1"
            quickStartBaseDraft={createBaseDraft()}
            selectedId="current-1"
            threadNameById={new Map()}
            workspaceRootLabels={{
              "D:\\workspace\\codex-app": "codex-app",
            }}
            onDeleteAutomation={noopAutomation}
            onPauseAutomation={noopAutomation}
            onSelectQuickStart={noopCronDraft}
            onResumeAutomation={noopAutomation}
            onRunAutomationNow={noopAutomation}
            onSelectAutomation={noopAutomation}
            onToggleMenu={noopMenu}
            t={translate}
          />
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function createBaseDraft(): CronAutomationRecord {
  return {
    kind: "cron",
    id: "base-draft",
    name: "",
    prompt: "",
    status: "ACTIVE",
    createdAt: null,
    updatedAt: null,
    lastRunAt: null,
    nextRunAt: null,
    cwds: [],
    executionEnvironment: "local",
    localEnvironmentConfigPath: null,
    model: null,
    reasoningEffort: null,
    rrule: "FREQ=DAILY;INTERVAL=1",
  };
}

function createCurrentAutomation(): AutomationRecord {
  return {
    kind: "cron",
    id: "current-1",
    name: "Release notes",
    prompt: "Draft weekly release notes.",
    status: "ACTIVE",
    createdAt: 1_715_248_000_000,
    updatedAt: 1_715_248_000_000,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    localEnvironmentConfigPath: null,
    model: "gpt-5.4",
    reasoningEffort: "high",
    rrule: "FREQ=WEEKLY;INTERVAL=1;BYHOUR=9;BYMINUTE=0;BYDAY=FR",
  };
}

function createPausedAutomation(): AutomationRecord {
  return {
    kind: "cron",
    id: "paused-1",
    name: "CI monitor",
    prompt: "Check CI failures.",
    status: "PAUSED",
    createdAt: 1_715_248_000_000,
    updatedAt: 1_715_248_000_000,
    lastRunAt: null,
    nextRunAt: null,
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "local",
    localEnvironmentConfigPath: null,
    model: "gpt-5.4",
    reasoningEffort: "medium",
    rrule: "FREQ=HOURLY;INTERVAL=2;BYMINUTE=0;BYDAY=MO,TU,WE,TH,FR",
  };
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

  const formattedPluralTemplate = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, token, oneVariant, otherVariant) => {
      const rawValue = values[token];
      const numericValue =
        typeof rawValue === "number"
          ? rawValue
          : typeof rawValue === "string"
            ? Number(rawValue)
            : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const variant = numericValue === 1 ? oneVariant : otherVariant;
      return variant.replaceAll("#", String(numericValue));
    },
  );

  return formattedPluralTemplate.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

const noopLocale = async (_locale: LocaleCode) => {};
const noopAutomation = (_automation: AutomationRecord) => {};
const noopCronDraft = (_draft: CronAutomationRecord) => {};
const noopMenu = (_automationId: string | null) => {};
