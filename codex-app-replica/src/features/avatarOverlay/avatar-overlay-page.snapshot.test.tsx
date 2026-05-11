/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18N_CONTEXT } from "../../i18n/i18n";
import { MESSAGES, type LocaleCode, type MessageKey, type MessageValues } from "../../i18n/messages";
import {
  BUILTIN_AVATARS,
  resolveAvatarOption,
} from "../../components/appearance/avatarData";
import { AvatarOverlayView } from "./AvatarOverlayView";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/features/avatarOverlay/__snapshots__/avatar-overlay-page.snap.json",
);
const UPDATE_SNAPSHOTS = process.env.AVATAR_OVERLAY_UPDATE_SNAPSHOTS === "1";
const EN_US_MESSAGES = MESSAGES["en-US"];

test("avatar overlay page snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

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
  collapsedNoNotifications: string;
  collapsedWithBadge: string;
  expandedTray: string;
};

function buildSnapshots(): SnapshotMap {
  const avatar = resolveAvatarOption("codex", BUILTIN_AVATARS);

  return {
    collapsedNoNotifications: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            selectedAvatar={avatar}
            notificationCount={0}
            isTrayOpen={false}
            onToggleTray={noop}
            onCollapseTray={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    collapsedWithBadge: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            selectedAvatar={avatar}
            notificationCount={3}
            isTrayOpen={false}
            onToggleTray={noop}
            onCollapseTray={noop}
          />
        </div>
      </StaticI18nProvider>,
    ),
    expandedTray: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            selectedAvatar={avatar}
            notificationCount={0}
            isTrayOpen
            onToggleTray={noop}
            onCollapseTray={noop}
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
    .replace(/url\(\/[^)]+\)/g, "url([asset])")
    .replace(/url\(file:\/\/\/[^)]+\)/g, "url([asset])")
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

const noop = () => {};
const noopLocale = async (_locale: LocaleCode) => {};
