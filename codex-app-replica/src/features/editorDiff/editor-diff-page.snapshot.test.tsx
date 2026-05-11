/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { EditorDiffPage } from "./EditorDiffPage";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/editorDiff/__snapshots__/editor-diff-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.EDITOR_DIFF_PAGE_UPDATE_SNAPSHOTS === "1";

test("editor diff page snapshots", async (t) => {
  const actualSnapshots: SnapshotMap = {
    missingRouteState: renderSnapshot(
      <StaticI18nProvider>
        <EditorDiffPage routeState={null} />
      </StaticI18nProvider>,
    ),
    loadedDiff: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[900px]">
          <EditorDiffPage
            routeState={{
              conversationId: "conv-editor-diff",
              cwd: "D:\\workspace\\codex",
              unifiedDiff:
                "diff --git a/src/App.tsx b/src/App.tsx\n" +
                "index 1111111..2222222 100644\n" +
                "--- a/src/App.tsx\n" +
                "+++ b/src/App.tsx\n" +
                "@@ -1,4 +1,5 @@\n" +
                " import { useState } from \"react\";\n" +
                "-import { LoadingPage } from \"./components/LoadingPage\";\n" +
                "+import { LoadingPage } from \"./components/LoadingPage\";\n" +
                "+import { EditorDiffPage } from \"./features/editorDiff/EditorDiffPage\";\n" +
                " export default function App() {\n" +
                "   return null;\n" +
                " }\n",
            }}
          />
        </div>
      </StaticI18nProvider>,
    ),
  };

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

type SnapshotMap = {
  loadedDiff: string;
  missingRouteState: string;
};

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

const noopLocale = (_locale: LocaleCode) => {};

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
        typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
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
