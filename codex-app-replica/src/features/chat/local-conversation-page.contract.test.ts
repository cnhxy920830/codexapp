import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

test("App local thread route keeps the extracted loading-and-home-fallback owner", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /const isDefaultLocalThreadPage =\s*currentRoute === "chat" &&\s*currentThreadShellRoute\?\.shell === "default" &&\s*currentThreadShellRoute\.kind === "local";/s,
  );
  assert.match(
    source,
    /const shouldShowLocalThreadRouteLoading =\s*isDefaultLocalThreadPage && currentPageConversation === null;/s,
  );
  assert.match(
    source,
    /if \(\s*!isDefaultLocalThreadPage \|\|\s*isThreadConversationLoading \|\|\s*currentPageConversation !== null \|\|\s*!defaultLocalThreadRouteResolvedRef\.current\s*\) \{\s*return;\s*\}\s*\n\s*void handleNavigateToRoute\("\/", \{\s*focusComposerNonce: Date\.now\(\),\s*prefillCwd: defaultLocalThreadRouteLastCwdRef\.current,\s*\}\);/s,
  );
  assert.match(
    source,
    /shouldShowChatRouteHeader =\s*!\(isDefaultLocalThreadPage && currentPageConversation === null\);/s,
  );
  assert.match(
    source,
    /shouldShowLocalThreadRouteLoading \? \(\s*<div className="relative min-h-0 flex-1">\s*<LoadingPage fillParent debugName="LocalConversationPage" \/>\s*<\/div>\s*\) : isThreadConversationLoading \?/s,
  );
});

test("App local thread page opens selected thread in a new window with the conversation host", async () => {
  const source = await readFile(path.join(process.cwd(), "src/App.tsx"), "utf8");

  assert.match(
    source,
    /const openSelectedThreadInNewWindow = async \(\) => \{\s*if \(!selectedThreadId\) \{\s*return;\s*\}[\s\S]*?await openInNewWindow\(\{\s*hostId: currentPageConversation\?\.hostId \?\? LOCAL_SETTINGS_HOST_ID,\s*path,\s*\}\);/s,
  );
});
