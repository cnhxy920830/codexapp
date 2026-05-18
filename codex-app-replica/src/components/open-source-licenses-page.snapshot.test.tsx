/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../i18n/i18n";
import { MESSAGES } from "../i18n/messages";
import {
  OpenSourceLicensesPageView,
  resolveOpenSourceLicensesBackPath,
} from "./OpenSourceLicensesPage";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/components/__snapshots__/open-source-licenses-page.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.OPEN_SOURCE_LICENSES_PAGE_UPDATE_SNAPSHOTS === "1";

test("open source licenses page snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(
      SNAPSHOT_PATH,
      `${JSON.stringify(actualSnapshots, null, 2)}\n`,
    );
    return;
  }

  const expectedSnapshots = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);

      if (name === "loading") {
        assert.match(actual, /draggable flex items-center px-panel electron:h-toolbar extension:h-toolbar-sm/);
        assert.match(actual, /h-token-button-composer px-2 py-0 text-base leading-\[18px\]/);
        assert.match(actual, /Open source licenses/);
        assert.match(actual, /Third-party notices for dependencies included in this app/);
        assert.match(actual, /Loading…/);
      }

      if (name === "withText") {
        assert.match(actual, /<pre class="bg-token-surface-secondary rounded p-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-token-text-primary">/);
        assert.match(actual, /License A/);
        assert.match(actual, /License B/);
      }

      if (name === "missing") {
        assert.match(actual, /No third-party notices were found\./);
        assert.doesNotMatch(actual, /<pre /);
      }
    });
  }
});

test("resolve open source licenses back path", () => {
  assert.equal(
    resolveOpenSourceLicensesBackPath("/settings/agent"),
    "/settings/agent",
  );
  assert.equal(
    resolveOpenSourceLicensesBackPath("/settings/general"),
    "/settings/general",
  );
  assert.equal(
    resolveOpenSourceLicensesBackPath("/settings"),
    "/settings/general",
  );
  assert.equal(
    resolveOpenSourceLicensesBackPath("/chat"),
    "/settings/general",
  );
  assert.equal(
    resolveOpenSourceLicensesBackPath(null),
    "/settings/general",
  );
});

type SnapshotMap = {
  loading: string;
  missing: string;
  withText: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    loading: renderSnapshot(
      <OpenSourceLicensesPageView
        backPath="/settings/general"
        isLoading
        onNavigateBack={noop}
        text={null}
      />,
    ),
    withText: renderSnapshot(
      <OpenSourceLicensesPageView
        backPath="/settings/agent"
        isLoading={false}
        onNavigateBack={noop}
        text={"License A\n\nLicense B"}
      />,
    ),
    missing: renderSnapshot(
      <OpenSourceLicensesPageView
        backPath="/settings/general"
        isLoading={false}
        onNavigateBack={noop}
        text={null}
      />,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(
    renderToStaticMarkup(
      <I18N_CONTEXT.Provider
        value={{
          locale: "en-US",
          setLocale: noop,
          t: (key, values) => {
            const template = MESSAGES["en-US"][key];
            if (values == null) {
              return template;
            }

            return template.replace(/\{(\w+)\}/g, (match, token) => {
              const value = values[token];
              return value === undefined ? match : String(value);
            });
          },
        }}
      >
        {element}
      </I18N_CONTEXT.Provider>,
    ),
  );
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function noop() {}
