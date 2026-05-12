/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  getComposerModifierLabel,
  getInvertFollowUpShortcutAccelerator,
  shouldInvertFollowUpOnEnter,
} from "./followUpShortcuts";

test("modifier label is platform-aware", () => {
  assert.equal(getComposerModifierLabel("MacIntel"), "Command");
  assert.equal(getComposerModifierLabel("Win32"), "Ctrl");
  assert.equal(getComposerModifierLabel("Linux x86_64"), "Ctrl");
});

test("enter behavior uses ctrl/cmd enter as the inverse shortcut", () => {
  assert.equal(getInvertFollowUpShortcutAccelerator("enter"), "CmdOrCtrl+Enter");
});

test("cmdIfMultiline uses ctrl/cmd shift enter as the inverse shortcut", () => {
  assert.equal(
    getInvertFollowUpShortcutAccelerator("cmdIfMultiline"),
    "CmdOrCtrl+Shift+Enter",
  );
});

test("enter behavior inverts on ctrl/cmd enter without shift", () => {
  assert.equal(
    shouldInvertFollowUpOnEnter({
      altKey: false,
      composerEnterBehavior: "enter",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }),
    true,
  );
});

test("enter behavior does not invert when shift is also pressed", () => {
  assert.equal(
    shouldInvertFollowUpOnEnter({
      altKey: false,
      composerEnterBehavior: "enter",
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
    }),
    false,
  );
});

test("multiline behavior only inverts on ctrl/cmd shift enter", () => {
  assert.equal(
    shouldInvertFollowUpOnEnter({
      altKey: false,
      composerEnterBehavior: "cmdIfMultiline",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }),
    false,
  );
  assert.equal(
    shouldInvertFollowUpOnEnter({
      altKey: false,
      composerEnterBehavior: "cmdIfMultiline",
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
    }),
    true,
  );
});

test("alt-modified enter never inverts follow-up behavior", () => {
  assert.equal(
    shouldInvertFollowUpOnEnter({
      altKey: true,
      composerEnterBehavior: "enter",
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    }),
    false,
  );
});
