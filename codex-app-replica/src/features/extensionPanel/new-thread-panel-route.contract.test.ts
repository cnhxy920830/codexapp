import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("App explicitly recognizes the extension new-thread panel route", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(source, /const EXTENSION_PANEL_NEW_ROUTE_PATH = "\/extension\/panel\/new";/);
  assert.match(
    source,
    /function isExtensionPanelNewRoute\(path: string\) \{\s*return stripRouteSearchAndHash\(path\) === EXTENSION_PANEL_NEW_ROUTE_PATH;\s*\}/s,
  );
  assert.match(
    source,
    /if \(typeof window !== "undefined" && isExtensionPanelNewRoute\(window\.location\.pathname\)\) \{\s*return "chat";\s*\}/s,
  );
});

test("App redirects the extension new-thread panel route back to home instead of falling into generic chat", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  const routeRedirectBranches = source.match(
    /if \(isExtensionPanelNewRoute\(path\)\) \{\s*if \(typeof window !== "undefined" && window\.location\.pathname !== "\/"\) \{\s*window\.history\.replaceState\(window\.history\.state, "", "\/"\);\s*\}\s*openNewConversation\(\);\s*return;\s*\}/g,
  );
  assert.equal(routeRedirectBranches?.length, 2);

  assert.match(
    source,
    /const shouldRedirectExtensionPanelNewToHome =\s*currentRoute === "chat" &&\s*typeof window !== "undefined" &&\s*isExtensionPanelNewRoute\(window\.location\.pathname\);/s,
  );
  assert.match(
    source,
    /useEffect\(\(\) => \{\s*if \(!shouldRedirectExtensionPanelNewToHome\) \{\s*return;\s*\}\s*if \(window\.location\.pathname !== "\/"\) \{\s*window\.history\.replaceState\(window\.history\.state, "", "\/"\);\s*\}\s*openNewConversation\(\);\s*\}, \[shouldRedirectExtensionPanelNewToHome\]\);/s,
  );
  assert.match(source, /if \(shouldRedirectExtensionPanelNewToHome\) \{\s*return null;\s*\}/s);
});
