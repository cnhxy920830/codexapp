/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ThreadHeaderOverflowMenu } from "./ThreadPageHeader";

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
      variant="localConversation"
    />,
  );
}

test("thread header overflow menu renders mark unread row when available", () => {
  const markup = renderOverflowMenu(() => undefined);

  assert.match(markup, /Mark as unread/);
});

test("thread header overflow menu omits mark unread row when unavailable", () => {
  const markup = renderOverflowMenu();

  assert.doesNotMatch(markup, /Mark as unread/);
});
