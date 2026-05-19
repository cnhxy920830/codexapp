import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const SCRATCHPAD_PAGE_PATH = path.join(process.cwd(), "src/features/scratchpad/ScratchpadPage.tsx");
const APP_PATH = path.join(process.cwd(), "src/App.tsx");
const TOOLTIP_PATH = path.join(process.cwd(), "src/components/Tooltip.tsx");

test("scratchpad page owns its registered header content", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");
  const appSource = await readFile(APP_PATH, "utf8");

  assert.match(scratchpadSource, /onRegisterHeaderContent\?\.\(headerContent\)/);
  assert.match(scratchpadSource, /onRegisterHeaderContent\?\.\(null\)/);
  assert.match(appSource, /pageHeaderContent/);
  assert.match(appSource, /onRegisterHeaderContent=\{\(content\) => \{\s*setPageHeaderContent\(content\);?\s*\}\}/s);
});

test("scratchpad submitted row text uses the shared tooltip owner instead of title attributes", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");
  const tooltipSource = await readFile(TOOLTIP_PATH, "utf8");

  assert.match(scratchpadSource, /import\s+\{\s*Tooltip\s*\}\s+from\s+"..\/..\/components\/Tooltip"/);
  assert.match(scratchpadSource, /<Tooltip align="start" disabled=\{!isTruncated\} side="top" tooltipContent=\{text\}>/);
  assert.doesNotMatch(scratchpadSource, /function ScratchpadTooltip/);
  assert.doesNotMatch(scratchpadSource, /\stitle=\{/);
  assert.match(tooltipSource, /export function Tooltip/);
  assert.match(tooltipSource, /tooltipContent: ReactNode/);
});

test("scratchpad null summaries stay on the extracted error path", async () => {
  const scratchpadSource = await readFile(SCRATCHPAD_PAGE_PATH, "utf8");

  assert.match(scratchpadSource, /const nextSummary = response\.summary;/);
  assert.match(
    scratchpadSource,
    /\[row\.id\]:\s*nextSummary == null\s*\?\s*\{\s*status: "error",\s*message: finalAssistantMessage,\s*summary: null,\s*\}\s*:\s*\{\s*status: "ready",\s*message: finalAssistantMessage,\s*summary: nextSummary,\s*\}/s,
  );
});
