/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { AppConnectOAuthCallbackPage } from "./AppConnectOAuthCallbackPage";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/apps/__snapshots__/app-connect-oauth-callback-page.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.APP_CONNECT_OAUTH_CALLBACK_PAGE_UPDATE_SNAPSHOTS === "1";

test("app connect oauth callback page snapshots", async () => {
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

  assert.deepEqual(actualSnapshots, expectedSnapshots);
  assert.match(
    actualSnapshots.page,
    /flex h-full w-full items-center justify-center/,
  );
  assert.match(actualSnapshots.page, /animate-spin/);
  assert.match(actualSnapshots.page, /icon-sm/);
  assert.doesNotMatch(actualSnapshots.page, /button/);
});

type SnapshotMap = {
  page: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    page: renderSnapshot(
      <AppConnectOAuthCallbackPage
        locationKey="callback-key"
        onNavigate={noopNavigate}
        onShowToast={noopToast}
        routeState={null}
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
          setLocale: noopSetLocale,
          t: (key, values) => interpolateMessage(defaultMessageForKey(key), values),
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
    .replace(/animation-delay:[^;"]+;?/g, "animation-delay:[delay];")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function defaultMessageForKey(key: string) {
  switch (key) {
    case "apps.appConnectOAuthCallbackPage.fallbackAppName":
      return "App";
    case "apps.appConnectOAuthCallbackPage.missingData":
      return "Missing OAuth callback data.";
    case "apps.appConnectOAuthCallbackPage.pending":
      return "Finishing {connector} setup";
    case "apps.appConnectOAuthCallbackPage.requestFailed":
      return "Failed to finish connecting app.";
    case "apps.appConnectOAuthCallbackPage.success":
      return "{appName} is now connected.";
    default:
      return key;
  }
}

function interpolateMessage(
  message: string,
  values?: Record<string, number | string>,
) {
  if (!values) {
    return message;
  }

  return message.replace(/\{([^}]+)\}/g, (_match, key) => {
    const value = values[key];
    return value == null ? "" : String(value);
  });
}

function noopNavigate() {}

function noopSetLocale() {}

function noopToast() {}
