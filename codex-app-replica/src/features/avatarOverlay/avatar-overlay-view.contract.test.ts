import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("avatar overlay view keeps extracted motion hooks for badge, tray, rows, body, and reply form", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/avatarOverlay/AvatarOverlayView.tsx"),
    "utf8",
  );

  assert.match(source, /const BADGE_MOTION_CLASSNAME =/);
  assert.match(source, /const EDGE_CONTROL_MOTION_CLASSNAME =/);
  assert.match(source, /const ROW_ENTER_CLASSNAME =/);
  assert.match(source, /const BODY_EXPAND_TRANSITION_CLASSNAME =/);
  assert.match(source, /const REPLY_FORM_ENTER_CLASSNAME =/);
  assert.match(source, /const TRAY_OPEN_CLOSE_TRANSITION_CLASSNAME =/);
  assert.match(source, /avatar-overlay-badge-enter/);
  assert.match(source, /avatar-overlay-edge-control-enter/);
  assert.match(source, /avatar-overlay-row-enter/);
  assert.match(source, /avatar-overlay-reply-enter/);
  assert.match(source, /transition-\[max-height\]/);
  assert.match(source, /transition-\[opacity,transform\] duration-\[180ms\] ease-\[cubic-bezier\(0\.16,1,0\.3,1\)\]/);
});

test("avatar overlay styles define the extracted motion keyframes", async () => {
  const source = await readFile(path.join(process.cwd(), "src/styles.css"), "utf8");

  assert.match(source, /@keyframes avatar-overlay-badge-enter/);
  assert.match(source, /@keyframes avatar-overlay-edge-control-enter/);
  assert.match(source, /@keyframes avatar-overlay-row-enter/);
  assert.match(source, /@keyframes avatar-overlay-reply-enter/);
  assert.match(source, /\.avatar-overlay-badge-enter/);
  assert.match(source, /\.avatar-overlay-edge-control-enter/);
  assert.match(source, /\.avatar-overlay-row-enter/);
  assert.match(source, /\.avatar-overlay-reply-enter/);
});
