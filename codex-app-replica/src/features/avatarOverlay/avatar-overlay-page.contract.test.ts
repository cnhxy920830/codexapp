import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("avatar overlay page aggregates local and connected remote recent threads", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/avatarOverlay/AvatarOverlayPage.tsx"),
    "utf8",
  );

  assert.match(source, /getRecentThreadsForHost/);
  assert.match(source, /readConnectedSettingsRemoteConnections/);
  assert.match(source, /readSettingsRemoteConnectionsSnapshot/);
  assert.match(source, /onRemoteAppServerConnectionStateChanged/);
  assert.match(source, /onSharedObjectUpdated/);
  assert.match(source, /Promise\.all\(\[\s*getRecentThreads\(\),\s*\.\.\.remoteHostIds\.map/);
  assert.match(source, /thread\.hostId == null \|\| thread\.hostId === "local"/);
  assert.match(source, /readThreadForHost\(\{\s*threadId: thread\.id,\s*hostId: thread\.hostId,/s);
});

test("avatar overlay page opens remote-host local conversations on the remote route", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/avatarOverlay/AvatarOverlayPage.tsx"),
    "utf8",
  );

  assert.match(source, /notification\.hostId != null/);
  assert.match(source, /notification\.hostId !== LOCAL_HOST_ID/);
  assert.match(source, /openInMainWindow\(`\/remote\/\$\{encodeURIComponent\(notification\.localConversationId\)\}`\)/);
});
