# Codex App Replica Working Contract

This directory is for building a Windows Codex App replica with Tauri + React.

## Instruction Priority

1. Direct user instructions
2. This file
3. Workspace-level `AGENTS.md`
4. Local implementation convenience

## Scope

- Target only the Windows Codex App unless the user explicitly expands scope.
- Treat the work as an internal, self-use project.
- Replicate the original app at pixel level, interaction level, and feature level.
- Replicate system-level behavior when it exists in the original app.

## Baseline Policy

- Initial target is the currently installed Windows Codex App version on this machine.
- Do not silently switch the target version during an active parity effort.
- Record the exact target app version before major implementation or validation work.
- Only re-baseline to a newer upstream version after the user explicitly requests it.
- Use the currently installed version on this computer as the baseline until the user explicitly announces an update.

## Parity Standard

- `Close enough` is not acceptable unless the user explicitly approves it.
- Do not replace original flows with approximations, simplified UX, or fallback behavior.
- If behavior is uncertain, inspect the installed app first instead of inventing behavior.

## Source Of Truth

- The installed Windows Codex App is the sole authoritative baseline for UI, page layout, static assets, window behavior, interaction logic, shortcuts, auth handling, and protocol behavior.
- The extracted artifact set under `codex-app-replica/compare/resources/<target-version>/app.asar.extracted/` is the primary working baseline for implementation and parity checking against that installed app version.
- If code cannot determine or verify behavior, comparison against the installed app is limited to these methods only: resource extraction, network packet capture, and protocol observation.
- Resource extraction is the default, mandatory first step, and highest-priority comparison method.
- Do not continue with lower-priority comparison methods unless there is a concrete, necessary, and tracker-documented reason that resource extraction is insufficient for the specific question being answered.
- Prefer extracted resources and directly observed runtime behavior from the installed app over inference from adjacent code, generic Tauri/React patterns, or existing replica code.
- The replica codebase, including its current Rust/Tauri/React implementation, is never a source of truth for parity decisions. It is only the rewrite target that must converge to the extracted baseline.
- When extracted artifacts, manually restored helper files, and current replica code disagree, the extracted artifacts win. Restored helper files are secondary aids only and must map back to exact extracted artifact paths before they can justify a change.
- Existing comparison leftovers such as legacy screenshots or ad hoc notes under `compare/` are non-authoritative unless they point back to a concrete extracted artifact or allowed protocol/network evidence.

## Artifact-First Replica Workflow

- For every UI surface, interaction flow, config path, menu item, and protocol-visible behavior, locate the corresponding extracted upstream artifacts first.
- Start implementation and parity correction from the extracted artifacts, not from the current replica rendering.
- Compare the replica code against the upstream extracted source for the same surface, then close only the measured gap.
- If the replica contains behavior, text, layout, icons, assets, config bindings, or feature branches that are not backed by extracted artifacts or allowed protocol/network evidence, remove them or mark the path blocked. Do not keep replica-only guesses.
- Reverse-engineered helper output such as prettified, deobfuscated, or module-restored files may be used only to improve readability. They cannot replace the requirement to cite the exact original extracted bundle, asset, locale file, style token source, or protocol evidence.
- When reverse-engineering reveals a direct reusable upstream asset, locale bundle, style token, or structural definition, prefer reusing or faithfully porting it over hand-recreating an approximation.
- For frontend behavior, treat extracted webview bundles, locale files, CSS, and asset files as the primary subject matter. For shell and integration behavior, use extracted desktop resources first and protocol/network evidence only where extraction cannot answer the question.
- For Rust/Tauri bridge work, derive required frontend-visible behavior from extracted frontend artifacts and observed app-server usage, then implement only the minimum Rust support needed to match that behavior.
- Do not “polish” the current replica toward parity by intuition. Every correction must point to an extracted upstream source or to allowed protocol/network evidence that explains what the extracted source does not expose.

## Backend And Auth Constraints

- Backend integration must match the original Codex App integration model.
- Do not substitute a different backend integration approach for convenience.
- Do not modify backend crates, `codex`, `codex app-server`, or related backend behavior to make the replica work.
- Full compatibility with the existing ChatGPT login state is required.
- Do not create a parallel auth store, alternate auth flow, or compatibility bridge unless the user explicitly approves it.

## Runtime And Assets

- The replica should have its own install and runtime directory structure.
- Reuse upstream resource files when useful.
- Initial delivery is local build and local install only. Auto-update is out of scope for now.
- Use Tailwind for frontend styling.
- Keep all resources, comparison artifacts, and generated comparison outputs under `codex-app-replica/compare/`.
- Prefer the latest stable dependency versions available at implementation time.
- Do not intentionally pin older dependency versions without a blocker or explicit user instruction.

## Comparison Artifacts

- Store all comparison artifacts in `codex-app-replica/compare/`.
- Keep artifact subdirectories stable across sessions to avoid directory drift and duplicate work.
- Use the same comparison artifact locations for repeated captures of the same target version unless the user explicitly requests a new baseline.
- Use stable subdirectories under `compare/` for `resources/`, `network/`, `protocol/`, and `baselines/<target-version>/`.
- Maintain a single living tracker at `codex-app-replica/compare/tracker.md` for the full feature list, open TODOs, blocked items, and verification status.
- The tracker format is a single Markdown file.
- Track entries must use stable fields: `ID`, `Status`, `Priority`, `Blocked Reason`, `Evidence`, and `Notes`.
- The tracker is organized in two layers: module entries at the top level, then page / flow entries nested under the module they belong to.
- The tracker must include foundation, scaffolding, build, and packaging work, not only user-facing product features.
- Every implementation, reverse-engineering, and parity-validation task must map to an item in the tracker before work starts.
- Do not start implementation, reverse-engineering, or parity-validation work that is not represented in the tracker.

## Tracker Maintenance

- Do not create tracker entries for AGENTS-only governance, policy, or working-contract edits unless the user explicitly requests it.
- For tracker-scoped work, update `compare/tracker.md` before starting work, when status changes, when new evidence is captured, and when work is blocked or verified.
- Create new tracker entries as soon as reverse-engineering reveals a new module, page, flow, system behavior, or foundation task that matters for parity.
- Keep module IDs stable as `M-###`.
- Keep page / flow IDs stable under their owning module, using a consistent suffix scheme.
- Keep standalone TODO items stable as `T-###`.
- Do not renumber existing entries unless the user explicitly requests tracker reorganization.
- Use `todo` for discovered work that has not started.
- Use `in_progress` for the single task currently being worked on, unless parallel work is explicitly justified in the tracker notes.
- Use `blocked` when progress cannot continue without user resolution or when constraints prohibit a compliant implementation.
- Use `done` only after the work and its required evidence are both complete.
- When an item becomes `blocked`, fill `Blocked Reason` with the concrete blocker and mirror the item in the tracker `Blocked Items` section.
- When an item is completed, add or update its evidence path or evidence summary in `Evidence`.
- Use `Notes` for scope boundaries, implementation decisions, reverse-engineering observations, and links to related tracker IDs.
- For implementation or parity-correction items, record the exact upstream extracted artifact path or paths before code changes begin.
- For implementation or parity-correction items, `Notes` must make the mapping explicit: upstream source path, replica target path, and the concrete gap being closed.
- Keep `Open TODOs` focused on near-term executable work.
- Keep `Verification Log` focused on completed checks and their evidence.
- If a tracker item splits into multiple concrete tasks, create child or sibling entries instead of overloading one row with unrelated work.

## Delivery Path

- The overall replica path is to complete full shell parity and visual parity before feature replication begins.
- Detailed development instructions for implementation work must come from `codex-app-replica/compare/tracker.md`, not from this phase statement.

## Diagnostics

- Do not add built-in debug UI, debug panels, or developer-facing diagnostics surfaces unless the user explicitly requests them.

## Blocked Handling

- If parity requires backend modification, login-state incompatibility, unverifiable target behavior, or any deviation from the required backend integration model, mark the work as `blocked`.
- When a path is `blocked`, stop dependent work on that path and wait for user confirmation.
- Independent non-blocked work may continue if it does not hide, bypass, or dilute the blocker.
- Keep blocked items visible in the tracker until the user resolves them.

## Verification And Acceptance

- Validate by stages, not by frequent ad hoc acceptance checks.
- Preferred evidence includes resource extraction diffs, network/protocol/RPC observations, local build validation, and local install validation.
- Do not claim parity without evidence against the installed Windows Codex App baseline.

## Implementation Guardrails

- Use Tauri + React for the desktop shell and frontend.
- Keep focus on the Windows target and avoid cross-platform abstractions unless they are required for parity or explicitly requested.
- Do not add fallback-compatible shims, approximation layers, or alternative mainline behavior when the original behavior can be measured.

## UI And Settings Fidelity Rules

These rules are mandatory for every visual surface, menu, settings page, toolbar action, button, form control, and shell region.

- Do not invent, substitute, or approximate icons. Every menu icon, toolbar icon, button icon, row icon, status icon, chevron, overflow icon, and state icon must come from extracted original-app asset/component evidence.
- Do not replace an original icon with a semantically similar icon from another icon set. Matching meaning is not sufficient; the visual asset itself must match.
- If the original icon asset or component cannot be identified, leave the item incomplete or blocked instead of using a similar icon temporarily.
- Do not change page or panel layout order for convenience. Preserve the original order of sections, rows, action groups, sidebars, columns, headers, footers, tabs, empty states, and inline action placement exactly as evidenced from the original app.
- Do not reorder settings rows, menu items, or action buttons based on perceived importance or implementation convenience.
- Do not change the original menu hierarchy. Do not add grouping headers, nested menus, tabs, sidebar groups, separators, accordions, collapsible groups, subpanes, or extra levels unless the original app has the same hierarchy.
- If the original app presents items as a flat list, keep them as a flat list. Do not introduce grouping simply because it looks cleaner.
- Do not replace one control type with another. If the original uses a dropdown/select, implement a dropdown/select; if it uses a checkbox, segmented control, radio group, text field, toggle, combobox, command menu, confirmation dialog, or inline action row, match that control type and interaction model.
- Matching the underlying data model is not enough. The visible control family, trigger style, expanded surface, selection affordance, and confirmation behavior must also match.
- Do not split, merge, rename, relocate, or re-group settings sections unless extracted original-app evidence shows that split, merge, name, location, and grouping.
- Do not add explanatory copy, subtitles, helper text, badges, placeholder cards, empty-state prose, tooltip text, menu labels, group labels, or convenience hints that are not present in the original app.
- Do not translate, rewrite, or simplify visible copy by hand when an upstream locale/message key exists. Reuse extracted locale keys and wording.
- Do not keep replica-only placeholder content after the corresponding original-backed surface is known. Remove placeholder content instead of making it look polished.
- Do not infer UI from backend capability names alone. UI structure must come from extracted frontend resources or directly observed original behavior through the allowed comparison methods.
- If original evidence is incomplete for icon, layout, control type, menu hierarchy, config source, or visible copy, mark the affected implementation path incomplete or blocked instead of filling the gap creatively.

### UI Evidence Checklist

Before implementing or changing any UI surface, identify the original-app evidence for all applicable items:

- Exact extracted source file or asset path that owns the surface.
- Icon source or explicit proof that the original item has no icon.
- Exact menu/action hierarchy and item order.
- Exact page section order and row order.
- Exact control type and interaction model.
- Exact visible copy and locale/message key.
- Exact config key, config layer, config file, app-server method, or global-state source used by the original app.
- Exact visibility condition, feature gate, platform gate, auth gate, or experimental gate when present.

If any required evidence is missing, continue resource extraction first. Use network packet capture or protocol observation only when resource extraction is insufficient for that specific question.

### Configuration Source Fidelity

- Do not guess which config file or state store a setting uses.
- Do not load `AGENTS.md`, `config.toml`, global-state files, workspace files, or project files unless original-app evidence shows that exact source for the feature being implemented.
- Do not swap in a nearby or similarly named config source just because it already exists in the replica codebase.
- For every setting or persisted preference, identify the exact original source before implementation: file, app-server method, config key, config layer, scope, and reload path.
- Do not substitute a replica-local config file for an original app-server config path unless the feature is explicitly replica-local and cannot exist in upstream.
- Settings reads and writes must use the same app-server method, config key, config layer, file path behavior, and reload behavior as the original app.
- When original behavior uses global desktop app state rather than app-server config, keep it in the replica global-state path and do not mirror it into backend config.
- When original behavior uses workspace-scoped files, resolve the workspace from the same source as the original app. Do not fall back to process cwd, repository root, or selected thread cwd unless original evidence supports that fallback.
- If the original source cannot be proven, block the implementation path instead of binding the UI to the wrong file or store.

## Architecture Defaults

- Follow the detailed `Development Architecture Standards` below for file placement, ownership, dependency direction, and verification.
- Prefer the simplest structure that satisfies those standards and the current tracker item.
- Do not introduce extra state layers, global stores, adapters, or abstractions unless they solve a real ownership, parity, or integration problem documented in the tracker.

## Development Architecture Standards

These rules tell future Codex CLI agents where each type of code belongs and how changes must flow. They are based on the current Tauri v2 command / capability model, React state ownership guidance, and Tailwind source-detectable class model.

If current code violates this target structure, do not copy the violation into new work. When a tracker item touches the violating area, move the touched behavior toward the target structure without broad unrelated rewrites.

### Target Frontend File Map

| Path | Code That Belongs Here | Code That Does Not Belong Here |
| --- | --- | --- |
| `src/main.tsx` | React bootstrapping only. | Product logic, state, services, styling decisions. |
| `src/App.tsx` | Temporary root composition while the app is being extracted; top-level shell wiring only. | New feature implementation, large JSX blocks, feature constants, fake data, Tauri calls, app-server event parsing. |
| `src/app/` | App root composition, providers, top-level route selection, shell-level layout orchestration. | Feature-specific business logic or app-server protocol mapping. |
| `src/features/<feature>/` | One product area such as shell, auth, chat, history, settings, approvals, localization, protocol-visible runtime surfaces. | Shared generic UI, unrelated feature code, low-level Tauri transport. |
| `src/features/<feature>/components/` | Feature-owned React components that render that feature's UI. | Tauri `invoke`, app-server JSON parsing, global mutable state. |
| `src/features/<feature>/hooks/` | Feature state ownership and side effects such as loading, subscriptions, optimistic-free reconciliation, and command orchestration. | Pure presentational JSX that can be a component, low-level transport implementation. |
| `src/features/<feature>/types.ts` | Feature view models and domain types consumed by that feature. | Raw backend protocol blobs that belong in service or adapter modules. |
| `src/features/<feature>/constants.ts` | Feature-local constants proven by resource extraction or tracker evidence. | Global design tokens, hardcoded fake data, values copied without evidence. |
| `src/components/` | Shared reusable presentational components with stable props and no product-specific ownership. | Feature workflows, app-server calls, Tauri calls, hidden global state. |
| `src/services/` | Typed frontend APIs that wrap Tauri commands and event subscriptions. | React rendering, component state, direct DOM behavior. |
| `src/i18n/` | Locale resolution, message dictionaries, formatting helpers, and upstream-locale mappings. | Feature-specific state or UI that only happens to render translated text. |
| `src/lib/` | Pure utilities with no React, no Tauri, no app-server dependency, and no side effects. | Feature-specific helpers, environment access, mutable singletons. |
| `src/assets/` | Source-controlled runtime assets used by the replica frontend. | Compare artifacts, extracted baselines, generated reverse-engineering output. |
| `src/styles.css` | Tailwind import, base document styles, CSS variables, upstream-extracted design tokens, tiny shared primitives. | Feature layout, page-specific selectors, broad component styling that should be Tailwind or component-local. |

### Target Frontend Feature Shape

New or extracted feature code should use this shape unless the tracker documents a better fit for that feature:

```text
src/features/<feature>/
  index.ts
  types.ts
  constants.ts
  hooks/
    use<Feature>.ts
  components/
    <Feature>Panel.tsx
    <Feature>Row.tsx
```

- `index.ts` exports only the public feature surface needed by `src/app/` or other allowed consumers.
- `types.ts` contains feature view types and should not re-export every backend protocol field by default.
- `constants.ts` must cite extracted-resource or tracker-backed values in nearby comments only when the value is not self-evident.
- Feature hooks own loading, error, subscription, and command orchestration for that feature.
- Feature components receive data and callbacks through props or feature hooks; they do not own backend integration.
- Feature modules may import shared components, services, i18n, and pure utilities.
- Feature modules must not import sibling feature internals. Shared behavior must move to `src/components/`, `src/services/`, `src/i18n/`, or `src/lib/`.

### Frontend Data Flow

- The normal data path is: component event -> feature hook -> typed frontend service -> Tauri command -> Rust command handler -> app-server adapter -> `codex app-server`.
- The normal notification path is: `codex app-server` notification -> Rust app-server adapter -> stable Tauri event -> typed frontend service subscription -> feature hook -> component render.
- UI components must not parse raw app-server JSON.
- UI components must not call `invoke` or `listen` directly except shell-owned window controls that have no domain service.
- Services must expose typed functions and typed subscription helpers. They should hide Tauri command names and event names from feature components.
- Feature hooks should reconcile from authoritative app-server responses or events. Avoid fake local echo state when the server can provide the source of truth.
- Any optimistic UI must be tracker-documented, reversible, and reconciled from authoritative app-server state.

### React State And Effects

- Every state value must have one clear owner: component-local state, feature-hook state, provider state, or Rust-managed state.
- Keep state local if only one component subtree uses it.
- Lift state only when two or more visible surfaces must coordinate the same value.
- Provider state is allowed for cross-cutting app concerns such as locale, theme tokens, auth snapshot, or shell route state.
- Do not store values that can be derived during render from props, service data, or other state.
- Do not duplicate server state in separate UI state unless the reconciliation rule is explicit in the feature hook.
- Use effects only to synchronize with external systems: Tauri events, app-server requests, timers, browser APIs, or persisted settings.
- Every event subscription effect must return cleanup.
- Avoid dependency-suppression comments. If an effect dependency is unstable, restructure the hook or move non-reactive event logic into an appropriate React event pattern.

### Frontend Styling And Tailwind

- Use Tailwind utilities for component layout, spacing, typography, flex/grid behavior, borders, and state styling.
- Tailwind class names must be statically detectable in source. Use explicit variant maps such as `const toneClass = { active: "...", idle: "..." }` instead of string-built class names.
- Use CSS variables for upstream-extracted design tokens such as colors, font sizes, radii, toolbar heights, sidebar widths, and animation durations.
- Put token definitions and base styles in `src/styles.css`.
- Put repeated component-level utility combinations into small components first; use global CSS classes only when a real shared primitive is clearer.
- Do not add broad selectors that style arbitrary descendants of a feature area.
- Inline styles are allowed for runtime-measured values, CSS variable assignment, or values Tauri/window APIs provide dynamically.
- Any new non-obvious visual value must be backed by `compare/resources/...` evidence or a tracker note.

### Assets And Reverse-Engineered Values

- Extracted original-app resources stay under `compare/resources/<target-version>/`.
- Source-controlled assets used by the replica may be copied into `src/assets/` only when the runtime needs them.
- Do not reference `compare/` paths from production runtime code.
- When copying an asset from extracted resources into runtime source, record the original path and target path in `compare/tracker.md`.
- Do not recreate icons, fonts, images, or locale bundles manually when the extracted upstream asset can be reused.
- Hardcoded layout or behavior values must come from extracted resources, app-server protocol docs, or directly observed protocol/network evidence.
- Generated reverse-engineering output is helper material only. If a generated readable file does not cite or preserve its originating extracted bundle path, it is not sufficient evidence for parity work.

### Target Tauri/Rust File Map

| Path | Code That Belongs Here | Code That Does Not Belong Here |
| --- | --- | --- |
| `src-tauri/src/main.rs` | `codex_app_replica_lib::run()` only. | Setup, commands, state, integration logic. |
| `src-tauri/src/lib.rs` | Tauri builder setup, plugin registration, managed state registration, command registration, startup task wiring. | App-server protocol parsing, feature business logic, Windows registry implementation, large command bodies. |
| `src-tauri/src/commands/` | Small Tauri command handlers grouped by feature. | JSON-RPC transport internals, process lifecycle management, frontend-only view formatting. |
| `src-tauri/src/state.rs` | Shared managed-state structs and constructors. | Command implementation details or protocol mapping. |
| `src-tauri/src/events.rs` | Stable event-name constants and typed event payload definitions emitted to the webview. | Ad hoc event emission logic spread across feature modules. |
| `src-tauri/src/app_server/` | Process lifecycle, stdin/stdout JSONL transport, request routing, response correlation, server-request handling, notification mapping. | UI wording, React-shaped view formatting, Windows shell integration. |
| `src-tauri/src/features/<feature>/` | Replica-native feature logic that sits above app-server transport, such as auth, threads, turns, settings, approvals. | Generic JSON-RPC transport, unrelated feature code. |
| `src-tauri/src/windows/` | Windows-only integration such as registry context menus, launch arguments, paths, window/system behavior. | App-server requests, frontend view models, cross-platform abstractions without need. |
| `src-tauri/src/config/` | Replica-local configuration and persisted app state not owned by `codex app-server`. | Backend config behavior that belongs to app-server and must not be reimplemented. |
| `src-tauri/src/error.rs` | Internal error types and conversion to command-safe strings. | User-facing UI wording or raw `String` errors throughout modules. |

### Tauri Commands

- Tauri commands are the only webview-to-Rust boundary.
- Each command should be small: validate input, call the owning Rust service/feature, map the result to a serializable response.
- Command params and responses must be explicit structs with `#[serde(rename_all = "camelCase")]` unless matching an existing app-server shape requires otherwise.
- Avoid `serde_json::Value` in command signatures. Keep raw JSON inside the app-server adapter.
- Command errors should be converted into stable strings at the boundary after preserving structured errors internally.
- Commands that touch file paths, registry, process launch, shell permissions, or app-server mutation must validate inputs in Rust.
- Do not expose broad generic commands such as arbitrary shell execution, arbitrary file read/write, or raw JSON-RPC passthrough unless original-app parity requires it and the tracker records the evidence.

### Protocol And Wire Shape Rules

- Use consistent payload suffixes: `*Params` for request payloads, `*Response` for command/RPC responses, and `*Notification` for pushed events.
- Rust struct fields should use snake_case internally and serialize to camelCase at the Tauri/webview boundary unless matching an upstream app-server payload requires another shape.
- Keep Rust serde renames and TypeScript frontend types aligned. If a field or variant is renamed on one side, update the other side in the same change.
- Use discriminated unions for variant payloads in both Rust and TypeScript. Prefer an explicit `type` tag for frontend-visible event and item unions.
- Prefer plain string IDs at the frontend/Tauri boundary unless the UI truly needs parsed ID semantics.
- Represent timestamps as integer Unix seconds at protocol boundaries. Use `*_at` in Rust fields and camelCase `*At` in TypeScript types after serialization.
- Optional collection fields should be explicit about absence versus empty collection. Do not use `null`, `undefined`, and empty arrays interchangeably.
- Config values that mirror `config.toml` keys may preserve upstream snake_case where the app-server protocol does so.
- Do not add new app-server API surface. If parity appears to require a backend protocol addition, mark the tracker item `blocked`.

### App-Server Bridge

- The bridge must preserve the original backend integration model and must not modify `codex`, `codex app-server`, or backend crates.
- Split bridge responsibilities into process lifecycle, transport, request registry, response parsing, server-request response handling, notifications, and feature APIs.
- Feature APIs should be typed wrappers over app-server methods such as auth, thread, turn, config, and approval operations.
- Server-initiated requests must be represented as typed Rust events before reaching the frontend.
- Event names must be centralized in `src-tauri/src/events.rs` or an equivalent single module.
- App-server protocol fields should be mapped once near the adapter. Do not duplicate protocol-shape parsing in multiple commands.
- If an app-server behavior cannot be verified through code or allowed comparison methods, mark the tracker item `blocked`.

### Rust State, Concurrency, And Process Rules

- Long-running app-server process state must be owned by Tauri managed state.
- Use explicit ownership around request senders, pending responses, login state, and pending approval requests.
- Do not hold mutex locks across `.await`.
- Background tasks must have a clear startup owner and error-reporting path.
- Process lifecycle code should handle app exit and broken pipes deliberately.
- Avoid stringly typed request IDs or event keys where a small enum/newtype clarifies ownership.
- Keep modules under a maintainable size. If a Rust source file approaches roughly 500 lines, prefer adding a module for new behavior; if it exceeds roughly 800 lines, do not extend it except for a small transition needed to extract code.

### Rust Code Style And API Shape

- Inline `format!` arguments when possible, for example `format!("failed: {err}")`.
- Collapse nested `if` statements when doing so improves clarity and matches Rust clippy guidance.
- Prefer method references over closures when the method reference is equally clear.
- Prefer exhaustive `match` statements. Avoid wildcard arms when every variant can be named.
- Avoid boolean or ambiguous `Option` positional parameters in internal Rust APIs. Prefer enums, named structs, builder-style methods, or newtypes when they make callsites self-documenting.
- If an opaque positional literal is unavoidable, add a brief parameter-name comment at the callsite.
- Newly added traits must include doc comments explaining their role and implementation expectations.
- Do not use `#[async_trait]` or `#[allow(async_fn_in_trait)]` for new traits. Prefer native trait methods returning `impl Future + Send`.
- Prefer private modules with explicit public exports instead of broad `pub` surfaces.
- Do not add tiny helper functions that are called only once unless they clarify a complex boundary, ownership rule, or test fixture.
- Move related tests and docs with code when extracting a module so invariants remain near the implementation.
- When running Rust build/check/test commands, be patient with Cargo locks and do not kill Rust processes only because they are slow.

### Permissions, Security, And Native Capabilities

- Tauri capabilities must remain minimal and specific to implemented parity.
- New permissions require a tracker item and evidence that the original app or local build path needs the capability.
- `tauri-plugin-shell` usage must stay constrained to concrete parity needs.
- Do not expose raw filesystem, process, registry, or network primitives to the webview.
- Windows integration must be idempotent and scoped to Windows-only modules.
- Registry writes must use explicit keys and values derived from the installed-app baseline or tracker-approved local install behavior.

### TypeScript Type Rules

- Use TypeScript types at every service and feature boundary.
- Keep Tauri command payload types in frontend services aligned with Rust command structs.
- Prefer discriminated unions for event payloads and item variants.
- Avoid `any`. If unknown input is unavoidable at a boundary, narrow it immediately in the service or adapter.
- Do not pass raw protocol objects through the UI if a smaller view model can represent the rendered surface.
- Keep localization keys typed through the existing i18n message-key model.

### Testing And Verification Gates

- Every implementation or refactor must be represented in `compare/tracker.md` before work starts.
- For frontend or TypeScript changes, run `npm run build` before claiming completion.
- For Tauri/Rust changes, run `cargo fmt --manifest-path src-tauri/Cargo.toml` after edits and `cargo check --manifest-path src-tauri/Cargo.toml` before claiming completion.
- For behavior that crosses frontend and Tauri, run both frontend build and Rust check.
- For docs-only changes, no build is required unless the documentation changes executable project behavior.
- If a large file is split, keep the refactor behavior-preserving and verify with the same build/check commands that covered the original behavior.
- When adding or changing dependencies, include the relevant lockfile update in the same change and run the build/check commands that prove lockfile consistency for this project.
- If work touches root `codex-rs` dependencies or backend crates despite the replica constraint, follow the root `AGENTS.md` dependency and Bazel lock rules exactly, or mark the tracker item `blocked` if that would violate the user constraints.
- Tests should compare whole objects where practical instead of asserting field-by-field.
- Avoid mutating process environment in tests. Prefer passing environment-derived values through explicit parameters or test fixtures.
- Prefer deletion and reuse of existing utilities over adding new abstractions during cleanup.
- Keep diffs small, reviewable, and reversible; split tracker items if a change mixes unrelated concerns.
- Final reports for implementation work must include changed files, verification run, and remaining risks or blockers.
- If a best-practice rule conflicts with measured original-app parity, original-app parity wins and the deviation must be documented in the tracker.

### Refactoring Existing Drift

- Do not start broad architecture cleanup without a tracker item.
- When implementing a new feature in an overgrown file, extract only the directly touched area needed for that tracker item.
- Preserve behavior first, then move code, then verify.
- Do not mix visual parity changes, protocol changes, and architecture cleanup in one untracked edit.
- New code must follow this standard even if nearby legacy replica code does not yet follow it.

## Localization

- Match the original app's multilingual behavior and language coverage.
- Do not narrow the language surface unless the original app does so.
