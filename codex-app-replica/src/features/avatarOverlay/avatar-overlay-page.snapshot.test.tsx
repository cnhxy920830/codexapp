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
import { DEFAULT_AVATAR_OVERLAY_LAYOUT } from "./avatarOverlayLayout";
import type { AvatarOverlayNotification } from "./avatarOverlayNotifications";

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
  collapsedMascotHover: string;
  collapsedNoNotifications: string;
  collapsedWithBadge: string;
  contextMenu: string;
  expandedTray: string;
  expandedTrayExpandedRow: string;
  expandedTrayReplyEditor: string;
  expandedTrayScrollControls: string;
};

function buildSnapshots(): SnapshotMap {
  const avatar = resolveAvatarOption("codex", BUILTIN_AVATARS);
  const notifications: AvatarOverlayNotification[] = [
    {
      id: "local:local:thread-1",
      actionPath: "/local/thread-1",
      body: "Needs approval to continue work on the repo setup",
      canDismiss: true,
      expiresAtMs: 86_400_000,
      hostId: "local",
      isLoading: false,
      level: "warning",
      localConversationId: "thread-1",
      source: "local",
      status: "waiting",
      title: "Repo setup",
      turnKey: "3",
      updatedAtMs: 1_000,
    },
    {
      id: "local:local:thread-2",
      actionPath: "/local/thread-2",
      body: "Running cargo check",
      canDismiss: true,
      expiresAtMs: 180_000,
      hostId: "local",
      isLoading: true,
      level: "info",
      localConversationId: "thread-2",
      source: "local",
      status: "running",
      title: "Rust parity",
      turnKey: "4",
      updatedAtMs: 900,
    },
    {
      id: "cloud:task-7",
      actionPath: "/remote/task-7",
      body: null,
      canDismiss: true,
      expiresAtMs: 604_800_000,
      hostId: null,
      isLoading: false,
      level: "success",
      localConversationId: null,
      source: "cloud",
      status: "review",
      title: "Remote review",
      turnKey: "turn-7",
      updatedAtMs: 950,
    },
    {
      id: "remote-host:devbox:thread-3",
      actionPath: "/local/thread-3",
      body: null,
      canDismiss: true,
      expiresAtMs: 3_600_000,
      hostId: "devbox",
      isLoading: false,
      level: "danger",
      localConversationId: "thread-3",
      source: "remote-host",
      status: "failed",
      title: "Window bridge",
      turnKey: "2",
      updatedAtMs: 800,
    },
  ];
  const longBodyNotifications: AvatarOverlayNotification[] = [
    {
      ...notifications[0],
      body: [
        "Needs approval to continue work on the repo setup.",
        "Approval is still pending for the workspace trust prompt.",
        "Waiting for confirmation before dependency install can proceed.",
      ].join(" "),
    },
    ...notifications.slice(1),
  ];

  return {
    collapsedMascotHover: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={[]}
            topNotification={null}
            isTrayOpen={false}
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
            testState={{
              forceMascotHover: true,
            }}
          />
        </div>
      </StaticI18nProvider>,
    ),
    collapsedNoNotifications: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={[]}
            topNotification={null}
            isTrayOpen={false}
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
          />
        </div>
      </StaticI18nProvider>,
    ),
    collapsedWithBadge: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={notifications}
            topNotification={notifications[0] ?? null}
            isTrayOpen={false}
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
          />
        </div>
      </StaticI18nProvider>,
    ),
    contextMenu: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={notifications}
            topNotification={notifications[0] ?? null}
            isTrayOpen={false}
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
            onCloseContextMenu={noop}
            onClosePet={noop}
            testState={{
              contextMenuPosition: {
                x: 320,
                y: 220,
              },
            }}
          />
        </div>
      </StaticI18nProvider>,
    ),
    expandedTray: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={notifications}
            topNotification={notifications[0] ?? null}
            isTrayOpen
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
          />
        </div>
      </StaticI18nProvider>,
    ),
    expandedTrayExpandedRow: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={longBodyNotifications}
            topNotification={longBodyNotifications[0] ?? null}
            isTrayOpen
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
            onOpenNotificationReply={noopNotification}
            onSubmitNotificationReply={noopReply}
            testState={{
              expandedNotificationIds: ["local:local:thread-1"],
              forceControlsVisible: true,
              forceExpandableNotificationIds: ["local:local:thread-1"],
            }}
          />
        </div>
      </StaticI18nProvider>,
    ),
    expandedTrayReplyEditor: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={notifications}
            topNotification={notifications[0] ?? null}
            isTrayOpen
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
            onOpenNotificationReply={noopNotification}
            onSubmitNotificationReply={noopReply}
            testState={{
              replyOpenNotificationId: "local:local:thread-1",
            }}
          />
        </div>
      </StaticI18nProvider>,
    ),
    expandedTrayScrollControls: renderSnapshot(
      <StaticI18nProvider>
        <div className="h-[600px] w-[420px]">
          <AvatarOverlayView
            layout={DEFAULT_AVATAR_OVERLAY_LAYOUT}
            selectedAvatar={avatar}
            notifications={notifications}
            topNotification={notifications[0] ?? null}
            isTrayOpen
            isDragging={false}
            mascotTransientState={null}
            onOpenTray={noop}
            onCloseTray={noop}
            onOpenNotification={noopNotification}
            onDismissNotification={noopNotification}
            testState={{
              forceTrayScrollState: {
                hasScrollableContent: true,
                hasLatestNotificationsAbove: true,
                hiddenOlderNotificationCount: 3,
              },
            }}
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

function translate(key: MessageKey, values?: MessageValues) {
  return formatMessage(EN_US_MESSAGES[key], values);
}

const noop = () => {};
const noopNotification = (_notification: AvatarOverlayNotification) => {};
const noopReply = async (
  _notification: AvatarOverlayNotification,
  _prompt: string,
) => undefined;
const noopLocale = async (_locale: LocaleCode) => {};
