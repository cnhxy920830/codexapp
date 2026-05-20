/// <reference types="node" />

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/RemoteConnectionsSettings.tsx",
);
const AUTH_SERVICE_PATH = path.join(
  process.cwd(),
  "src/services/auth.ts",
);
const APP_SOURCE_PATH = path.join(
  process.cwd(),
  "src/App.tsx",
);
const LOCAL_ENVIRONMENTS_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/LocalEnvironmentsSettings.tsx",
);
const MCP_SERVICE_PATH = path.join(
  process.cwd(),
  "src/services/mcp.ts",
);
const ICONS_SOURCE_PATH = path.join(
  process.cwd(),
  "src/components/AppShellIcons.tsx",
);

test("remote connections page keeps extracted section order and key families", () => {
  const source = readSource(SOURCE_PATH);

  const localIndex = source.indexOf("<LocalDeviceSettingsSection");
  const remoteControlIndex = source.indexOf("<RemoteControlClientsSection");
  const deviceConnectionsIndex = source.indexOf("<DeviceConnectionsSection");
  assert.ok(localIndex >= 0);
  assert.ok(remoteControlIndex > localIndex);
  assert.ok(deviceConnectionsIndex > remoteControlIndex);

  assert.match(source, /settings\.remoteConnections\.deviceConnections\.header\.title/);
  assert.match(source, /settings\.remoteConnections\.deviceConnections\.sshSubtitle/);
  assert.match(source, /remoteConnections\.page\.subheading/);
  assert.match(source, /settings\.remoteConnections\.table\.actions\.ariaLabel/);
  assert.match(source, /settings\.remoteConnections\.table\.autoConnect\.ariaLabel/);
  assert.match(source, /REMOTE_CONTROL_CONNECTIONS_SHARED_OBJECT_KEY/);
  assert.match(source, /REMOTE_CONTROL_CONNECTIONS_STATE_SHARED_OBJECT_KEY/);
  assert.match(source, /readSettingsRemoteControlConnectionsSnapshot/);
  assert.match(source, /readSettingsRemoteControlConnectionsStateSnapshot/);
  assert.match(source, /settings\.remoteConnections\.editConnection/);
  assert.match(source, /settings\.remoteControlConnections\.deleteDialog\.title/);
  assert.match(source, /settings\.remoteControlConnections\.deleteDialog\.subtitle/);

  assert.doesNotMatch(source, /settings\.remoteConnections\.accessible\.header\.title/);
  assert.doesNotMatch(source, /settings\.remoteConnections\.autoConnect\.label/);
  assert.doesNotMatch(source, /settings\.remoteConnections\.dialog\.saved/);
  assert.doesNotMatch(source, /settings\.remoteConnections\.dialog\.saveError/);
  assert.doesNotMatch(source, /settings\.remoteConnections\.subtitle/);
  assert.doesNotMatch(source, /settings\.remoteConnections\.delete\.title/);
});

test("remote connections page uses extracted toast families for page actions", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /settings\.remoteConnections\.refresh\.success/);
  assert.match(source, /settings\.remoteConnections\.save\.success/);
  assert.match(source, /settings\.remoteConnections\.save\.error/);
  assert.match(source, /settings\.remoteConnections\.logout\.error/);
  assert.match(source, /settings\.remoteConnections\.connectToggle\.error/);
  assert.match(source, /settings\.remoteControlConnections\.rename\.success/);
  assert.match(source, /settings\.remoteControlConnections\.rename\.error/);
  assert.match(source, /settings\.remoteControlConnections\.delete\.success/);
  assert.match(source, /settings\.remoteControlConnections\.delete\.error/);
  assert.match(source, /settings\.remoteConnections\.details\.copySuccess/);
  assert.match(source, /settings\.remoteConnections\.details\.copyError/);
});

test("device connections actions stay in the extracted header and merged SSH plus signed-in-device order", () => {
  const source = readSource(SOURCE_PATH);
  const appSource = readSource(APP_SOURCE_PATH);
  const localEnvironmentsSource = readSource(LOCAL_ENVIRONMENTS_SOURCE_PATH);

  assert.match(source, /<RefreshIcon className="h-4 w-4" \/>/);
  assert.match(source, /onClick=\{onNavigateToCreateRemoteProject\}/);
  assert.match(source, /const hasConnectedConnection = connections\.some/);
  assert.match(source, /return \[\.\.\.sortedSshConnections, \.\.\.sortedRemoteControlConnections\]/);
  assert.match(source, /sortRemoteControlConnections\(remoteControlConnections\)/);
  assert.match(source, /if \(isRemoteControlConnection\(connection\)\)/);
  assert.match(source, /await Promise\.all\(\[\s*refreshRemoteConnections\(\),\s*refreshRemoteControlConnections\(\),\s*\]\)/s);
  assert.match(source, /window\.setInterval\(\(\) => \{\s*void refreshAllConnections\(\)\.catch\(/s);
  assert.match(appSource, /onNavigateToCreateRemoteProject=\{\(\) => \{/);
  assert.doesNotMatch(appSource, /initialHostId: hostId/);
  assert.match(localEnvironmentsSource, /if \(!isRemoteHost\) \{/);
  assert.match(localEnvironmentsSource, /const fallbackConnectedHostId = connectedRemoteConnections\[0\]\?\.hostId;/);
  assert.match(localEnvironmentsSource, /onSelectHostId\?\.\(fallbackConnectedHostId\)/);

  const menuIndex = source.indexOf("<ConnectionActionsMenu");
  const toggleIndex = source.indexOf("<ToggleSwitch", menuIndex);
  assert.ok(menuIndex >= 0);
  assert.ok(toggleIndex > menuIndex);

  assert.doesNotMatch(source, /onCreateRemoteProject/);
  assert.doesNotMatch(source, /icon=\{<RemoteHostIcon/);
});

test("SSH row menu and details dialog stay aligned with extracted actions and detail rows", () => {
  const source = readSource(SOURCE_PATH);
  const mcpSource = readSource(MCP_SERVICE_PATH);
  const iconsSource = readSource(ICONS_SOURCE_PATH);

  assert.match(source, /connectionError\?\.code === "login-required"/);
  assert.match(source, /connectionError\?\.code === "update-required"/);
  assert.match(source, /connectionError\?\.code === "restart-required"/);
  assert.match(source, /resolvedResponse\.state === "connected"/);
  assert.match(source, /detailsLabel=\{t\("settings\.remoteConnections\.detailsMenu"\)\}/);
  assert.match(source, /editLabel=\{t\("settings\.remoteConnections\.editConnection"\)\}/);
  assert.match(source, /restartLabel=\{t\("settings\.remoteConnections\.restartConnection"\)\}/);
  assert.match(source, /label=\{t\("settings\.remoteConnections\.logout"\)\}/);
  assert.match(source, /deleteLabel=\{t\("settings\.remoteConnections\.deleteConnection"\)\}/);

  assert.match(source, /settings\.remoteConnections\.details\.alias/);
  assert.match(source, /settings\.remoteConnections\.details\.host/);
  assert.match(source, /settings\.remoteConnections\.details\.port/);
  assert.match(source, /settings\.remoteConnections\.details\.identity/);
  assert.match(source, /settings\.remoteConnections\.details\.version/);
  assert.match(source, /row\.copyValue == null/);
  assert.match(source, /navigator\.clipboard\?\.writeText/);

  assert.match(mcpSource, /killCodexProcess: true/);
  assert.match(iconsSource, /export function LogoutIcon/);
});

test("signed-in device rows keep extracted rename delete detail and availability contracts", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /settings\.remoteControlConnections\.rename\.inputLabel/);
  assert.match(source, /settings\.remoteControlConnections\.rename\.save/);
  assert.match(source, /settings\.remoteControlConnections\.rename\.cancel/);
  assert.match(source, /settings\.remoteControlConnections\.rename/);
  assert.match(source, /settings\.remoteControlConnections\.delete\.offlineOnly/);
  assert.match(source, /settings\.remoteControlConnections\.table\.connect\.ariaLabel/);
  assert.match(source, /settings\.remoteControlConnections\.details\.host/);
  assert.match(source, /settings\.remoteControlConnections\.details\.platform/);
  assert.match(source, /settings\.remoteControlConnections\.details\.version/);
  assert.match(source, /settings\.remoteControlConnections\.details\.lastSeen/);
  assert.match(source, /value: formatRelativeDateTime\(connection\.lastSeenAt\)/);
  assert.match(source, /function RelativeDateTimeValue/);
  assert.match(source, /settings\.remoteControlConnections\.availability\.online/);
  assert.match(source, /settings\.remoteControlConnections\.availability\.busy/);
  assert.match(source, /settings\.remoteControlConnections\.availability\.offline/);
  assert.match(source, /settings\.remoteControlConnections\.availability\.updateRequired/);
  assert.match(source, /settings\.remoteConnections\.deviceConnections\.signedInDeviceOnlineSubtitle/);
  assert.match(source, /settings\.remoteConnections\.deviceConnections\.signedInDeviceOfflineSubtitle/);
  assert.match(source, /settings\.remoteConnections\.deviceConnections\.signedInDeviceUpdateRequiredSubtitle/);
  assert.match(source, /threadPage\.remoteConnectionStatusBadge\.disconnected/);
  assert.match(source, /connection\.online\s*\?\s*t\("settings\.remoteControlConnections\.delete\.offlineOnly"\)/);
  assert.match(source, /disabled=\{!canConnect \|\| pendingAutoConnectHostId === connection\.hostId\}/);
  assert.match(source, /className=\{canConnect \? undefined : "text-token-text-secondary opacity-60"\}/);
});

test("device connections auth-required row stays source-backed without guessed authorize CTA wiring", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /remoteControlConnectionsState\.authRequired/);
  assert.match(source, /settings\.remoteControlConnections\.authRequired/);
  assert.doesNotMatch(source, /settings\.remoteControlConnections\.authorize/);
});

test("local device remote control toggle follows the extracted setup dialog flow", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /<SetupDialog/);
  assert.match(source, /getGlobalState\("has-completed-codex-mobile-setup"\)/);
  assert.match(source, /readRemoteControlMfaRequiredButDisabled\(\)/);
  assert.match(source, /setSetupStep\(response\.mfaRequiredButDisabled \? "mfa-required" : "allow-host"\)/);
  assert.match(source, /const hasConnectedClients = await hasConnectedRemoteControlClients\(\)/);
  assert.match(source, /setGlobalState\("has-completed-codex-mobile-setup", true\)/);
  assert.match(source, /setGlobalState\("has-seen-codex-mobile-home-announcement", true\)/);
  assert.match(source, /onSkip=\{closeSetupDialog\}/);
  assert.match(source, /if \(!open\) \{\s*closeSetupDialog\(\);/s);
});

test("SSH dialog keeps extracted add vs edit shell size and alias visibility", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /const dialogWidthClassName =\s*mode === "add" \? "max-w-\[520px\]" : "max-w-\[460px\]";/);
  assert.match(source, /const isAliasTarget = mode === "edit" && draft\.targetKind === "alias";/);
  assert.match(source, /disabled=\{isSaving \|\| isAliasTarget\}/);
  assert.match(source, /placeholder=\{\s*isAliasTarget\s*\? undefined\s*:\s*t\("settings\.remoteConnections\.dialog\.field\.sshHost\.placeholder"\)/s);
  assert.match(source, /!\s*isAliasTarget \? \(/);
});

test("remote host ChatGPT login waits for completion and supports abort cancellation", () => {
  const source = readSource(SOURCE_PATH);
  const authServiceSource = readSource(AUTH_SERVICE_PATH);

  assert.match(source, /loginChatGptWithCompletion/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /const completion = await result\.completion/);
  assert.match(source, /if \(!completion\.success\)/);

  assert.match(authServiceSource, /remote-chatgpt-login-completed/);
  assert.match(authServiceSource, /cancelLogin\(start\.loginId, normalizedHostId\)/);
});

test("remote control clients section keeps extracted compact relative-time last-seen rendering", () => {
  const source = readSource(SOURCE_PATH);

  assert.match(source, /function RemoteControlClientLastSeen/);
  assert.match(source, /settings\.remoteConnections\.remoteControlClients\.lastSeen/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactMinutesAgo/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactHoursAgo/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactDaysAgo/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactWeeksAgo/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactMonthsAgo/);
  assert.match(source, /wham\.formattedRelativeDateTime\.compactYearsAgo/);
  assert.doesNotMatch(source, /formatAbsoluteDateTime\(client\.last_seen_at\)/);
});

function readSource(filePath: string) {
  return readFileSync(filePath, "utf8");
}
