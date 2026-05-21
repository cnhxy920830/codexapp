/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/hotkeyWindow/__snapshots__/hotkey-window-home-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.HOTKEY_WINDOW_HOME_PAGE_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("hotkey window home page snapshots", async (t) => {
  const actualSnapshots = await buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  cloudModeMenuOpen: string;
  projectless: string;
  worktreeMenuOpen: string;
};

async function buildSnapshots(): Promise<SnapshotMap> {
  installMinimalBrowserGlobals();
  const { HotkeyWindowHomePageView } = await import("./HotkeyWindowHomePage");

  return {
    cloudModeMenuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[460px] w-[640px]">
          <HotkeyWindowHomePageView
            branchControl={null}
            codexHome={null}
            composerEnterBehavior="enter"
            draft="Investigate deployment logs"
            environmentControlEnabled={false}
            environmentOptions={[]}
            error={null}
            initialProjectSelection={localProjectSelection}
            isFullAccessConfirmOpen={false}
            isPermissionsLoading={false}
            isProjectless={false}
            isSubmitting={false}
            isTaskMenuOpen
            mode="cloud"
            modeDisabledTooltipText={null}
            permissionMenuValue="default"
            permissionOptions={[...permissionOptions]}
            permissionTriggerLabel="Default permissions"
            permissionsHidden
            permissionsMenuDisabled={false}
            placeholderText="Ask Codex anything in the cloud"
            pointerInteractionPaused={false}
            projectMenuInitialSelection={localProjectSelection}
            quickActions={[
              {
                icon: <span data-icon="local" />,
                title: "Work locally",
                value: "local",
              },
              {
                icon: <span data-icon="worktree" />,
                title: "New worktree",
                value: "worktree",
              },
            ]}
            selectedEnvironmentConfigPath={null}
            selectedEnvironmentLabel={null}
            selectedLocalWorkspaceRoot={LOCAL_WORKSPACE_ROOT}
            worktreeAllowed={true}
            onConfirmFullAccess={noop}
            onDismissFullAccessConfirm={noop}
            onDraftChange={noopString}
            onEnvironmentSelect={noopString}
            onOpenLocalEnvironmentSettings={noop}
            onPermissionSelect={noopString}
            onQuickActionSelect={noopMode}
            onSelectedProjectChange={noopProjectSelection}
            onSubmit={noop}
            onToggleTaskMenu={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    projectless: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[460px] w-[640px]">
          <HotkeyWindowHomePageView
            branchControl={null}
            codexHome={null}
            composerEnterBehavior="cmdIfMultiline"
            draft=""
            environmentControlEnabled={false}
            environmentOptions={[]}
            error={null}
            initialProjectSelection={null}
            isFullAccessConfirmOpen={false}
            isPermissionsLoading={false}
            isProjectless
            isSubmitting={false}
            isTaskMenuOpen={false}
            mode="local"
            modeDisabledTooltipText="Projectless chats run locally"
            permissionMenuValue="default"
            permissionOptions={[...permissionOptions]}
            permissionTriggerLabel="Default permissions"
            permissionsHidden={false}
            permissionsMenuDisabled={false}
            placeholderText="Ask Codex anything locally"
            pointerInteractionPaused={false}
            projectMenuInitialSelection={null}
            quickActions={[]}
            selectedEnvironmentConfigPath={null}
            selectedEnvironmentLabel={null}
            selectedLocalWorkspaceRoot={null}
            worktreeAllowed={false}
            onConfirmFullAccess={noop}
            onDismissFullAccessConfirm={noop}
            onDraftChange={noopString}
            onEnvironmentSelect={noopString}
            onOpenLocalEnvironmentSettings={noop}
            onPermissionSelect={noopString}
            onQuickActionSelect={noopMode}
            onSelectedProjectChange={noopProjectSelection}
            onSubmit={noop}
            onToggleTaskMenu={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    worktreeMenuOpen: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[520px] w-[680px]">
          <HotkeyWindowHomePageView
            branchControl={<div className="app-thread-composer-pill">feature/login-flow</div>}
            codexHome={null}
            composerEnterBehavior="enter"
            draft="Ship a worktree patch"
            environmentControlEnabled
            environmentOptions={[
              {
                description: "environment.toml",
                label: "Default env",
                value: "D:\\workspace\\codex\\.codex\\environments\\environment.toml",
              },
              {
                description: "preview.toml",
                label: "Preview env",
                value: "D:\\workspace\\codex\\.codex\\environments\\preview.toml",
                warning: "Missing dependency",
              },
            ]}
            error="Failed to read local settings"
            initialProjectSelection={localProjectSelection}
            isFullAccessConfirmOpen={false}
            isPermissionsLoading={false}
            isProjectless={false}
            isSubmitting={false}
            isTaskMenuOpen
            mode="worktree"
            modeDisabledTooltipText={null}
            permissionMenuValue="guardian-approvals"
            permissionOptions={[...permissionOptions]}
            permissionTriggerLabel="Auto-review"
            permissionsHidden={false}
            permissionsMenuDisabled={false}
            placeholderText="Ask Codex anything in a worktree in codex"
            pointerInteractionPaused
            projectMenuInitialSelection={localProjectSelection}
            quickActions={[
              {
                icon: <span data-icon="local" />,
                title: "Work locally",
                value: "local",
              },
            ]}
            selectedEnvironmentConfigPath="D:\\workspace\\codex\\.codex\\environments\\environment.toml"
            selectedEnvironmentLabel="Default env"
            selectedLocalWorkspaceRoot={LOCAL_WORKSPACE_ROOT}
            worktreeAllowed
            onConfirmFullAccess={noop}
            onDismissFullAccessConfirm={noop}
            onDraftChange={noopString}
            onEnvironmentSelect={noopString}
            onOpenLocalEnvironmentSettings={noop}
            onPermissionSelect={noopString}
            onQuickActionSelect={noopMode}
            onSelectedProjectChange={noopProjectSelection}
            onSubmit={noop}
            onToggleTaskMenu={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function StaticI18nProvider({ children }: { children: ReactElement }) {
  return (
    <I18N_CONTEXT.Provider
      value={{
        locale: "en-US" as LocaleCode,
        setLocale: noopLocale,
        t: translate,
      }}
    >
      {children}
    </I18N_CONTEXT.Provider>
  );
}

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

const LOCAL_WORKSPACE_ROOT = "D:\\workspace\\codex";

const localProjectSelection: HotkeyWindowProjectSelection = {
  kind: "local",
  workspaceRoot: LOCAL_WORKSPACE_ROOT,
};

const permissionOptions = [
  {
    icon: <span data-icon="default" />,
    label: "Default permissions",
    title: "Codex automatically runs commands in a sandbox",
    value: "default",
  },
  {
    icon: <span data-icon="guardian" />,
    label: "Auto-review",
    title: "Codex asks an Auto-reviewer to make sure you can proceed",
    value: "guardian-approvals",
  },
  {
    icon: <span data-icon="full" />,
    label: "Full access",
    title: "Codex can edit any file and use the network without asking",
    value: "full-access",
  },
  {
    icon: <span data-icon="custom" />,
    label: "Custom (config.toml)",
    title: "Codex uses the permission defined in config.toml",
    value: "custom",
  },
] as const;

const noop = () => {};
const noopString = (_value: string) => {};
const noopMode = (_value: "local" | "cloud" | "worktree") => {};
const noopProjectSelection = (_selection: HotkeyWindowProjectSelection) => {};
const noopLocale = async (_locale: LocaleCode) => {};

type HotkeyWindowProjectSelection =
  | { kind: "projectless" }
  | { kind: "local"; workspaceRoot: string }
  | { kind: "remote"; hostId: string; projectId: string; remotePath: string };

function installMinimalBrowserGlobals() {
  const windowStub = {
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
    matchMedia: () => ({
      addEventListener: noop,
      addListener: noop,
      matches: false,
      media: "(prefers-color-scheme: dark)",
      removeEventListener: noop,
      removeListener: noop,
    }),
    location: {
      hash: "",
      href: "http://localhost/hotkey-window",
      origin: "http://localhost",
      pathname: "/hotkey-window",
      search: "",
    },
    localStorage: {
      getItem: () => null,
      setItem: noop,
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
    cancelAnimationFrame: noop,
  };

  defineGlobal("window", windowStub);
  defineGlobal("document", {
    body: {
      removeAttribute: noop,
      setAttribute: noop,
    },
    documentElement: {
      classList: {
        toggle: noop,
      },
      matches: () => false,
      style: {
        setProperty: noop,
      },
    },
    elementsFromPoint: () => [],
    querySelectorAll: () => [],
  });
  defineGlobal("history", {
    replaceState: noop,
    state: {},
  });
  defineGlobal("location", windowStub.location);
  defineGlobal(
    "MutationObserver",
    class {
      disconnect() {}
      observe() {}
    },
  );
  defineGlobal("navigator", {
    language: "en-US",
    platform: "Win32",
    userAgent: "node",
  });
}

function defineGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true,
  });
}
