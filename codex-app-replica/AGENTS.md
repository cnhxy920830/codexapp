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

- The installed Windows Codex App is the authoritative source of truth for UI, layout, assets, window behavior, interactions, shortcuts, auth handling, and protocol behavior.
- When behavior is unknown or unverifiable from code, only use these comparison methods against the installed app: screenshots, resource extraction, network packet capture, and protocol observation.
- Resource extraction has the highest priority among comparison methods.
- Prefer observed behavior from the installed app over inference from adjacent code.

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
- Use stable subdirectories under `compare/` for `resources/`, `screenshots/`, `network/`, `protocol/`, `recordings/`, and `baselines/<target-version>/`.
- Maintain a single living tracker at `codex-app-replica/compare/tracker.md` for the full feature list, open TODOs, blocked items, and verification status.
- The tracker format is a single Markdown file.
- Track entries must use stable fields: `ID`, `Status`, `Priority`, `Blocked Reason`, `Evidence`, and `Notes`.
- The tracker is organized in two layers: module entries at the top level, then page / flow entries nested under the module they belong to.
- The tracker must include foundation, scaffolding, build, and packaging work, not only user-facing product features.
- Every implementation task must map to an item in the tracker before work starts.
- Do not start work that is not represented in the tracker.

## Tracker Maintenance

- Update `compare/tracker.md` before starting work, when status changes, when new evidence is captured, and when work is blocked or verified.
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
- Keep `Open TODOs` focused on near-term executable work.
- Keep `Verification Log` focused on completed checks and their evidence.
- If a tracker item splits into multiple concrete tasks, create child or sibling entries instead of overloading one row with unrelated work.

## Delivery Path

- The overall replica path is to complete full shell parity and visual parity before feature replication begins.
- Detailed development instructions must come from `codex-app-replica/compare/tracker.md`, not from this phase statement.

## Diagnostics

- Do not add built-in debug UI, debug panels, or developer-facing diagnostics surfaces unless the user explicitly requests them.

## Blocked Handling

- If parity requires backend modification, login-state incompatibility, unverifiable target behavior, or any deviation from the required backend integration model, mark the work as `blocked`.
- When a path is `blocked`, stop dependent work on that path and wait for user confirmation.
- Independent non-blocked work may continue if it does not hide, bypass, or dilute the blocker.
- Keep blocked items visible in the tracker until the user resolves them.

## Verification And Acceptance

- Validate by stages, not by frequent ad hoc acceptance checks.
- Preferred evidence includes screenshot diff, interaction replay, protocol or RPC comparison, local build validation, and local install validation.
- Do not claim parity without evidence against the installed Windows Codex App baseline.

## Implementation Guardrails

- Use Tauri + React for the desktop shell and frontend.
- Keep focus on the Windows target and avoid cross-platform abstractions unless they are required for parity or explicitly requested.
- Do not add fallback-compatible shims, approximation layers, or alternative mainline behavior when the original behavior can be measured.

## Architecture Defaults

- Use a feature-first frontend structure unless the original app forces a different split.
- Keep shared UI in explicit shared modules and keep feature-specific logic beside the feature that owns it.
- Put Tauri/Rust entry and native integration in `src-tauri/src/lib.rs`; keep `src-tauri/src/main.rs` thin.
- Use Tauri commands as the boundary between the webview and Rust.
- Keep app-server, auth, and other external integrations behind explicit service or adapter modules.
- Do not let components talk directly to app-server or Tauri APIs when a service layer can own the integration.
- Keep UI state local by default.
- Lift state only when two or more parts of the UI must coordinate the same source of truth.
- Avoid redundant, duplicated, or deeply nested state unless parity requires it.
- Use Tauri-managed state for Rust-side shared state.
- Use events or channels only when the data flow is naturally streaming or push-based.
- Do not add extra state layers, global stores, or abstractions unless they solve a real sharing or ownership problem.

## Localization

- Match the original app's multilingual behavior and language coverage.
- Do not narrow the language surface unless the original app does so.
