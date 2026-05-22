import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("WelcomeShell keeps the extracted full-bleed onboarding layout", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/shared.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /className="fixed inset-0 flex items-center justify-center overflow-hidden bg-\[var\(--app-shell-main-surface\)\] text-\[var\(--app-shell-text\)\]"/,
  );
  assert.doesNotMatch(source, /px-6 pb-8/);
  assert.doesNotMatch(source, /overflow-auto/);
});

test("InlineTooltip uses the extracted top-positioned tooltip contract", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/shared.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /<Tooltip\s+delayDuration=\{0\}\s+side="top"\s+sideOffset=\{6\}/s,
  );
  assert.match(
    source,
    /variant === "intent"\s*\?\s*"!border-transparent !bg-black px-1\.5 py-1\.5 text-center !text-white text-sm leading-4 shadow-lg"\s*:\s*"!border-transparent !bg-black px-1\.5 py-1\.5 text-center text-xs leading-4 font-medium !text-white shadow-lg"/s,
  );
});

test("WelcomeFlow refreshes and invalidates ambient suggestions after completion", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/WelcomeFlow.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /await refreshAmbientSuggestions\(\{\s*hostId: null,\s*projectRoot: "~",\s*\}\);\s*await Promise\.all\(\[\s*emitQueryCacheInvalidated\(\["ambient-suggestions"\]\),\s*emitQueryCacheInvalidated\(\["ambient-suggestions-refresh"\]\),\s*\]\);/s,
  );
});

test("external import items step keeps only the extracted aria label instead of a visible list heading", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/importSteps.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /aria-label=\{t\("onboarding\.welcomeV2\.externalAgentImport\.items\.list"\)\}/,
  );
  assert.doesNotMatch(
    source,
    /<div className="mb-2 text-xs leading-4 font-medium text-\[var\(--app-shell-subtle\)\]">\s*\{t\("onboarding\.welcomeV2\.externalAgentImport\.items\.list"\)\}/s,
  );
});

test("WelcomeFlow starts external import in the background and completes onboarding immediately", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/WelcomeFlow.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /void runExternalAgentOnboardingImportStatus\(\(\)\s*=>\s*importExternalAgentItems\(\{\s*items: selectedImportItems,\s*\}\),\s*\);\s*await completeWelcomeFlow\(selection\);/s,
  );
  assert.doesNotMatch(
    source,
    /await importExternalAgentItems\(\{\s*items: selectedImportItems,\s*\}\);\s*await completeWelcomeFlow\(selection\);/s,
  );
});

test("WelcomeFlow completion failure resets pending state without rethrowing", async () => {
  const source = await readFile(
    path.join(process.cwd(), "src/features/onboarding/welcome/WelcomeFlow.tsx"),
    "utf8",
  );

  assert.match(
    source,
    /catch\s*\{\s*setIsCompleting\(false\);\s*\}/s,
  );
  assert.doesNotMatch(
    source,
    /catch\s*\(\s*error\s*\)\s*\{\s*setIsCompleting\(false\);\s*throw/s,
  );
});
