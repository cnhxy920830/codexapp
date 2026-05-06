# Workspace Browser Resource Trace - 2026-05-06

Target baseline: `26.429.3425.0` / build `2345`

## Scope

- Re-check extracted desktop resources for the unresolved right-side `workspace browser` branch.
- Separate that branch from the already implemented `Browser` tab and `Open file` command path.

## Confirmed extracted paths

### 1. Browser tab is a real browser side panel

Evidence:

- `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/review-runtime-bridge-BTTNro9b.js`

Findings:

- The right-panel `Browser` tab renders through the imported browser component from `use-model-settings-D-tfzCjL.js`.
- The browser tab is keyed by `browserConversationId`.
- `find-in-thread` reroutes to `browser-sidebar-command` with `{ type: "open-find" }` when the focused element belongs to the browser side panel.
- Browser-focus detection checks `data-browser-sidebar-conversation-id` and `data-app-shell-focus-area="right-panel"`.

Implication:

- The `Browser` tab is not itself proof of a workspace file tree.

### 2. Open file is a separate workspace-file command path

Evidence:

- `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/workspace-file-command-menu-bridge-CGIhjSHQ.js`

Findings:

- The side-panel `Open file` action dispatches `file-search-command-menu`.
- This bridge owns the `thread.fileCommandMenu.*` and `thread.fileTreePanel.*` wording currently used by the searchable file picker.
- Selected files are loaded through `read-file-metadata`, `read-file`, and `read-file-binary`.
- Open review-side file tabs are persisted through `set-open-review-file-source-tabs`.

Implication:

- The currently implemented replica file search / file preview path matches a distinct upstream branch and should not be conflated with `workspaceBrowser`.

### 3. Generic open-in-target plumbing exists, but not as a proven workspace-browser tree

Evidence:

- `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/use-model-settings-D-tfzCjL.js`

Findings:

- Generic file opening helpers call `open-file` and query `open-in-targets`.
- Markdown/file-reference context menus expose `openInTarget`, `openWith`, `copyPath`, and file-manager reveal actions.
- Review/workspace file tabs use a `workspaceFile` tab kind and the same `open-file` / `open-in-targets` helpers.
- In the extracted code that was inspected, this plumbing attaches to file references and file-preview tabs, not to a proven directory-tree renderer with add-to-chat actions.

Implication:

- The presence of `open-in-targets` is adjacent evidence for later file-opening parity work, but it does not prove the unresolved right-panel workspace-browser tree contract.

## Negative search result

Evidence:

- `rg -n --glob '*.js' "threadSidePanel\\.workspaceBrowser\\.(addToChat|empty|loading|openIn|openInTarget|openInTargetSubmenu)" compare/resources/26.429.3425.0/app.asar.extracted`
- `rg -n "threadSidePanel\\.workspaceBrowser|workspaceBrowser|openInTarget|addToChat" compare/resources/26.429.3425.0/app.asar.extracted`

Findings:

- Exact `threadSidePanel.workspaceBrowser.*` ids were found in locale bundles.
- No non-locale extracted JS bundle exposed those exact ids or a directly attributable renderer for the workspace-browser tree.

## Conclusion

- Resource extraction now clearly separates three adjacent but different paths:
  - browser webview side panel
  - workspace file search / preview
  - generic file open-in-target helpers
- The specific workspace-browser tree branch referenced by `threadSidePanel.workspaceBrowser.*` remains unproven.
- The missing proof is still the same:
  - directory-tree data source
  - loading / empty-state renderer
  - add-to-chat action wiring
  - open-in-target wiring tied specifically to that tree

## Next step

- If this branch must move forward, the next compliant step should be targeted protocol or runtime observation against the installed app, because resource extraction no longer exposes the concrete tree/action path.
