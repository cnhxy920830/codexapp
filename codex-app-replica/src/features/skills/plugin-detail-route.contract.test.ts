import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import {
  buildPluginDetailRoutePath,
  parsePluginDetailRoute,
  parsePluginDetailRouteQuery,
  resolvePluginDetailDirectSelection,
} from "./pluginDetailRoute";

const APP_PATH = path.join(process.cwd(), "src/App.tsx");
const INSTALL_HELPERS_PATH = path.join(
  process.cwd(),
  "src/features/skills/pluginInstallHelpers.ts",
);
const INSTALL_MODAL_PATH = path.join(
  process.cwd(),
  "src/features/skills/PluginInstallModal.tsx",
);
const INSTALL_SESSION_PATH = path.join(
  process.cwd(),
  "src/features/skills/pluginInstallSession.ts",
);
const PAGE_PATH = path.join(process.cwd(), "src/features/skills/PluginDetailPage.tsx");
const SKILLS_ROUTE_PATH = path.join(process.cwd(), "src/features/skills/SkillsRoutePage.tsx");
const SKILLS_SETTINGS_PATH = path.join(process.cwd(), "src/components/SkillsSettings.tsx");

test("plugin detail route helpers preserve encoded ids and direct-selection invariants", () => {
  assert.deepEqual(parsePluginDetailRoute("/skills/plugins/gmail"), {
    pluginId: "gmail",
  });
  assert.deepEqual(parsePluginDetailRoute("/skills/plugins/foo%2Fbar?hostId=remote-1#section"), {
    pluginId: "foo/bar",
  });
  assert.equal(parsePluginDetailRoute("/skills/plugins/"), null);
  assert.equal(parsePluginDetailRoute("/skills"), null);

  assert.deepEqual(
    parsePluginDetailRouteQuery("?marketplacePath=C%3A%5Cplugins%5Cmarketplace.json&pluginName=gmail&hostId=remote-1&source=manage"),
    {
      hostId: "remote-1",
      marketplacePath: "C:\\plugins\\marketplace.json",
      pluginName: "gmail",
      remoteMarketplaceName: null,
      source: "manage",
    },
  );
  assert.deepEqual(
    parsePluginDetailRouteQuery("?remoteMarketplaceName=chatgpt-workspace&pluginName=gmail"),
    {
      hostId: null,
      marketplacePath: null,
      pluginName: "gmail",
      remoteMarketplaceName: "chatgpt-workspace",
      source: null,
    },
  );
  assert.equal(parsePluginDetailRouteQuery("?marketplacePath=a&remoteMarketplaceName=b&pluginName=gmail"), null);
  assert.equal(parsePluginDetailRouteQuery("?pluginName=gmail"), null);

  assert.deepEqual(
    resolvePluginDetailDirectSelection({
      requestedPluginId: "plugin-123",
      routeQuery: {
        hostId: null,
        marketplacePath: null,
        pluginName: null,
        remoteMarketplaceName: null,
        source: null,
      },
    }),
    {
      directMarketplacePath: null,
      directPluginName: "plugin-123",
      directRemoteMarketplaceName: "chatgpt-workspace",
    },
  );

  const builtRemotePath = buildPluginDetailRoutePath(
    {
      marketplaceLabel: "ChatGPT Workspace",
      marketplaceName: "chatgpt-workspace",
      marketplacePath: null,
      plugin: {
        authPolicy: "ON_USE",
        availability: "AVAILABLE",
        enabled: false,
        id: "plugin-123",
        installPolicy: "AVAILABLE",
        installed: false,
        interface: null,
        keywords: [],
        name: "gmail",
        shareContext: null,
        source: { type: "remote" },
      },
    },
    {
      hostId: "remote-1",
      source: "manage",
    },
  );
  assert.equal(
    builtRemotePath,
    "/skills/plugins/plugin-123?remoteMarketplaceName=chatgpt-workspace&pluginName=gmail&hostId=remote-1&source=manage",
  );
});

test("App route owner keeps plugin detail as a standalone page route", async () => {
  const appSource = await readFile(APP_PATH, "utf8");
  const skillsRouteSource = await readFile(SKILLS_ROUTE_PATH, "utf8");
  const skillsSettingsSource = await readFile(SKILLS_SETTINGS_PATH, "utf8");

  assert.match(
    appSource,
    /if \(typeof window !== "undefined" && isPluginDetailRoute\(window\.location\.pathname\)\) \{\s*return "plugin-detail";\s*\}/s,
  );
  assert.match(
    appSource,
    /if \(isPluginDetailRoute\(path\)\) \{\s*window\.history\.pushState\(nextState, "", path\);\s*\} else \{\s*window\.history\.replaceState\(nextState, "", path\);\s*\}/s,
  );
  assert.match(
    appSource,
    /if \(isPluginDetailRoute\(path\)\) \{\s*setThreadShellVariant\("default"\);\s*setSkillsRouteState\(null\);\s*if \(state\?\.initialHostId && state\.initialHostId\.trim\(\)\.length > 0\) \{\s*setSelectedSettingsHostId\(state\.initialHostId\);\s*\}\s*setCurrentRoute\("plugin-detail"\);\s*return;\s*\}/s,
  );
  assert.match(
    appSource,
    /const nextPath = `\$\{window\.location\.pathname\}\$\{window\.location\.search\}\$\{window\.location\.hash\}`;[\s\S]*handleNavigateToRoute\(nextPath, window\.history\.state \?\? null\)/s,
  );
  assert.match(
    skillsRouteSource,
    /onOpenPluginDetail\(\s*buildPluginDetailRoutePath\(candidate, \{\s*hostId: resolvedSelectedHostId,\s*\}\),\s*\);/s,
  );
  assert.match(skillsSettingsSource, /onOpenPluginDetail: \(path: string\) => void;/);
  assert.match(skillsSettingsSource, /<SkillsRoutePage[\s\S]*onOpenPluginDetail=\{onOpenPluginDetail\}/s);
});

test("plugin detail page keeps extracted auth gate, polling, back behavior, and copy-link timing", async () => {
  const source = await readFile(PAGE_PATH, "utf8");

  assert.match(source, /const DETAIL_POLL_INTERVAL_MS = 2_000;/);
  assert.match(source, /const DETAIL_POLL_TIMEOUT_MS = 15_000;/);
  assert.match(
    source,
    /if \(authMethod !== "apikey"\) \{\s*return;\s*\}\s*onNavigate\("\/skills", \{\s*initialTab: "skills",\s*pluginDeepLinkAuthBlocked: true,\s*\}\);/s,
  );
  assert.match(
    source,
    /if \(routeTarget\?\.source === "manage"\) \{\s*onNavigate\("\/skills", \{\s*initialHostId: routeTarget\.hostId,\s*initialMode: "manage",\s*initialTab: "plugins",\s*\}\);\s*return;\s*\}/s,
  );
  assert.match(source, /window\.history\.back\(\);/);
  assert.match(
    source,
    /copyTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*setCopySucceeded\(false\);\s*copyTimeoutRef\.current = null;\s*\}, 2_000\);/s,
  );
  assert.match(
    source,
    /listPluginShares\(\{ hostId: routeTarget\.hostId \}\)\.catch\(\(\) => \(\{ data: \[\] \}\)\)/,
  );
  assert.match(source, /<PluginsAppToolsDialog/);
  assert.match(source, /<PluginInstallModal/);
  assert.match(source, /<RemovePluginDialog/);
  assert.match(source, /t\("plugins\.detail\.removeDialog\.description"\)/);
});

test("plugin detail install flow uses shared install session owners and extension-id truth source", async () => {
  const pageSource = await readFile(PAGE_PATH, "utf8");
  const installHelpersSource = await readFile(INSTALL_HELPERS_PATH, "utf8");
  const installModalSource = await readFile(INSTALL_MODAL_PATH, "utf8");
  const installSessionSource = await readFile(INSTALL_SESSION_PATH, "utf8");

  assert.match(pageSource, /openPluginInstallSession\(\{/);
  assert.match(pageSource, /setPluginInstallNeedsApps\(\{/);
  assert.match(pageSource, /closePluginInstallSession\(\)/);
  assert.match(pageSource, /session=\{installSessionSnapshot\.session\}/);
  assert.doesNotMatch(pageSource, /const handleInstall = async \(\) => \{/);

  assert.match(
    installHelpersSource,
    /const CHROME_EXTENSION_ID_RELATIVE_PATH = "scripts\/extension-id\.json";/,
  );
  assert.match(installHelpersSource, /readFileText\(\{/);
  assert.match(
    installHelpersSource,
    /resumeTarget: resumeTarget \?\? \{ kind: "plugin-install" \}/,
  );

  assert.match(installSessionSource, /useSyncExternalStore/);
  assert.match(installSessionSource, /kind: "needsApps"/);
  assert.match(installSessionSource, /status: "waitingForCallback"/);

  assert.match(
    installModalSource,
    /plugins\.installModal\.includes\.browserExtensions/,
  );
  assert.match(installModalSource, /plugins\.install\.disabledByAdmin/);
});
