# Codex App Replica Tracker

## Conventions

- Format: single Markdown file.
- Every implementation task must map to an entry in this file before work starts.
- Status values: `todo`, `in_progress`, `blocked`, `done`.
- Tracker structure:
  - Module inventory at the top level.
  - Page / flow inventory nested under the module they belong to.

## Active Constraints

- Target: replicate the currently installed Windows Codex App on this computer.
- Update policy: keep the current installed version as the baseline until the user explicitly announces an upstream update.
- Delivery path: complete shell parity and visual parity before feature replication begins.
- Source-of-truth methods, in priority order:
  1. Resource extraction
  2. Network packet capture
  3. Protocol observation
- Allowed comparison methods are limited to the three methods above when code cannot confirm behavior.
- Resource extraction is the default method and must be completed first for a given question whenever feasible.
- Do not continue with lower-priority methods unless there is a concrete, necessary, and tracker-documented reason that resource extraction is insufficient for the specific question being answered.
- Backend constraint: do not modify backend crates, `codex`, or `codex app-server`.
- Auth constraint: full compatibility with the existing ChatGPT login state is required.
- Blocked rule: if parity requires backend modification, login-state incompatibility, unverifiable target behavior, or deviation from the original backend integration model, mark the work as `blocked`.
- Scope rule: do not start work that is not represented in this tracker.
- Styling rule: use Tailwind.
- Dependency rule: prefer the latest stable dependency versions available at implementation time.

## Current Baseline

- Target app version: `26.429.3425.0`
- Target build identifier: `2345`
- Baseline capture root: `compare/baselines/<target-version>/`
- Current reverse-engineering status: Electron bundle inspected; shell and visual evidence captured

## Fields

- `ID`
- `Status`
- `Priority`
- `Blocked Reason`
- `Evidence`
- `Notes`

## Module Inventory

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-000 | done | high |  |  | Foundation / scaffolding / build / packaging |
| M-001 | done | high |  |  | Shell / window parity |
| M-002 | in_progress | high |  |  | Visual parity |
| M-003 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/use-auth-B6K0raTb.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `codex-rs/app-server/README.md` auth section | Login-state compatibility |
| M-004 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/main-en6dHM41.js`; `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/bootstrap.js`; `compare/baselines/26.429.3425.0/runtime/` | System-level behavior parity |
| M-005 | in_progress | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/locale-resolver-hIwNluxR.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/zh-CN-Dq6qMmfi.js`; `src/App.tsx`; `src/services/history.ts` | Localization parity |
| M-006 | in_progress | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `codex-rs/app-server/README.md` thread APIs | Chat / history parity |
| M-007 | in_progress | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/settings-page-BNdww_Cx.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/agent-settings-sq6rCeQK.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/general-settings-ew6_biI0.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/global-settings-CBARiAJj.js`; `src/App.tsx`; `src/services/settings.ts`; `src-tauri/src/auth_bridge.rs` | Settings parity |
| M-008 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/main-en6dHM41.js`; `codex-rs/app-server-client/src/lib.rs`; `codex-rs/app-server/README.md`; `src-tauri/src/auth_bridge.rs` | Protocol / app-server integration |
| M-009 | done | medium |  |  | Resource extraction baseline |
| M-010 | todo | medium |  |  | Network / protocol observation baseline |

## Page / Flow Inventory

### M-000 Foundation / scaffolding / build / packaging

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-000-001 | done | high |  | `codex-app-replica` scaffold created at `codex-app-replica/package.json`, `src-tauri/`, and `src/` | Project scaffolding |
| M-000-002 | done | high |  | `codex-app-replica/package-lock.json` and `codex-app-replica/src-tauri/Cargo.lock` generated after pinning current stable npm / crates.io releases | Dependency selection and lockfiles |
| M-000-003 | done | high |  | Vite + Tauri config created in `codex-app-replica/vite.config.ts` and `codex-app-replica/src-tauri/tauri.conf.json`; window config now uses undecorated `1702x962` sizing to match the captured baseline | Build configuration |
| M-000-004 | done | high |  | `src-tauri/tauri.conf.json` configured for NSIS bundle output with icon assets and verified by `cargo check` | Packaging / installer configuration |
| M-000-005 | done | high |  | `compare/tracker.md` updated before and after implementation; stable baseline artifact directories created under `compare/` | Tracker-driven workflow enforcement |
| M-000-006 | done | high |  | `codex-app-replica/.gitignore` updated to exclude build outputs and unbounded compare artifacts while keeping source, config, and lockfiles tracked | Ignore and repository hygiene |
| M-000-007 | done | high |  | `AGENTS.md`; `https://v2.tauri.app/develop/calling-rust/`; `https://v2.tauri.app/ja/develop/state-management/`; `https://react.dev/learn/managing-state`; `https://react.dev/learn/synchronizing-with-effects`; `https://tailwindcss.com/docs/detecting-classes-in-source-files` | Audit current frontend/backend development structure against official Tauri, React, and Tailwind guidance; encode long-term architecture rules in `AGENTS.md` |
| M-000-008 | done | high |  | `AGENTS.md` `Development Architecture Standards` now defines target frontend file map, feature shape, data flow, React state rules, Tailwind rules, asset handling, Tauri/Rust file map, command boundaries, app-server bridge structure, Rust state/concurrency rules, permissions, TypeScript typing, verification gates, and drift refactoring rules | Replace coarse architecture guidance with a concrete file-placement, dependency-boundary, and development-flow standard for future Codex CLI agents |
| M-000-009 | done | high |  | `AGENTS.md` now includes transferable root rules for protocol payload naming, wire shape alignment, Rust API style, module/public API discipline, Cargo process patience, dependency lock handling, test assertion style, and final reporting; backend-only `codex-rs` rules remain scoped to root `AGENTS.md` | Review root `AGENTS.md` for transferable development rules and merge applicable Rust/protocol/testing/dependency standards into the replica contract |
| M-000-010 | done | high |  | `AGENTS.md` final pass removed stale artifact guidance outside the allowed comparison methods, replaced non-authorized verification wording with allowed network/protocol/RPC evidence, and collapsed duplicated `Architecture Defaults` into a pointer to the detailed development standards | Final consistency pass on `AGENTS.md`: remove conflicting comparison-method wording and collapse duplicated architecture guidance |

### M-001 Shell / window parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-001-001 | done | high |  | Electron main bundle and active Codex window behavior captured from installed app; original app geometry is `1702x962` and replica window config is aligned to that size in `src-tauri/tauri.conf.json`; evidence recorded in baseline resources and runtime observations | Discover shell layout and window chrome from installed app |
| M-001-002 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-shell-DE6ZCJhZ.js` and `index-oAJ_hQgK.css` confirm a two-tier Windows shell header with `h-toolbar-sm` + `h-toolbar`; replica now mirrors that structure in `src/App.tsx` with a dedicated Windows menubar row, a separate main toolbar, and shell widths derived from the extracted `sidebar-width` clamp and toolbar tokens | Inventory shell regions, panes, title bar, and window controls |
| M-001-003 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-shell-DE6ZCJhZ.js` shows the original custom `windowsMenuBar` and `app-header-tint` shell; replica now uses an undecorated Tauri window plus custom drag region and window controls in `src/App.tsx` | Recreate custom Windows title bar and shell frame |

### M-002 Visual parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-002-001 | done | high |  | `app.asar` extracted to `compare/resources/26.429.3425.0/app.asar.extracted/` and visual assets located in `webview/assets/` | Extract visual assets from installed app |
| M-002-002 | done | high |  | Original window geometry and shell-state observations captured from installed app; evidence retained in extracted resources and runtime notes | Visual verification via resource and runtime methods |
| M-002-003 | done | high |  | App shell CSS and bundle inspected in `webview/assets/app-shell-Cog6m8iB.css` and `webview/assets/app-shell-DE6ZCJhZ.js`; replica shell now uses a closer 3-column frame with header/sidebar/workspace structure and updated beige/white token palette in `src/App.tsx` and `src/styles.css` | Inventory typography, spacing, colors, and iconography |
| M-002-004 | done | high |  | `src/styles.css` now applies extracted shell token values from `index-oAJ_hQgK.css`, including `46px`/`36px`/`40px` toolbar heights, the `sidebar-width` clamp, and the denser Windows font sizing; `src/App.tsx` reduces panel spacing and aligns the shell hierarchy to the captured baseline | Polish first-pass shell visuals toward baseline |

### M-003 Login-state compatibility

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-003-001 | done | high |  | `use-auth-B6K0raTb.js` shows frontend auth state comes from `getAccount()` plus `addAuthStatusCallback` / `removeAuthStatusCallback`; `app-server-manager-signals-DBUY-BE0.js` exposes `loginWithApiKey`, `loginWithChatGpt`, `loginWithChatGptDeviceCode`, `cancelLogin`, and `account/read` / `account/login/start` / `account/login/cancel` | Discover auth entry points and login-state dependencies |
| M-003-002 | done | high |  | `codex login status` reports the current machine is logged in via API key; `C:\Users\Administrator\.codex\auth.json` exists; `codex app-server --help` and `codex app-server proxy --help` confirm an existing app-server control-plane path that shares the same Codex home | Verify whether login-state compatibility is observable without backend changes |
| M-003-003 | done | high |  | `codex-rs/app-server/README.md` documents stdio JSONL app-server transport and `account/read` / `account/updated`; the extracted desktop bundle routes local state through a main-process app-server client instead of parsing login text; replica now owns a Tauri auth bridge in `src-tauri/src/auth_bridge.rs` and forwards `auth-state-changed` to the webview | Build a Tauri-side app-server bridge that owns the auth snapshot and notification stream |
| M-003-004 | done | high |  | `src/services/auth.ts` and `src/App.tsx` now render the live auth snapshot from the Tauri bridge, including loading, signed-out, API key, and ChatGPT account labels | Replace the static shell badge with real auth mode, email, and plan text from the bridge |
| M-003-005 | done | medium |  | `codex-rs/app-server/README.md` auth section documents `account/login/start`, `account/login/cancel`, and `account/logout`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/login-route-BXm6VNbv.js`; `src-tauri/src/auth_bridge.rs`; `src/App.tsx` | Login start / cancel is now routed through the same app-server bridge, with pending browser-login, device-code, cancel, and error cleanup state mirrored in the shell |

### M-004 System-level behavior parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-004-001 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/main-en6dHM41.js`; `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/bootstrap.js`; `compare/baselines/26.429.3425.0/runtime/` | Replica now registers the Windows `Open project in Codex` folder context menu, exposes `--open-project` launch context through Tauri, and surfaces the received path in the shell for runtime verification |

### M-005 Localization parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-005-001 | done | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/locale-resolver-hIwNluxR.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/zh-CN-Dq6qMmfi.js`; `src/i18n/messages.ts`; `src/i18n/i18n.tsx`; `src/components/GeneralSettings.tsx`; `src/services/history.ts`; `src/services/settings.ts`; `src/App.tsx`; `src-tauri/src/global_settings.rs` | Replica-local i18n plumbing now covers the currently implemented shell surfaces end-to-end: the remaining Settings / Agent hardcoded labels in `src/App.tsx` are now message-keyed, locale resolution normalizes upstream locale codes, and the General settings language selector now exposes the upstream locale inventory while falling back explicitly to the current English / zh-CN message dictionaries for untranslated locales. |
| M-005-002 | in_progress | high |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/zh-CN-Dq6qMmfi.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/locale-resolver-hIwNluxR.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/general-settings-ew6_biI0.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/settings-page-BNdww_Cx.js`; `src/i18n/messages.ts`; `src/i18n/i18n.tsx`; `src/services/auth.ts`; `src/App.tsx`; `src/components/GeneralSettings.tsx` | Broaden translated dictionary coverage and align replica-local wording more closely with upstream locale bundles across the currently implemented shell, chat, and settings surfaces. This slice is now partially landed: the replica uses exact upstream General settings wording for the currently implemented controls, supports minimal `{placeholder}` interpolation for upstream settings copy, no longer renders raw `settingsSection` implementation ids in the shell header, and has an upstream-aligned auth/login wording pass plus count-aware changed-files copy for the current chat placeholder surface. Remaining work is wider wording alignment across other rendered shell/chat surfaces and broader non-English dictionary coverage beyond the current explicit keys. |

### M-006 Chat / history parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-006-001 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `codex-rs/app-server/README.md` `thread/list` docs; `src-tauri/src/auth_bridge.rs`; `src/services/history.ts`; `src/App.tsx` | Static recent conversation sidebar data is replaced with app-server-backed thread inventory, grouped by project cwd basename and rendered with relative recency labels |
| M-006-002 | done | medium |  | `codex-rs/app-server/README.md` `thread/read` docs; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `src-tauri/src/auth_bridge.rs`; `src/services/history.ts`; `src/App.tsx` | Replace the static main conversation placeholder with app-server-backed thread content and support selecting a recent thread from the sidebar |
| M-006-003 | done | medium |  | `codex-rs/app-server/README.md` `thread/start` docs; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `src-tauri/src/auth_bridge.rs`; `src-tauri/src/lib.rs`; `src/services/history.ts`; `src/App.tsx` | The replica's New chat affordances now create a real conversation through `thread/start`, then read that thread and refresh recent-thread inventory so the new session becomes the active shell conversation and appears in the sidebar without fake UI-only clearing behavior. Scope remains limited to starting/selecting the new thread; sending the first turn is separate chat runtime work. |
| M-006-004 | done | medium |  | `codex-rs/app-server/README.md` `turn/start` and thread notification docs; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/zh-CN-Dq6qMmfi.js`; `src-tauri/src/auth_bridge.rs`; `src-tauri/src/lib.rs`; `src/services/history.ts`; `src/App.tsx`; `src/i18n/messages.ts` | The chat page now has a real replica-shell composer that starts a text turn through `turn/start`, consumes minimal thread item notifications for user and agent messages, and reconciles back to authoritative `thread/read` data on turn completion. The implementation deliberately avoids fake local echo state and only covers the minimal text-turn path; richer tool/progress item rendering remains separate follow-up work. |
| M-006-005 | done | medium |  | `codex-rs/app-server/README.md` approvals and server-request docs; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/app-server-manager-signals-DBUY-BE0.js`; `src-tauri/src/auth_bridge.rs`; `src-tauri/src/lib.rs`; `src/services/history.ts`; `src/App.tsx`; `src/i18n/messages.ts` | The replica bridge now parses server-initiated JSON-RPC approval requests for `item/commandExecution/requestApproval` and `item/fileChange/requestApproval`, emits inline chat approval events plus `serverRequest/resolved`, and exposes a real Tauri response command so the frontend can send `accept` / `acceptForSession` / `decline` / `cancel` decisions back to app-server. The chat view now renders pending approval cards from live request data, including command/cwd details and file-change summaries when available. Scope remains deliberately minimal: richer tool rendering, interactive runtime proof against a live approval-required turn, and broader request types remain separate follow-up work. |
| M-006-006 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/local-conversation-page-DRM778HE.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/diff-summary-C5rxpkTr.js`; `codex-rs/app-server/README.md` item and diff notification docs; `codex-rs/app-server-protocol/src/protocol/v2.rs`; `src-tauri/src/thread_history.rs`; `src-tauri/src/auth_bridge.rs`; `src/features/chat/ChatConversationMainPane.tsx`; `src/features/chat/threadConversationState.ts`; `src/services/history.ts`; `src/App.tsx`; `src/i18n/messages.ts` | The replica no longer depends on hardcoded changed-files placeholder rows for the chat surface. `thread/read` now carries real `commandExecution` and `fileChange` items into the frontend conversation model, the bridge consumes live `item/commandExecution/outputDelta` and `item/fileChange/patchUpdated` notifications to keep those items updated in place, and the chat view renders them as first-class cards in the conversation stream. Header change counts are now derived from authoritative latest-turn file-change data instead of static rows. This slice also extracts the chat main-column rendering and thread-item state helpers out of `src/App.tsx` into feature modules so future chat/runtime work does not continue expanding the top-level composition file. Remaining runtime gaps are broader item parity beyond command/file changes, turn interruption, and richer secondary panels such as open-files / diff-side surfaces. |
| M-006-007 | done | medium |  | `codex-rs/app-server/README.md` `turn/interrupt` docs; `codex-rs/app-server-protocol/src/protocol/v2.rs`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/composer-WV7dloZY.js`; `src-tauri/src/auth_bridge.rs`; `src-tauri/src/lib.rs`; `src/services/history.ts`; `src/App.tsx`; `src/features/chat/ChatConversationMainPane.tsx`; `src/i18n/messages.ts` | The replica now tracks the concrete `turnId` returned by `turn/start`, exposes a real `turn/interrupt` Tauri bridge command, and swaps the composer primary action from send to stop while the selected thread is running. Local running state now clears only when the matching `turn/completed` notification arrives, including the `interrupted` terminal case documented by app-server. This remains a minimal parity slice: the current composer still disables text entry during a running turn instead of implementing upstream steer/queue behavior, and this tracker item does not claim manual live interruption evidence yet. |

### M-007 Settings parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-007-001 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/settings-page-BNdww_Cx.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/settings-sections-0MrNUF6p.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/agent-settings-sq6rCeQK.js`; `codex-rs/app-server/README.md` `config/read` and `config/batchWrite` docs; `src-tauri/src/auth_bridge.rs`; `src-tauri/src/lib.rs`; `src/services/settings.ts`; `src/App.tsx` | Recreate the settings shell and the first live Agent configuration panel with app-server-backed config read/write integration |
| M-007-002 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/agent-settings-sq6rCeQK.js`; `codex-rs/app-server/README.md` `config/read` and `config/value/write` docs; `src/services/settings.ts`; `src/App.tsx`; `src-tauri/src/auth_bridge.rs` | Add Agent settings scope selection, config-layer awareness, current-workspace `cwd` resolution, and project-aware writes |
| M-007-003 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/agent-settings-sq6rCeQK.js`; `codex-rs/app-server-protocol/src/protocol/v2.rs` `ConfigLayerSource::User`; `src/services/settings.ts`; `src/App.tsx`; `src-tauri/src/auth_bridge.rs` | Add real user config file paths and the Agent-panel Open config.toml action |
| M-007-004 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/agent-settings-sq6rCeQK.js`; `src/App.tsx`; `LICENSE` | Add the Open source licenses row to the Agent settings panel |
| M-007-005 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/general-settings-ew6_biI0.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/appearance-settings-CRazlKzE.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/global-settings-CBARiAJj.js`; `src/components/GeneralSettings.tsx`; `src/services/settings.ts`; `src/styles.css`; `src/App.tsx`; `src-tauri/src/global_settings.rs`; `src-tauri/src/lib.rs` | General settings now has a real upstream-keyed global-state path for `usePointerCursors`, `sansFontSize`, and `codeFontSize`, persisted under the replica app config directory and applied immediately in the shell. Locale override, broader appearance/theme parity, and downstream runtime consumption for newer general settings remain separate uncovered work. |
| M-007-006 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/general-settings-ew6_biI0.js`; `compare/resources/26.429.3425.0/app.asar.extracted/webview/assets/global-settings-CBARiAJj.js`; `src/components/GeneralSettings.tsx`; `src/services/settings.ts`; `src-tauri/src/global_settings.rs` | General settings now persists upstream-keyed `reviewDelivery` and `followUpQueueMode` values under the replica app config directory and renders matching settings rows in the replica shell. These settings are stored through the same global-state bridge as the other General settings. Downstream review/composer runtime consumption remains uncovered until the corresponding replica features exist. |

### M-008 Protocol / app-server integration

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-008-001 | done | medium |  | `compare/resources/26.429.3425.0/app.asar.extracted/.vite/build/main-en6dHM41.js`; `codex-rs/app-server-client/src/lib.rs`; `codex-rs/app-server/README.md`; `src-tauri/src/auth_bridge.rs` | Discover and mirror the original backend integration model from installed app and local codebase |

### M-009 Resource extraction baseline

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-009-001 | done | high |  | `C:\Program Files\WindowsApps\OpenAI.Codex_26.429.3425.0_x64__2p2nqsd0c76g0` inspected; package manifest and resource tree confirmed | Locate installed app resources and package structure |
| M-009-002 | done | high |  | Copied baseline resources into `codex-app-replica/compare/resources/26.429.3425.0/` | Extract reusable assets into stable compare locations |
| M-009-003 | done | high |  | Resource inventory recorded in `compare/resources/26.429.3425.0/` and tracker evidence fields | Record extracted resource inventory and mapping |

### M-010 Network / protocol observation baseline

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-010-001 | todo | medium |  |  | Capture protocol and network observations needed to confirm shell-adjacent behavior |

## Open TODOs

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| T-001 | done | high |  | Version discovered via `Get-AppxPackage`: `26.429.3425.0`; build metadata discovered from `app.asar` package.json: `codexBuildNumber=2345` | Discover installed Windows Codex App version and build identifier |
| T-002 | done | high |  | Stable subdirectories created under `codex-app-replica/compare/` including `baselines/26.429.3425.0/`, `resources/`, `network/`, and `protocol/` | Create stable `compare/` subdirectories for baseline artifacts |
| T-003 | done | high |  | Resource extraction baseline started and captured under `compare/resources/26.429.3425.0/` | Start resource extraction baseline work under `M-009` |
| T-004 | done | high |  | Shell reconstruction now uses a split Windows menubar + main toolbar layout in `src/App.tsx`, with extracted shell token values applied in `src/styles.css` and verified by fresh build checks | Build the first complete shell and visual inventory from installed app evidence |

## Blocked Items

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |

## Verification Log

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| V-001 | done | high |  | `npm run build` passed in `codex-app-replica`; `cargo check --manifest-path src-tauri/Cargo.toml` passed | Baseline scaffold verification |
| V-002 | done | high |  | `cargo check --manifest-path codex-app-replica/src-tauri/Cargo.toml` passed after NSIS config update | Packaging verification |
| V-003 | done | high |  | `npm run build` passed after custom title bar and shell updates; `cargo check --manifest-path codex-app-replica/src-tauri/Cargo.toml` also passed with undecorated window config; verification captured in resource and runtime evidence | Shell reconstruction verification |
| V-004 | done | high |  | `npm run build` passed after the visual parity pass; `cargo check --manifest-path codex-app-replica/src-tauri/Cargo.toml` passed; verification captured in resource and runtime evidence | Visual parity verification |
| V-005 | done | high |  | `npm run build` passed after the two-tier header and density tuning pass; `cargo check --manifest-path src-tauri/Cargo.toml` also passed with the updated shell structure | Two-tier header and density tuning verification |
| V-006 | done | high |  | `npm run build` passed after wiring the live auth badge; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding the Tauri auth bridge and app-server state surface | Login-state bridge and badge wiring verification |
| V-007 | done | high |  | `npm run build` passed after adding `get_launch_context`; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding Windows context-menu registration and `--open-project` parsing; launching `compare/baselines/26.429.3425.0/runtime/codex-app-replica.exe --open-project D:\autoAiProject\codexapp\codex-app-replica` created `HKCU\Software\Classes\Directory\shell\OpenProjectInCodex` with matching command and icon values | Windows folder context menu and launch-argument verification |
| V-008 | done | high |  | `npm run build` passed after replacing the mock sidebar history with app-server-backed thread data; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding the Tauri `thread/list` bridge and startup readiness gate | Recent conversation sidebar bridge verification |
| V-009 | done | high |  | `npm run build` passed after adding real thread selection and `thread/read`; `cargo check --manifest-path src-tauri/Cargo.toml` passed after extending the Tauri auth bridge with `thread/read` and startup readiness gating | Thread read/select bridge verification |

| V-010 | done | high |  | `npm run build` passed after adding the settings shell and live Agent configuration panel; `cargo check --manifest-path src-tauri/Cargo.toml` passed after extending the Tauri bridge with `config/read` and `config/value/write` | Settings shell and Agent config bridge verification |

| V-011 | done | high |  | `npm run build` passed after adding Agent settings scope selection and project-aware config targeting; `cargo check --manifest-path src-tauri/Cargo.toml` passed with the expanded config layer model | Agent scope selection verification |

| V-012 | done | high |  | `npm run build` passed after binding Agent settings reads to the current thread/project cwd and preferring project scopes by default | Agent workspace-cwd settings verification |

| V-013 | done | high |  | `npm run build` passed after exposing real user config file paths and adding Open config.toml in the Agent panel; `cargo check --manifest-path src-tauri/Cargo.toml` passed with the updated `ConfigLayerSource::User` shape | Agent config file path/open action verification |

| V-014 | done | high |  | `npm run build` passed after adding the Open source licenses row to the Agent settings panel; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Agent open source licenses row verification |
| V-015 | done | high |  | `npm run build` passed after adding the General settings component and global-state service; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding the Tauri global settings persistence bridge | General settings global-state bridge verification |
| V-016 | done | high |  | `npm run build` passed after adding the replica-local i18n provider, locale persistence, and locale-aware history formatting; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Localization plumbing verification |
| V-017 | done | high |  | `npm run build` passed after localizing the remaining Settings / Agent shell labels and expanding the locale selector to the upstream locale inventory; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Localization selector and Settings/Agent copy verification |
| V-018 | done | high |  | `npm run build` passed after moving auth badge/status copy onto i18n message keys; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Auth badge localization verification |
| V-019 | done | high |  | `npm run build` passed after adding `reviewDelivery` and `followUpQueueMode` to the General settings global-state bridge and settings UI; `cargo check --manifest-path src-tauri/Cargo.toml` passed with the expanded supported-key list | General settings review-delivery and follow-up persistence verification |
| V-020 | done | high |  | `npm run build` passed after aligning the rendered General settings copy to upstream wording, adding minimal i18n placeholder interpolation, and replacing the shell header's raw settings-section placeholder text; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Localization wording alignment and shell-header copy verification |
| V-021 | done | high |  | `npm run build` passed after wiring `thread/start` through the Tauri bridge and connecting the shell's New chat buttons to the new-thread flow; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding the new `thread/start` request kind and command | New chat thread-start bridge verification |
| V-022 | done | high |  | `npm run build` passed after aligning more current shell/chat wording to upstream `zh-CN` resource strings, updating `Open Config.toml` casing, and making the changed-files header/counts reflect the rendered placeholder data; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Localization wording follow-up and changed-files copy verification |
| V-023 | done | high |  | `npm run build` passed after adding the chat composer, `turn/start` bridge command, minimal thread item event forwarding, and post-turn thread reconciliation; `cargo check --manifest-path src-tauri/Cargo.toml` remained green | Text turn-start chat path verification |
| V-024 | done | high |  | `cargo fmt --manifest-path src-tauri/Cargo.toml` completed after the approval-flow bridge changes; `cargo check --manifest-path src-tauri/Cargo.toml` passed after adding server-request parsing, approval-response wiring, and inline approval event emission; `npm run build` passed after rendering the pending approval cards and approval decision buttons in the chat view | Approval request/response bridge and inline approval UI verification |
| V-025 | done | high |  | `cargo fmt --manifest-path src-tauri/Cargo.toml` completed after extracting thread-item mapping into `src-tauri/src/thread_history.rs`; `cargo check --manifest-path src-tauri/Cargo.toml` passed after extending `thread/read` and live notifications to carry `commandExecution` / `fileChange` items; `npm run build` passed after extracting the chat main-column render path out of `src/App.tsx`, removing the fake changed-files rows, and rendering real command/file-change thread items in the conversation stream | Real command/file-change thread item rendering and placeholder-removal verification |
| V-026 | done | high |  | `cargo fmt --manifest-path src-tauri/Cargo.toml` completed after adding the `turn/interrupt` bridge command and active-turn tracking changes; `cargo check --manifest-path src-tauri/Cargo.toml` passed after wiring `turn/interrupt` through the Tauri bridge and command registry; `npm run build` passed after switching the running-thread composer action from send to stop and clearing local in-flight state from matching `turn/completed` events | In-flight turn interruption path verification |
| V-025 | done | high |  | Docs-only change: `AGENTS.md` updated with architecture standards after auditing current source structure; no build required | Development architecture standards documentation verification |
| V-026 | done | high |  | Docs-only change: `AGENTS.md` architecture standards expanded from coarse guardrails into concrete file-placement and dependency-boundary rules; no build required | Concrete development standard documentation verification |
| V-027 | done | high |  | Docs-only change: root `AGENTS.md` reviewed and applicable Rust/protocol/testing/dependency guidance merged into replica `AGENTS.md`; no build required | Root AGENTS transferable-rule review verification |
| V-028 | done | high |  | Docs-only change: `AGENTS.md` checked for repeated architecture guidance and stale comparison-method wording; no build required | Final AGENTS consistency verification |
