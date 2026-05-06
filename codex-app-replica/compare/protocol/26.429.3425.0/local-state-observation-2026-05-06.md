# Local State Observation - 2026-05-06

Target baseline: `26.429.3425.0` / build `2345`

## Scope

- Inspect installed Codex desktop local state and logs for:
  - workspace-browser right-panel behavior evidence
  - primary-runtime / Workspace Dependencies host behavior evidence

## Paths inspected

- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Local\Codex\Logs`
- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Codex\Preferences`
- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Codex\Local Storage\leveldb`
- `C:\Users\Administrator\AppData\Local\Packages\OpenAI.Codex_2p2nqsd0c76g0\LocalCache\Roaming\Codex\Session Storage`
- `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime`

## Workspace browser findings

- No hits were found in the inspected local logs or persisted webview storage for:
  - `browserConversationId`
  - `threadSidePanel.workspaceBrowser`
  - `browser-sidebar-command`
  - `open-find`
  - `file-search-command-menu`
  - `openInTarget`
  - `addToChat`
- Result: local state inspection did not produce additional proof for the unresolved workspace-browser tree branch beyond the previously extracted frontend resources.

## Primary runtime / Workspace Dependencies findings

- Desktop logs show the Electron side enables the `workspace_dependencies` feature flag in its own enabled-feature set.
- Desktop logs show the Electron side selects a `codex-primary-runtime` artifact and injects a runtime install config that includes Windows bundles and a `runtimeRootDirectoryName` of `codex-primary-runtime`.
- Desktop logs show the desktop process routes `experimentalFeature/enablement/set` requests through `AppServerConnection`, but the local app-server responds with `unsupported feature enablement 'workspace_dependencies'`.
- Desktop logs show the host has a periodic runtime-update polling path:
  - `warning [install-primary-runtime] primary_runtime_update_poll_failed errorMessage="fetch failed"`
  - `warning [install-primary-runtime] primary_runtime_update_poll_failed errorMessage="Failed to sync primary runtime bundled plugin marketplace: C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\plugins\openai-primary-runtime"`
- The runtime cache directory exists on disk at `C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime`.
- `runtime.json` in that directory currently reports:
  - `bundleFormatVersion: 2`
  - `bundleVersion: 26.430.10722`
  - `bundledPlugins: ["plugins/openai-primary-runtime"]`
  - `nodeVersion: v24.14.0`
  - `pythonVersion: 3.12.13`
  - `targetPlatform: win32`
  - `targetArch: x64`

## Implications

- The upstream desktop app has a real host-managed runtime installation/update/cache path that is not reducible to the current public app-server experimental-feature surface.
- The current replica blocker is sharper now:
  - the desktop host can surface `workspace_dependencies`
  - the app-server still rejects `experimentalFeature/enablement/set` for that feature
  - the host also owns runtime config selection, runtime cache usage, and update polling/error handling
- This observation strengthens the existing `M-007-027` block rather than resolving it.
