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
} from "../../services/automations";
import type { ModelListEntry } from "../../services/settings";
import { AutomationsCreateDialog } from "./AutomationsCreateDialog";
import type { AutomationLocalEnvironmentState } from "./useAutomationLocalEnvironmentSelection";

const ROUTE_PAGE_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/automations/AutomationsRoutePage.tsx",
);
const CREATE_DIALOG_SOURCE_PATH = path.join(
  process.cwd(),
  "src/features/automations/AutomationsCreateDialog.tsx",
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
        t={translate}
        workspaceRootLabels={{}}
        workspaceRootOptions={[]}
      />
    </StaticI18nProvider>,
  );

  assert.match(markup, /Worktree/);
  assert.doesNotMatch(markup, /<button[^>]*>Local<\/button>/);
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
