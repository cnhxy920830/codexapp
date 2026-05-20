/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROUTE_PAGE_PATH = path.join(
  process.cwd(),
  "src/features/pullRequests/PullRequestsRoutePage.tsx",
);

test("pull requests route page uses host-aware repo metadata sources", () => {
  const source = readFileSync(ROUTE_PAGE_PATH, "utf8");

  assert.match(source, /readSettingsRemoteProjectsSnapshot/);
  assert.match(source, /readSettingsRemoteConnectionsSnapshot/);
  assert.match(source, /readConnectedSettingsRemoteConnections/);
  assert.match(source, /buildPullRequestProjectGroups/);
  assert.match(source, /getPullRequestGitOriginRequests/);
  assert.match(source, /readGitOrigins\(\{\s*dirs: request\.dirs,\s*hostId: request\.hostId,/s);
  assert.match(source, /REMOTE_CONNECTIONS_SHARED_OBJECT_KEY/);
  assert.match(source, /REMOTE_PROJECTS_SHARED_OBJECT_KEY/);
  assert.match(source, /onRemoteAppServerConnectionStateChanged/);
  assert.match(source, /onWorkspaceRootOptionsUpdated/);
});
