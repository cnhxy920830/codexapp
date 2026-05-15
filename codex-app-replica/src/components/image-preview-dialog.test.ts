import assert from "node:assert/strict";
import { test } from "node:test";
import { restoreImagePreviewFocusTarget } from "./ImagePreviewDialog";

test("restoreImagePreviewFocusTarget focuses the connected trigger by default", () => {
  let focused = false;

  const didFocus = restoreImagePreviewFocusTarget({
    focus: () => {
      focused = true;
    },
    isConnected: true,
  });

  assert.equal(didFocus, true);
  assert.equal(focused, true);
});

test("restoreImagePreviewFocusTarget respects onCloseAutoFocus preventDefault", () => {
  let focused = false;

  const didFocus = restoreImagePreviewFocusTarget(
    {
      focus: () => {
        focused = true;
      },
      isConnected: true,
    },
    (event) => {
      event.preventDefault();
    },
  );

  assert.equal(didFocus, false);
  assert.equal(focused, false);
});

test("restoreImagePreviewFocusTarget skips disconnected targets", () => {
  let focused = false;

  const didFocus = restoreImagePreviewFocusTarget({
    focus: () => {
      focused = true;
    },
    isConnected: false,
  });

  assert.equal(didFocus, false);
  assert.equal(focused, false);
});
