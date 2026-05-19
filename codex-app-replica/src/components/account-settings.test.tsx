/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountSettings } from "./AccountSettings";
import { I18N_CONTEXT } from "../i18n/i18n";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../i18n/messages";
import { initialAuthSnapshot } from "../services/auth";

const ACCOUNT_SETTINGS_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/AccountSettings.tsx",
);

test("account settings uses extracted shared settings shell and row layout", () => {
  const source = readSource(ACCOUNT_SETTINGS_SOURCE_PATH);

  assert.match(source, /SettingsSectionTitle/);
  assert.match(source, /title=\{<SettingsSectionTitle slug="account" \/>}/);
  assert.match(source, /SettingsGroup\.Header/);
  assert.match(source, /SettingsGroup\.Content/);
  assert.match(source, /SettingsSurface/);
  assert.match(source, /grid min-h-14 items-center gap-1 px-4 py-2 sm:grid-cols-\[160px_minmax\(0,1fr\)\] sm:gap-6/);
  assert.match(source, /subtitle=\{t\("settings\.account\.subtitle"\)\}/);
});

test("account settings keeps extracted auth gate, local auth override, and non-loading buttons", () => {
  const source = readSource(ACCOUNT_SETTINGS_SOURCE_PATH);

  assert.match(source, /const \[localAuthMethod, setLocalAuthMethod\] = useState<string \| null>\(null\)/);
  assert.match(source, /const authMethod = localAuthMethod \?\? authSnapshot\.authState\.authMethod/);
  assert.match(source, /authMethod === "chatgpt" \|\|/);
  assert.match(source, /authMethod === "chatgptAuthTokens"/);
  assert.match(source, /setLocalAuthMethod\("chatgpt"\)/);
  assert.doesNotMatch(source, /loading=\{/);
  assert.match(source, /<Button\s+type="button"\s+color="outline"/);
  assert.match(source, /<Button type="submit" disabled=\{trimmedTokenDraft.length === 0\}>/);
});

test("account settings invalidates extracted account and environments query keys", () => {
  const source = readSource(ACCOUNT_SETTINGS_SOURCE_PATH);

  assert.match(source, /await invalidateAccountSettingsQueries\(\)/);
  assert.match(source, /await logoutForHost\(LOCAL_SETTINGS_HOST_ID\)/);
  assert.doesNotMatch(source, /clearBrowserChatGptTokenAuth\(\)/);
  assert.doesNotMatch(source, /onShowToast/);
});

test("account settings renders extracted sign-out and update-token actions", () => {
  const markup = renderToStaticMarkup(
    <StaticI18nProvider>
      <AccountSettings
        authSnapshot={{
          ...initialAuthSnapshot,
          isLoading: false,
          authState: {
            ...initialAuthSnapshot.authState,
            authMethod: "chatgpt",
            email: "dev@example.com",
            accountId: "acct_123",
            userId: "user_123",
            planAtLogin: "plus",
          },
        }}
        onNavigateToLogin={noop}
      />
    </StaticI18nProvider>,
  );

  assert.match(markup, /Current account/);
  assert.match(markup, /Browser token/);
  assert.match(markup, /Sign out/);
  assert.match(markup, /Update token/);
  assert.match(markup, /ChatGPT bearer token/);
  assert.doesNotMatch(markup, /Token saved/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
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
