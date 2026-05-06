# Workspace Browser Runtime Observation - 2026-05-06

Target baseline: `26.429.3425.0` / build `2345`

## Scope

- Run the next targeted runtime/log observation pass for the unresolved right-side `workspace browser` tree branch.
- Use installed-app desktop logs to distinguish:
  - the already-proven Browser side panel
  - the already-proven review file source tab / open-file-adjacent path
  - any concrete runtime identifiers for the still-unproven `threadSidePanel.workspaceBrowser.*` tree

## Paths inspected

- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Codex\Logs`

## Positive findings

### 1. Runtime logs expose a real Browser side-panel lifecycle

Evidence:

- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Codex\Logs\2026\05\05\codex-desktop-391d4549-9f19-484e-8636-5b0abd8ab4cd-7816-t0-i1-071448-0.log:41`
- `...071448-0.log:42`
- `...071448-0.log:43`
- `...071448-0.log:77`
- `...071448-0.log:82`
- `...071448-0.log:125`
- `...071448-0.log:177`

Findings:

- The desktop host logs `browser-session-registry` lifecycle events such as:
  - `registered browser sidebar window`
  - `registered browser sidebar thread conversationId=...`
  - `captured turn route conversationId=... turnId=...`
  - `ended browser use turn route ...`
- The same log also shows `browser-use-native-pipe-server` startup and `BrowserUseThreadConfig` runtime-path selection.

Implication:

- This is runtime confirmation that the Browser tab is a distinct browser-use side-panel path, matching the earlier extracted `browserConversationId` / browser-webview evidence.

### 2. Runtime logs expose review file source-tab watcher traffic

Evidence:

- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Codex\Logs\2026\05\05\codex-desktop-391d4549-9f19-484e-8636-5b0abd8ab4cd-7816-t0-i1-071448-0.log:979`
- `...071448-0.log:980`
- `...071448-0.log:981`

Findings:

- The host routed a real `method=fs/watch` request.
- The request failed with:
  - `Invalid request: AbsolutePathBuf deserialized without a base path`
- The accompanying host warning is explicit:
  - `Failed to watch review file source tab`

Implication:

- Runtime logs expose a separate review file source-tab watcher path, which is consistent with the already-proven open-file / file-preview branch and still distinct from the Browser side panel.

## Negative search result

Search scope:

- All installed-app desktop log files under the `Logs` root above.

Zero-match patterns:

- `read-file`
- `read-file-metadata`
- `read-file-binary`
- `open-file`
- `open-in-targets`
- `set-open-review-file-source-tabs`
- `file-search-command-menu`
- `browser-sidebar-command`
- `open-find`
- `addToChat`
- `workspaceBrowser`
- `threadSidePanel.workspaceBrowser`

Implication:

- This runtime/log observation still does not surface a concrete directory-tree/add-to-chat/open-in-target contract for the unresolved `workspace browser` branch.
- Even with richer runtime evidence than the prior local-state pass, the logs continue to prove only adjacent Browser and review-file-source-tab behavior.

## Conclusion

- The installed-app runtime logs now give a clearer three-way separation:
  - Browser tab: explicit `browser-session-registry` / browser-use lifecycle
  - review/open-file-adjacent path: explicit `fs/watch` / `review file source tab` watcher activity
  - unresolved workspace-browser tree: still no attributable runtime identifiers
- This pass strengthens the existing decision boundary:
  - do not approximate `threadSidePanel.workspaceBrowser.*`
  - do not collapse it into Browser or Open file
  - the concrete tree/add-to-chat/open-in-target branch remains unproven after both resource extraction and targeted runtime-log observation
