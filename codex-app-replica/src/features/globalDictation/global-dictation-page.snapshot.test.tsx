/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { GlobalDictationPageView } from "./GlobalDictationPageView";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/globalDictation/__snapshots__/global-dictation-page.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.GLOBAL_DICTATION_PAGE_UPDATE_SNAPSHOTS === "1";

test("global dictation page snapshots", async (t) => {
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

      if (name === "starting") {
        assert.match(actual, /draggable w-16 justify-center/);
        assert.match(actual, /<canvas/);
        assert.match(actual, /<span class=\"sr-only\">Listening<\/span>/);
        assert.doesNotMatch(actual, /animate-spin/);
      }

      if (name === "listening") {
        assert.match(actual, /no-drag cursor-interaction/);
        assert.match(actual, /<canvas/);
        assert.doesNotMatch(actual, /animate-spin/);
      }

      if (name === "transcribing") {
        assert.match(actual, /draggable w-16 justify-center/);
        assert.match(actual, /animate-spin/);
        assert.match(actual, /icon-xs text-token-text-secondary/);
        assert.doesNotMatch(actual, /<canvas/);
      }

      if (name === "errorWithRetry") {
        assert.match(actual, /w-fit max-w-\[304px\] gap-2/);
        assert.match(actual, /Retry/);
        assert.match(actual, /Dismiss/);
        assert.match(actual, /icon-2xs/);
      }

      if (name === "errorWithoutRetry") {
        assert.match(actual, /Microphone missing/);
        assert.doesNotMatch(actual, /Retry/);
        assert.match(actual, /Dismiss/);
      }
    });
  }
});

type SnapshotMap = {
  errorWithRetry: string;
  errorWithoutRetry: string;
  listening: string;
  starting: string;
  transcribing: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    starting: renderSnapshot(
      <GlobalDictationPageView
        canRetry={false}
        dismissAriaLabel="Dismiss"
        errorMessage={null}
        liveStatusText="Listening"
        onDismiss={noop}
        onRetry={noop}
        onStop={noop}
        retryAriaLabel="Retry"
        status="starting"
        waveformAriaLabel="Global dictation waveform"
      />,
    ),
    listening: renderSnapshot(
      <GlobalDictationPageView
        canRetry={false}
        dismissAriaLabel="Dismiss"
        errorMessage={null}
        liveStatusText="Listening"
        onDismiss={noop}
        onRetry={noop}
        onStop={noop}
        retryAriaLabel="Retry"
        status="listening"
        waveformAriaLabel="Global dictation waveform"
      />,
    ),
    transcribing: renderSnapshot(
      <GlobalDictationPageView
        canRetry={false}
        dismissAriaLabel="Dismiss"
        errorMessage={null}
        liveStatusText="Transcribing…"
        onDismiss={noop}
        onRetry={noop}
        onStop={noop}
        retryAriaLabel="Retry"
        status="transcribing"
        waveformAriaLabel="Global dictation waveform"
      />,
    ),
    errorWithRetry: renderSnapshot(
      <GlobalDictationPageView
        canRetry
        dismissAriaLabel="Dismiss"
        errorMessage="Check your connection and try again"
        liveStatusText="Check your connection and try again"
        onDismiss={noop}
        onRetry={noop}
        onStop={noop}
        retryAriaLabel="Retry"
        status="error"
        waveformAriaLabel="Global dictation waveform"
      />,
    ),
    errorWithoutRetry: renderSnapshot(
      <GlobalDictationPageView
        canRetry={false}
        dismissAriaLabel="Dismiss"
        errorMessage="Microphone missing"
        liveStatusText="Microphone missing"
        onDismiss={noop}
        onRetry={noop}
        onStop={noop}
        retryAriaLabel="Retry"
        status="error"
        waveformAriaLabel="Global dictation waveform"
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
          t: (_key) => "",
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

function noop() {}
