import type { ComposerEnterBehavior } from "../services/settings";

export function getComposerModifierLabel(
  platform = typeof navigator === "undefined" ? "" : (navigator.platform ?? ""),
) {
  return platform.startsWith("Mac") ? "Command" : "Ctrl";
}

export function getInvertFollowUpShortcutAccelerator(
  composerEnterBehavior: ComposerEnterBehavior,
) {
  return composerEnterBehavior === "cmdIfMultiline"
    ? "CmdOrCtrl+Shift+Enter"
    : "CmdOrCtrl+Enter";
}

type FollowUpShortcutKeyState = {
  altKey: boolean;
  composerEnterBehavior: ComposerEnterBehavior;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

export function shouldInvertFollowUpOnEnter({
  altKey,
  composerEnterBehavior,
  ctrlKey,
  metaKey,
  shiftKey,
}: FollowUpShortcutKeyState) {
  const hasModifier = ctrlKey || metaKey;
  if (!hasModifier || altKey) {
    return false;
  }
  return composerEnterBehavior === "cmdIfMultiline" ? shiftKey : !shiftKey;
}
