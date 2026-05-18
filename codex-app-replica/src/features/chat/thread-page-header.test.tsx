/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreadHeaderOverflowMenu } from "./ThreadPageHeader";
import type { CommandKeymapState } from "../../services/keyboardShortcuts";

function translate(key: string) {
  switch (key) {
    case "threadHeader.moreActions":
      return "Chat actions";
    case "sidebarElectron.pinThread":
      return "Pin chat";
    case "sidebarElectron.unpinThread":
      return "Unpin chat";
    case "sidebarElectron.renameThread":
      return "Rename chat";
    case "sidebarElectron.archiveThread":
      return "Archive chat";
    case "sidebarElectron.markThreadUnread":
      return "Mark as unread";
    case "threadHeader.copyWorkingDirectory":
      return "Copy working directory";
    case "threadHeader.copySessionId":
      return "Copy session ID";
    case "threadHeader.copyAppLink":
      return "Copy deeplink";
    case "threadHeader.copyConversationMarkdown":
      return "Copy as Markdown";
    case "threadHeader.openSideChat":
      return "Open in side chat";
    case "threadHeader.forkIntoLocal":
      return "Fork into local";
    case "threadHeader.forkIntoSameWorktree":
      return "Fork into same worktree";
    case "threadHeader.forkIntoWorktree":
      return "Fork into new worktree";
    case "localConversation.header.openHeartbeatAutomation":
      return "Open heartbeat automation";
    case "threadHeader.openInNewWindow":
      return "Open in new window";
    default:
      return key;
  }
}

function renderOverflowMenu(onMarkUnread?: () => void) {
  return renderToStaticMarkup(
    <ThreadHeaderOverflowMenu
      actionsMenuRef={{ current: null }}
      canCopyWorkingDirectory={true}
      commandKeymapState={buildCommandKeymapState()}
      heartbeatAutomationActionLabelKey="threadHeader.moreActions"
      isThreadActionsMenuOpen={true}
      isThreadHeartbeatAutomationActionDisabled={false}
      isThreadHeartbeatAutomationActionVisible={false}
      isThreadPinned={false}
      isTurnInProgress={false}
      isWorktreeThread={false}
      onArchive={() => undefined}
      onCopyAppLink={() => undefined}
      onCopyConversationMarkdown={() => undefined}
      onCopySessionId={() => undefined}
      onCopyWorkingDirectory={() => undefined}
      onForkThread={() => undefined}
      onForkThreadIntoWorktree={() => undefined}
      onOpenInNewWindow={() => undefined}
      onOpenSideChat={() => undefined}
      onMarkUnread={onMarkUnread}
      onOpenThreadHeartbeatAutomationAction={() => undefined}
      onOpenRenameDialog={() => undefined}
      onTogglePinThread={() => undefined}
      onToggleThreadActionsMenu={() => undefined}
      t={translate}
      variant="localConversation"
    />,
  );
}

function renderDefaultOverflowMenu(onMarkUnread?: () => void) {
  return renderToStaticMarkup(
    <ThreadHeaderOverflowMenu
      actionsMenuRef={{ current: null }}
      canCopyWorkingDirectory={true}
      commandKeymapState={buildCommandKeymapState()}
      heartbeatAutomationActionLabelKey="threadHeader.moreActions"
      isThreadActionsMenuOpen={true}
      isThreadHeartbeatAutomationActionDisabled={false}
      isThreadHeartbeatAutomationActionVisible={false}
      isThreadPinned={false}
      isTurnInProgress={false}
      isWorktreeThread={false}
      onArchive={() => undefined}
      onCopyAppLink={() => undefined}
      onCopyConversationMarkdown={() => undefined}
      onCopySessionId={() => undefined}
      onCopyWorkingDirectory={() => undefined}
      onForkThread={() => undefined}
      onForkThreadIntoWorktree={() => undefined}
      onOpenInNewWindow={() => undefined}
      onMarkUnread={onMarkUnread}
      onOpenThreadHeartbeatAutomationAction={() => undefined}
      onOpenRenameDialog={() => undefined}
      onTogglePinThread={() => undefined}
      onToggleThreadActionsMenu={() => undefined}
      t={translate}
      variant="default"
    />,
  );
}

function buildCommandKeymapState(): CommandKeymapState {
  return {
    bindings: [
      { command: "toggleThreadPin", key: "Ctrl+Shift+P" },
      { command: "renameThread", key: "Ctrl+R" },
      { command: "archiveThread", key: "Ctrl+Shift+A" },
      { command: "copyWorkingDirectory", key: "Ctrl+Alt+W" },
      { command: "copySessionId", key: "Ctrl+Alt+S" },
      { command: "copyDeeplink", key: "Ctrl+Alt+L" },
      { command: "copyConversationMarkdown", key: "Ctrl+Alt+M" },
      { command: "openSideChat", key: "Ctrl+Alt+O" },
    ],
  };
}

test("local conversation overflow menu omits mark unread row even when available", () => {
  const markup = renderOverflowMenu(() => undefined);

  assert.doesNotMatch(markup, /Mark as unread/);
});

test("default overflow menu keeps mark unread row when available", () => {
  const markup = renderDefaultOverflowMenu(() => undefined);

  assert.match(markup, /Mark as unread/);
});

test("local conversation overflow menu renders extracted shortcut labels", () => {
  const markup = renderOverflowMenu();

  assert.match(markup, /Ctrl\+Shift\+P/);
  assert.match(markup, /Ctrl\+R/);
  assert.match(markup, /Ctrl\+Shift\+A/);
  assert.match(markup, /Ctrl\+Alt\+W/);
  assert.match(markup, /Ctrl\+Alt\+S/);
  assert.match(markup, /Ctrl\+Alt\+L/);
  assert.match(markup, /Ctrl\+Alt\+M/);
  assert.match(markup, /Ctrl\+Alt\+O/);
});
