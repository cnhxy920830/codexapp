import assert from "node:assert/strict";
import test from "node:test";
import {
  __testOnly,
  getMentionOverlayLayout,
  getMentionOverlayPlacement,
} from "./MentionOverlay";

test("mention overlay placement flips to top only when below space is tight and above space is larger", () => {
  const editor = {
    getBoundingClientRect: () => ({
      bottom: 700,
      top: 500,
    }),
  } as HTMLDivElement;

  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerHeight: 800,
    },
  });

  try {
    assert.equal(getMentionOverlayPlacement(editor), "top");

    editor.getBoundingClientRect = () =>
      ({
        bottom: 500,
        top: 460,
      }) as DOMRect;
    assert.equal(getMentionOverlayPlacement(editor), "bottom");
  } finally {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("mention overlay layout uses body portal with fixed positioning outside dialogs", () => {
  const body = {} as HTMLElement;
  const editor = {
    closest: () => null,
    getBoundingClientRect: () =>
      ({
        bottom: 120,
        left: 50,
        top: 100,
      }) as DOMRect,
    ownerDocument: {
      getSelection: () => null,
    } as Document,
  } as unknown as HTMLDivElement;

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: 500,
    },
  });

  try {
    const layout = getMentionOverlayLayout(editor, "bottom");
    assert.ok(layout);
    assert.equal(layout.portalContainer, body);
    assert.equal(layout.positionClassName, "fixed");
    assert.equal(layout.renderAbove, false);
    assert.equal(layout.left, 50);
    assert.equal(layout.top, 128);
    assert.equal(layout.width, 360);
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("mention overlay layout uses dialog portal with absolute positioning and top offset inside dialogs", () => {
  const dialog = {
    getBoundingClientRect: () =>
      ({
        left: 20,
        top: 40,
        width: 320,
      }) as DOMRect,
  } as HTMLElement;
  const body = {} as HTMLElement;
  const editor = {
    closest: () => dialog,
    getBoundingClientRect: () =>
      ({
        bottom: 190,
        left: 260,
        top: 170,
      }) as DOMRect,
    ownerDocument: {
      getSelection: () => null,
    } as Document,
  } as unknown as HTMLDivElement;

  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      body,
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      innerWidth: 800,
    },
  });

  try {
    const layout = getMentionOverlayLayout(editor, "top");
    assert.ok(layout);
    assert.equal(layout.portalContainer, dialog);
    assert.equal(layout.positionClassName, "absolute");
    assert.equal(layout.renderAbove, true);
    assert.equal(layout.left, 12);
    assert.equal(layout.top, 122);
    assert.equal(layout.width, 296);
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  }
});

test("mention overlay clamp falls back to minimum when available width is smaller than padding", () => {
  assert.equal(__testOnly.clampOverlayPosition(40, 12, 8), 12);
  assert.equal(__testOnly.clampOverlayPosition(4, 12, 100), 12);
  assert.equal(__testOnly.clampOverlayPosition(140, 12, 100), 100);
});
