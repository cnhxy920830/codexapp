/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  MESSAGES,
  type MessageKey,
  type MessageValues,
} from "../../../i18n/messages";
import type { ExternalAgentImportItem } from "../../../services/externalAgentImport";
import {
  buildExternalAgentImportModel,
  createDefaultExternalAgentImportSelection,
} from "./importModel";
import {
  ExternalAgentImportCustomizeDialog,
  ExternalAgentImportItemsStep,
  ExternalAgentImportProviderStep,
  IntentSelectionStep,
  RoleSelectionStep,
  SimpleWelcomeCard,
  WelcomeShell,
  WorkModeSelectionStep,
} from "./steps";
import type {
  ExternalAgentProviderId,
  WelcomeImportSelection,
  WelcomeImportSummary,
  WelcomeIntentId,
  WelcomeRoleId,
  WelcomeWorkMode,
} from "./types";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/onboarding/welcome/__snapshots__/welcome-ui.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.WELCOME_UI_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("welcome UI snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.deepEqual(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  simpleWelcomeCard: string;
  intentSelectionStep: string;
  workModeSelectionStep: string;
  roleSelectionStep: string;
  externalAgentImportProviderStep: string;
  externalAgentImportItemsStep: string;
  externalAgentImportCustomizeDialog: string;
  externalAgentImportTitles: string[];
};

function buildSnapshots(): SnapshotMap {
  const model = buildExternalAgentImportModel(DETECTED_ITEMS, ["claude-code", "claude-cowork"], t);
  if (model == null) {
    throw new Error("expected import model");
  }
  const summary = model.summary;
  if (summary == null) {
    throw new Error("expected import summary");
  }
  const selection = createWelcomeImportSelection(summary);
  const dialogSelection = createWelcomeImportSelection(summary);

  if (summary.customizeItems.length > 0) {
    selection[summary.customizeItems[0].id] = false;
    dialogSelection[summary.customizeItems[0].id] = true;
  }
  if (summary.customizeItems.length > 1) {
    dialogSelection[summary.customizeItems[1].id] = false;
  }
  if (summary.chatChoiceKey != null) {
    selection[summary.chatChoiceKey] = false;
  }

  return {
    simpleWelcomeCard: renderSnapshot(
      <WelcomeShell>
        <SimpleWelcomeCard onContinue={noop} t={t} />
      </WelcomeShell>,
    ),
    intentSelectionStep: renderSnapshot(
      <WelcomeShell>
        <IntentSelectionStep
          onContinue={noop}
          onPersonalizedSuggestionsChange={noopBool}
          onSkip={noop}
          onToggleIntent={noopIntent}
          personalizedSuggestionsEnabled={false}
          selectedIntents={["build_software", "analyze_data"]}
          t={t}
        />
      </WelcomeShell>,
    ),
    workModeSelectionStep: renderSnapshot(
      <WelcomeShell>
        <WorkModeSelectionStep
          isContinueDisabled={false}
          onChooseWorkMode={noopWorkMode}
          onContinue={noop}
          selectedWorkMode="non_coding"
          t={t}
        />
      </WelcomeShell>,
    ),
    roleSelectionStep: renderSnapshot(
      <WelcomeShell>
        <RoleSelectionStep
          isContinueDisabled={false}
          onContinue={noop}
          onPersonalizedSuggestionsChange={noopBool}
          onSkip={noop}
          onToggleRole={noopRole}
          personalizedSuggestionsEnabled={true}
          selectedRoles={["engineering", "design"]}
          t={t}
        />
      </WelcomeShell>,
    ),
    externalAgentImportProviderStep: renderSnapshot(
      <WelcomeShell>
        <ExternalAgentImportProviderStep
          onContinue={noop}
          onSkip={noop}
          onToggleProvider={noopProvider}
          providerIds={["claude-code", "claude-cowork"]}
          selectedProviders={["claude-code"]}
          t={t}
        />
      </WelcomeShell>,
    ),
    externalAgentImportItemsStep: renderSnapshot(
      <WelcomeShell>
        <ExternalAgentImportItemsStep
          errorMessage={null}
          isContinueDisabled={false}
          isPending={false}
          onContinue={noop}
          onOpenCustomize={noop}
          onSkip={noop}
          onToggleChats={noop}
          onToggleGroup={noopGroup}
          selection={selection}
          summary={summary}
          t={t}
        />
      </WelcomeShell>,
    ),
    externalAgentImportCustomizeDialog: renderSnapshot(
      <ExternalAgentImportCustomizeDialog
        items={summary.customizeItems}
        onClose={noop}
        onConfirm={noopSelection}
        selectedItemIds={dialogSelection}
        t={t}
      />,
    ),
    externalAgentImportTitles: summary.customizeItems.map((item) => item.title),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(renderToStaticMarkup(element));
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/<link rel="preload" as="image" href="[^"]*codex-app-ga-logo--UgmJjKM\.png"\/>/g, "")
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/style="[^"]*"/g, 'style="[style]"')
    .replace(/src="[^"]*codex-app-ga-logo--UgmJjKM\.png"/g, 'src="[asset]"')
    .replace(/src="data:[^"]*"/g, 'src="[data]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function createWelcomeImportSelection(summary: WelcomeImportSummary) {
  return createDefaultExternalAgentImportSelection(summary);
}

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  const formattedPluralTemplate = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, token, oneVariant, otherVariant) => {
      const rawValue = values[token];
      const numericValue =
        typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const variant = numericValue === 1 ? oneVariant : otherVariant;
      return variant.replaceAll("#", String(numericValue));
    },
  );

  return formattedPluralTemplate.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

function t(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

const noop = () => {};
const noopBool = (_checked: boolean) => {};
const noopIntent = (_intent: WelcomeIntentId) => {};
const noopRole = (_role: WelcomeRoleId) => {};
const noopWorkMode = (_workMode: WelcomeWorkMode) => {};
const noopProvider = (_providerId: ExternalAgentProviderId) => {};
const noopGroup = (_group: "toolsAndSetup" | "projects") => {};
const noopSelection = (_selection: WelcomeImportSelection) => {};

const DETECTED_ITEMS: ExternalAgentImportItem[] = [
  {
    itemType: "CONFIG",
    description: "Migrate settings from ~/.claude to Codex",
    cwd: null,
    details: null,
    providerId: "claude-code",
  },
  {
    itemType: "CONFIG",
    description: "Migrate settings from ~/.codex to Codex",
    cwd: null,
    details: null,
    providerId: "claude-cowork",
  },
  {
    itemType: "PLUGINS",
    description: "Migrate plugins from ~/.codex to Codex",
    cwd: null,
    details: {
      commands: [],
      hooks: [],
      mcpServers: [],
      plugins: [{ marketplaceName: "Claude", pluginNames: ["alpha", "beta"] }],
      sessions: [],
      subagents: [],
    },
    providerId: "claude-cowork",
  },
  {
    itemType: "SKILLS",
    description: "Migrate skills from /workspace/app to Codex",
    cwd: "/workspace/app",
    details: null,
    providerId: "claude-code",
  },
  {
    itemType: "SESSIONS",
    description: "Migrate sessions from ~/.claude to Codex",
    cwd: null,
    details: {
      commands: [],
      hooks: [],
      mcpServers: [],
      plugins: [],
      sessions: [
        {
          cwd: "/Users/alex/project",
          path: "/Users/alex/.claude/chats/session.md",
          title: "Morning sync",
        },
      ],
      subagents: [],
    },
    providerId: "claude-code",
  },
];
