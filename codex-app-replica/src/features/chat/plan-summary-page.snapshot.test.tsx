/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { DEFAULT_LOCALE, MESSAGES, getMessageLocale, type MessageKey } from "../../i18n/messages";
import { PlanSummaryPage } from "./PlanSummaryPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/chat/__snapshots__/plan-summary-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.PLAN_SUMMARY_PAGE_UPDATE_SNAPSHOTS === "1";

test("plan summary page snapshots", async (t) => {
  const actualSnapshots = {
    loading: renderPlanSummaryPage(null),
    loaded: renderPlanSummaryPage({
      conversationId: "conversation-123",
      planContent: "# Plan\n\n- First\n- Second",
    }),
    whitespaceOnlyLoaded: renderPlanSummaryPage({
      conversationId: "conversation-123",
      planContent: "   ",
    }),
  };

  await t.test("loaded route state is the only source of truth", () => {
    const emptyStateMarkup = renderPlanSummaryPage({
      conversationId: "conversation-123",
    });
    assert.match(emptyStateMarkup, /animate-pulse/);
  });

  await t.test("loaded page hides open button affordance", () => {
    const markup = actualSnapshots.loaded;
    assert.doesNotMatch(markup, /Open chat|Open thread|Open conversation/);
  });

  await t.test("non-empty whitespace plan content still uses loaded route branch", () => {
    const markup = actualSnapshots.whitespaceOnlyLoaded;
    assert.doesNotMatch(markup, /animate-pulse/);
    assert.match(markup, /rounded-lg bg-token-foreground\/5/);
  });

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

function renderPlanSummaryPage(routeState: unknown) {
  return renderToStaticMarkup(
    <TestI18nProvider>
      <PlanSummaryPage routeState={routeState} />
    </TestI18nProvider>,
  );
}

function TestI18nProvider({ children }: { children: ReactNode }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: DEFAULT_LOCALE,
        setLocale: noop,
        t: (key: MessageKey, values?: Record<string, number | string>) => {
          const template = MESSAGES[getMessageLocale(DEFAULT_LOCALE)][key];
          if (!values) {
            return template;
          }

          return template.replace(/\{(\w+)\}/g, (match, token) => {
            const value = values[token];
            return value === undefined ? match : String(value);
          });
        },
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}

type SnapshotMap = {
  loading: string;
  loaded: string;
  whitespaceOnlyLoaded: string;
};

const noop = () => undefined;
