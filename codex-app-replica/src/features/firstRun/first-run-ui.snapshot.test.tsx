/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MESSAGES,
  type LocaleCode,
  type MessageKey,
  type MessageValues,
} from "../../i18n/messages";
import { FirstRunButton } from "./FirstRunButton";
import { FirstRunAsciiBackground } from "./FirstRunAsciiBackground";
import { FirstRunPage } from "./FirstRunPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/features/firstRun/__snapshots__/first-run-ui.snap.json");
const UPDATE_SNAPSHOTS = process.env.FIRST_RUN_UI_UPDATE_SNAPSHOTS === "1";
const LOCALE: LocaleCode = "en-US";
const EN_US_MESSAGES = MESSAGES[LOCALE];

test("first run ui snapshots", async (t) => {
  const actualSnapshots = {
    asciiBackground: renderSnapshot(<FirstRunAsciiBackground />),
    outlineButton: renderSnapshot(
      <FirstRunButton color="outline" onClick={noop}>
        Back
      </FirstRunButton>,
    ),
    primaryButton: renderSnapshot(
      <FirstRunButton onClick={noop}>
        Continue
      </FirstRunButton>,
    ),
    chatgptIntroPage: renderSnapshot(
      <FirstRunPage authMethod="chatgpt" locale={LOCALE} onAccept={noop} t={tMessage} />,
    ),
    chatgptCloudPage: renderSnapshot(
      <FirstRunPage authMethod="chatgpt" initialStepOverride={1} locale={LOCALE} onAccept={noop} t={tMessage} />,
    ),
    chatgptTodoPage: renderSnapshot(
      <FirstRunPage authMethod="chatgpt" initialStepOverride={2} locale={LOCALE} onAccept={noop} t={tMessage} />,
    ),
    chatgptTodoPageWide: renderSnapshotWithWindowWidth(
      <FirstRunPage authMethod="chatgpt" initialStepOverride={2} locale={LOCALE} onAccept={noop} t={tMessage} />,
      800,
    ),
    apiKeyLegalPage: renderSnapshot(
      <FirstRunPage authMethod={null} locale={LOCALE} onAccept={noop} t={tMessage} />,
    ),
    copilotLegalPage: renderSnapshot(
      <FirstRunPage authMethod="copilot" locale={LOCALE} onAccept={noop} t={tMessage} />,
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
      if (name === "asciiBackground") {
        assert.match(actual, /25%/);
        assert.match(actual, /30%/);
        assert.match(actual, /50%/);
        assert.match(actual, /35%/);
        assert.match(actual, /78%/);
      }
      if (name === "outlineButton") {
        assert.match(actual, /user-select-none no-drag cursor-interaction/);
        assert.match(actual, /text-token-button-tertiary-foreground/);
      }
      if (name === "primaryButton") {
        assert.match(actual, /user-select-none no-drag cursor-interaction/);
        assert.match(actual, /bg-token-foreground/);
      }
      if (name === "chatgptIntroPage") {
        assert.match(actual, /Codex in your IDE/);
        assert.match(actual, /Codex navigates, edits, runs commands, and executes tests directly in your repo/);
      }
      if (name === "chatgptCloudPage") {
        assert.match(actual, /Hand off to Codex in the cloud/);
        assert.match(actual, /openai\/codex · Oct 8/);
        assert.match(actual, /\+249/);
      }
      if (name === "chatgptTodoPage") {
        assert.match(actual, /Turn TODOs into Codex tasks/);
        assert.match(actual, /data-language=\"typescript\"/);
        assert.match(actual, /pointer-events-none w-full/);
        assert.match(actual, /\/\/ TODO: implement schema/);
      }
      if (name === "chatgptTodoPageWide") {
        assert.match(actual, /style=\"width:560px;height:320px\"/);
      }
      if (name === "apiKeyLegalPage") {
        assert.match(actual, /Decide how much autonomy you want to grant/);
        assert.match(actual, /Powered by your ChatGPT account/);
      }
      if (name === "copilotLegalPage") {
        assert.match(actual, /Powered by GitHub Copilot/);
        assert.match(actual, /GitHub Terms of Service/);
      }
    });
  }
});

type SnapshotMap = {
  asciiBackground: string;
  apiKeyLegalPage: string;
  chatgptCloudPage: string;
  chatgptIntroPage: string;
  chatgptTodoPage: string;
  chatgptTodoPageWide: string;
  copilotLegalPage: string;
  outlineButton: string;
  primaryButton: string;
};

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function renderSnapshotWithWindowWidth(element: ReactElement, width: number) {
  const globalWithWindow = globalThis as typeof globalThis & { window?: unknown };
  const hadWindow = Object.prototype.hasOwnProperty.call(globalWithWindow, "window");
  const originalWindow = globalWithWindow.window;
  Object.defineProperty(globalWithWindow, "window", {
    configurable: true,
    value: { innerWidth: width },
  });

  try {
    return renderSnapshot(element);
  } finally {
    if (hadWindow) {
      Object.defineProperty(globalWithWindow, "window", {
        configurable: true,
        value: originalWindow,
      });
    } else {
      Reflect.deleteProperty(globalWithWindow, "window");
    }
  }
}

function normalizeMarkup(markup: string) {
  return markup.replace(/\sd="[^"]*"/g, ' d="[path]"').replace(/>\s+</g, "><").replace(/\s{2,}/g, " ").trim();
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

function tMessage(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

const noop = () => {};
