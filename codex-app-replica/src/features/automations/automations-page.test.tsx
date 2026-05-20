/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ReactNode, SetStateAction } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../../i18n/messages";
import {
  buildAutomationDraft,
  type AutomationRecord,
  type CronAutomationRecord,
  type HeartbeatAutomationRecord,
} from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { AutomationsCreateDialog } from "./AutomationsCreateDialog";
import {
  getAutomationSaveRequestDraft,
  getAutomationSaveState,
  getAutomationSaveTooltip,
  getScheduleConfigForAutomation,
  isScheduleConfigValid,
} from "./automationsPageUtils";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

const ROUTE_PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/automations/AutomationsRoutePage.tsx",
);
const CREATE_DIALOG_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/automations/AutomationsCreateDialog.tsx",
);
const DETAIL_PANE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/automations/AutomationsDetailPane.tsx",
);

test("cron automation drafts default to worktree execution environment", () => {
  const draft = buildAutomationDraft("cron");

  assert.equal(draft.kind, "cron");
  assert.equal(draft.executionEnvironment, "worktree");
});

test("automations route page keeps extracted breadcrumb and missing-state structure", () => {
  const source = readSource(ROUTE_PAGE_SOURCE_PATH);

  assert.match(source, /ForwardNavigationIcon/);
  assert.match(source, /pointer-events-none/);
  assert.match(source, /t\("inbox\.automations\.header\.root"\)/);
  assert.match(source, /t\("inbox\.automations\.missing"\)/);
  assert.match(source, /t\("inbox\.automations\.missingSubtitle"\)/);
  assert.match(source, /t\("inbox\.automations\.missingBack"\)/);
  assert.match(source, /<Button color="outline" onClick=\{onBackToAutomations\} size="toolbar">/);
});

test("automations route page keeps extracted delete-confirm copy", () => {
  const source = readSource(ROUTE_PAGE_SOURCE_PATH);

  assert.match(
    source,
    /description=\{t\("inbox\.automations\.deleteConfirm\.description"\)\}/,
  );
  assert.equal(
    MESSAGES["en-US"]["inbox.automations.deleteConfirm.description"],
    "This will permanently delete the automation and stop any future runs.",
  );
});

test("automations create dialog keeps extracted shell sizing and pointer-dismiss guard", () => {
  const source = readSource(CREATE_DIALOG_SOURCE_PATH);

  assert.match(source, /event\.preventDefault\(\)/);
  assert.match(source, /document\.addEventListener\("pointerdown", handlePointerDown, true\)/);
  assert.match(source, /automation-form/);
  assert.match(source, /max-h-\[95vh\]/);
  assert.match(source, /max-w-\[800px\]/);
  assert.match(source, /top-\[22px\]/);
});

test("automations create dialog renders extracted worktree-first cron defaults", () => {
  const draft = buildAutomationDraft("cron") as CronAutomationRecord;
  const markup = renderToStaticMarkup(
    <StaticI18nProvider>
      <AutomationsCreateDialog
        canSave={false}
        draft={draft}
        heartbeatThreadOptions={[]}
        isSaving={false}
        locale="en-US"
        localEnvironmentState={createLocalEnvironmentState()}
        modelOptions={createModelOptions()}
        onCancel={noop}
        onClearDraft={noop}
        onCreate={noop}
        onDraftChange={noopDraftChange}
        onOpenLocalEnvironmentsSettings={noopOpenSettings}
        onSelectTemplateDraft={noopSelectTemplateDraft}
        quickStartBaseDraft={draft}
        saveTooltip="Select project and choose a model to create"
        t={translate}
        workspaceRootLabels={{}}
        workspaceRootOptions={[]}
      />
    </StaticI18nProvider>,
  );

  assert.match(markup, /role="textbox"/);
  assert.match(markup, /What should Codex do\?/);
  assert.match(markup, /Runs in/);
  assert.match(markup, /Project/);
  assert.match(markup, /Repeats/);
  assert.match(markup, /Model/);
  assert.match(markup, /Reasoning/);
  assert.match(markup, /Worktree/);
  assert.doesNotMatch(markup, /<button[^>]*>Local<\/button>/);
});

test("automation save state requires project and model for cron automations", () => {
  const draft = {
    ...(buildAutomationDraft("cron") as CronAutomationRecord),
    name: "  Daily triage  ",
    prompt: "  Check CI  ",
    executionEnvironment: "worktree",
    rrule: "FREQ=DAILY;INTERVAL=1;BYHOUR=9;BYMINUTE=0;BYDAY=MO,TU,WE,TH,FR",
  };

  const saveState = getAutomationSaveState(draft);

  assert.equal(saveState.trimmedName, "Daily triage");
  assert.equal(saveState.trimmedPrompt, "Check CI");
  assert.deepEqual(saveState.missingRequirements, ["cwd", "model"]);
  assert.equal(saveState.canSave, false);
});

test("automation save state requires target thread for heartbeat automations", () => {
  const draft = {
    ...(buildAutomationDraft("heartbeat") as HeartbeatAutomationRecord),
    name: "Heartbeat",
    prompt: "Summarize the thread.",
  };

  const saveState = getAutomationSaveState(draft);

  assert.deepEqual(saveState.missingRequirements, ["thread"]);
  assert.equal(saveState.canSave, false);
});

test("automation save state rejects invalid custom schedules", () => {
  const draft = {
    ...(buildAutomationDraft("cron") as CronAutomationRecord),
    name: "Monthly audit",
    prompt: "Check the monthly report.",
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    model: "gpt-5.4",
    rrule: "RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=",
  };

  const saveState = getAutomationSaveState(draft);

  assert.deepEqual(saveState.missingRequirements, ["schedule"]);
  assert.equal(saveState.canSave, false);
  assert.equal(isScheduleConfigValid(getScheduleConfigForAutomation(draft)), false);
});

test("custom monthly schedule stays valid when full RRULE is parseable", () => {
  const draft = {
    ...(buildAutomationDraft("cron") as CronAutomationRecord),
    name: "Monthly audit",
    prompt: "Check the monthly report.",
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    model: "gpt-5.4",
    rrule: "RRULE:FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0",
  };

  assert.equal(isScheduleConfigValid(getScheduleConfigForAutomation(draft)), true);
  assert.equal(getAutomationSaveState(draft).canSave, true);
});

test("automation create tooltip uses extracted list wording", () => {
  const tooltip = getAutomationSaveTooltip({
    action: "create",
    locale: "en-US",
    missingRequirements: ["cwd", "model"],
    t: translate,
  });

  assert.equal(tooltip, "Select project and Choose a model to create");
});

test("automation save request draft trims name and prompt before persistence", () => {
  const requestDraft = getAutomationSaveRequestDraft({
    ...(buildAutomationDraft("cron") as CronAutomationRecord),
    name: "  Daily triage  ",
    prompt: "  Check CI  ",
    cwds: ["D:\\workspace\\codex-app"],
    executionEnvironment: "worktree",
    model: "gpt-5.4",
  });

  assert.equal(requestDraft.name, "Daily triage");
  assert.equal(requestDraft.prompt, "Check CI");
});

test("automations route page keeps extracted save-state and sandbox wiring", () => {
  const routePageSource = readSource(ROUTE_PAGE_SOURCE_PATH);
  const detailPaneSource = readSource(DETAIL_PANE_SOURCE_PATH);

  assert.match(routePageSource, /getAutomationSaveState/);
  assert.match(routePageSource, /getAutomationSaveRequestDraft/);
  assert.match(routePageSource, /getAutomationSaveTooltip/);
  assert.match(detailPaneSource, /readConfigForHost/);
  assert.match(detailPaneSource, /settings\.automations\.banner\.tooltipLabel/);
  assert.match(detailPaneSource, /InfoIcon/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}

function createLocalEnvironmentState(): AutomationLocalEnvironmentState {
  return {
    environments: [],
    error: null,
    isLoading: false,
    onSelectConfigPath: noopConfigPathChange,
    selectedConfigPath: null,
    visible: false,
    workspaceRoot: null,
  };
}

function createModelOptions(): ModelListEntry[] {
  return [{ id: "gpt-5.4", hidden: false, additionalSpeedTiers: [] }];
}

function StaticI18nProvider({ children }: { children: ReactNode }) {
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
const noopOpenSettings = (_params: {
  configPath: string | null;
  workspaceRoot: string;
}) => {};
const noopSelectTemplateDraft = (_draft: AutomationRecord) => {};
const noopDraftChange = (_value: SetStateAction<AutomationRecord | null>) => {};
