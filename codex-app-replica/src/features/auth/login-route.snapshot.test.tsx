/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import { LoginRouteView } from "./LoginRouteView";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/auth/__snapshots__/login-route.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.LOGIN_ROUTE_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("login route snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

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
  apiKeyEntry: string;
  browserPending: string;
  defaultState: string;
  multiProviderState: string;
  snakeState: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    apiKeyEntry: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <LoginRouteView
            apiKeyValue="sk-test"
            isApiKeyEntryVisible
            isApiKeySignInPending={false}
            isBrowserSignInPending={false}
            isSnakeVisible={false}
            onApiKeyCancel={noop}
            onApiKeySubmit={noop}
            onApiKeyValueChange={noopString}
            onCancelSignIn={noop}
            onChatGptSignIn={noop}
            onPlaySnake={noop}
            onShowApiKeyEntry={noop}
            onSignUp={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    browserPending: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <LoginRouteView
            apiKeyValue=""
            isApiKeyEntryVisible={false}
            isApiKeySignInPending={false}
            isBrowserSignInPending
            isSnakeVisible={false}
            onApiKeyCancel={noop}
            onApiKeySubmit={noop}
            onApiKeyValueChange={noopString}
            onCancelSignIn={noop}
            onChatGptSignIn={noop}
            onPlaySnake={noop}
            onShowApiKeyEntry={noop}
            onSignUp={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    defaultState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <LoginRouteView
            apiKeyValue=""
            isApiKeyEntryVisible={false}
            isApiKeySignInPending={false}
            isBrowserSignInPending={false}
            isSnakeVisible={false}
            onApiKeyCancel={noop}
            onApiKeySubmit={noop}
            onApiKeyValueChange={noopString}
            onCancelSignIn={noop}
            onChatGptSignIn={noop}
            onPlaySnake={noop}
            onShowApiKeyEntry={noop}
            onSignUp={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    multiProviderState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <LoginRouteView
            apiKeyValue=""
            isApiKeyEntryVisible={false}
            isApiKeySignInPending={false}
            isBrowserSignInPending={false}
            isSnakeVisible={false}
            onApiKeyCancel={noop}
            onApiKeySubmit={noop}
            onApiKeyValueChange={noopString}
            onCancelSignIn={noop}
            onChatGptSignIn={noop}
            onGoogleSignIn={noop}
            onMicrosoftSignIn={noop}
            onPlaySnake={noop}
            onShowApiKeyEntry={noop}
            onSignUp={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    snakeState: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[720px]">
          <LoginRouteView
            apiKeyValue=""
            isApiKeyEntryVisible={false}
            isApiKeySignInPending={false}
            isBrowserSignInPending={false}
            isSnakeVisible
            onApiKeyCancel={noop}
            onApiKeySubmit={noop}
            onApiKeyValueChange={noopString}
            onCancelSignIn={noop}
            onChatGptSignIn={noop}
            onPlaySnake={noop}
            onShowApiKeyEntry={noop}
            onSignUp={noop}
            snakeGame={<div data-snapshot="snake-game" />}
          />
        </div>
      </StaticI18nProvider>,
    ),

  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/src="[^"]*codex-app-ga-logo--UgmJjKM\.png"/g, 'src="[asset]"')
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

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

const noop = () => {};
const noopString = (_value: string) => {};
const noopLocale = async (_locale: LocaleCode) => {};
