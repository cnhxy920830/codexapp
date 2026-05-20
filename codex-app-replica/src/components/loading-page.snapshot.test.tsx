/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingPage } from "./LoadingPage";

const SNAPSHOT_PATH = path.join(process.cwd(), "src/components/__snapshots__/loading-page.snap.json");
const UPDATE_SNAPSHOTS = process.env.LOADING_PAGE_UPDATE_SNAPSHOTS === "1";

test("loading page snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();
  const debugNameMarkup = renderSnapshot(<LoadingPage debugName="PersistedStateProvider" />);

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);

      if (name === "defaultState") {
        assert.match(actual, /relative size-full bg-transparent/);
        assert.match(actual, /draggable absolute inset-x-0 top-0 electron:h-toolbar extension:h-toolbar-sm/);
        assert.match(actual, /codex-logo-shimmer-overlay/);
      }

      if (name === "overlayState") {
        assert.match(actual, /absolute inset-0 z-10 bg-token-bg-primary\/70/);
        assert.doesNotMatch(actual, /draggable/);
      }

      if (name === "fillParentState") {
        assert.match(actual, /absolute inset-0 bg-transparent/);
        assert.doesNotMatch(actual, /draggable/);
      }

      if (name === "reducedMotionState") {
        assert.doesNotMatch(actual, /codex-logo-shimmer-overlay/);
      }

      if (name === "hiddenLogoState") {
        assert.doesNotMatch(actual, /<svg/);
      }
    });
  }

  await t.test("debugName remains hidden", () => {
    assert.equal(debugNameMarkup, actualSnapshots.defaultState);
    assert.doesNotMatch(debugNameMarkup, /PersistedStateProvider/);
  });
});

type SnapshotMap = {
  defaultState: string;
  fillParentState: string;
  hiddenLogoState: string;
  overlayState: string;
  reducedMotionState: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    defaultState: renderSnapshot(<LoadingPage />),
    overlayState: renderSnapshot(<LoadingPage overlay />),
    fillParentState: renderSnapshot(<LoadingPage fillParent />),
    reducedMotionState: renderSnapshotWithMatchMedia(<LoadingPage />, true),
    hiddenLogoState: renderSnapshot(<LoadingPage showLogo={false} />),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function renderSnapshotWithMatchMedia(element: ReactElement, matches: boolean) {
  const globalWithWindow = globalThis as typeof globalThis & {
    window?: {
      matchMedia?: (query: string) => MediaQueryListLike;
    };
  };
  const hadWindow = Object.prototype.hasOwnProperty.call(globalWithWindow, "window");
  const originalWindow = globalWithWindow.window;

  Object.defineProperty(globalWithWindow, "window", {
    configurable: true,
    value: {
      matchMedia: (_query: string) => createMediaQueryList(matches),
    },
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

function createMediaQueryList(matches: boolean): MediaQueryListLike {
  return {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: noop,
    removeEventListener: noop,
    addListener: noop,
    removeListener: noop,
    dispatchEvent: () => false,
  };
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/url\(data:image\/svg\+xml,[^)]+\)/g, "url([mask])")
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

type MediaQueryListLike = {
  addEventListener: (_type: "change", _listener: (_event: { matches: boolean }) => void) => void;
  addListener: (_listener: (_event: { matches: boolean }) => void) => void;
  dispatchEvent: (_event: Event) => boolean;
  matches: boolean;
  media: string;
  onchange: null;
  removeEventListener: (_type: "change", _listener: (_event: { matches: boolean }) => void) => void;
  removeListener: (_listener: (_event: { matches: boolean }) => void) => void;
};

const noop = () => {};
