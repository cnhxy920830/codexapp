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
  2. Screenshots
  3. Network packet capture
  4. Protocol observation
- Allowed comparison methods are limited to the four methods above when code cannot confirm behavior.
- Backend constraint: do not modify backend crates, `codex`, or `codex app-server`.
- Auth constraint: full compatibility with the existing ChatGPT login state is required.
- Blocked rule: if parity requires backend modification, login-state incompatibility, unverifiable target behavior, or deviation from the original backend integration model, mark the work as `blocked`.
- Scope rule: do not start work that is not represented in this tracker.
- Styling rule: use Tailwind.
- Dependency rule: prefer the latest stable dependency versions available at implementation time.

## Current Baseline

- Target app version: pending discovery from the installed Windows Codex App.
- Target build identifier: pending discovery from the installed Windows Codex App.
- Baseline capture root: `compare/baselines/<target-version>/`
- Current reverse-engineering status: not started

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
| M-000 | todo | high |  |  | Foundation / scaffolding / build / packaging |
| M-001 | todo | high |  |  | Shell / window parity |
| M-002 | todo | high |  |  | Visual parity |
| M-003 | todo | high |  |  | Login-state compatibility |
| M-004 | todo | high |  |  | System-level behavior parity |
| M-005 | todo | high |  |  | Localization parity |
| M-006 | todo | medium |  |  | Chat / history parity |
| M-007 | todo | medium |  |  | Settings parity |
| M-008 | todo | medium |  |  | Protocol / app-server integration |
| M-009 | todo | medium |  |  | Resource extraction baseline |
| M-010 | todo | medium |  |  | Network / protocol observation baseline |

## Page / Flow Inventory

### M-000 Foundation / scaffolding / build / packaging

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-000-001 | todo | high |  |  | Project scaffolding |
| M-000-002 | todo | high |  |  | Dependency selection and lockfiles |
| M-000-003 | todo | high |  |  | Build configuration |
| M-000-004 | todo | high |  |  | Packaging / installer configuration |
| M-000-005 | todo | high |  |  | Tracker-driven workflow enforcement |

### M-001 Shell / window parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-001-001 | todo | high |  |  | Discover shell layout and window chrome from installed app |
| M-001-002 | todo | high |  |  | Inventory shell regions, panes, title bar, and window controls |

### M-002 Visual parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-002-001 | todo | high |  |  | Extract visual assets from installed app |
| M-002-002 | todo | high |  |  | Capture baseline screenshots for shell and top-level views |
| M-002-003 | todo | high |  |  | Inventory typography, spacing, colors, and iconography |

### M-003 Login-state compatibility

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-003-001 | todo | high |  |  | Discover auth entry points and login-state dependencies |
| M-003-002 | todo | high |  |  | Verify whether login-state compatibility is observable without backend changes |

### M-004 System-level behavior parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-004-001 | todo | high |  |  | Inventory system-level behaviors exposed by the installed app |

### M-005 Localization parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-005-001 | todo | high |  |  | Discover language surface and localization assets |

### M-006 Chat / history parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-006-001 | todo | medium |  |  | Inventory top-level chat and history surfaces before feature replication |

### M-007 Settings parity

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-007-001 | todo | medium |  |  | Inventory settings surfaces before feature replication |

### M-008 Protocol / app-server integration

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-008-001 | todo | medium |  |  | Discover original backend integration model from installed app and local codebase |

### M-009 Resource extraction baseline

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-009-001 | todo | high |  |  | Locate installed app resources and package structure |
| M-009-002 | todo | high |  |  | Extract reusable assets into stable compare locations |
| M-009-003 | todo | high |  |  | Record extracted resource inventory and mapping |

### M-010 Network / protocol observation baseline

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| M-010-001 | todo | medium |  |  | Capture protocol and network observations needed to confirm shell-adjacent behavior |

## Open TODOs

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
| T-001 | todo | high |  |  | Discover installed Windows Codex App version and build identifier |
| T-002 | todo | high |  |  | Create stable `compare/` subdirectories for baseline artifacts |
| T-003 | todo | high |  |  | Start resource extraction baseline work under `M-009` |
| T-004 | todo | high |  |  | Build the first complete shell and visual inventory from installed app evidence |

## Blocked Items

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |

## Verification Log

| ID | Status | Priority | Blocked Reason | Evidence | Notes |
| --- | --- | --- | --- | --- | --- |
