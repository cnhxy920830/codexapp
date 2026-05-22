import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getImagePreviewDownloadFileName,
  restoreImagePreviewFocusTarget,
} from "./ImagePreviewDialog";

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

test("getImagePreviewDownloadFileName prefers a trimmed alt label", () => {
  assert.equal(
    getImagePreviewDownloadFileName("https://example.com/path/demo.png", "  preview.png  "),
    "preview.png",
  );
});

test("getImagePreviewDownloadFileName falls back to the decoded file name", () => {
  assert.equal(
    getImagePreviewDownloadFileName("https://example.com/path/my%20image.png?size=full", ""),
    "my image.png",
  );
});

test("getImagePreviewDownloadFileName falls back to image for data urls", () => {
  assert.equal(
    getImagePreviewDownloadFileName("data:image/png;base64,AAAA", ""),
    "image",
  );
});
