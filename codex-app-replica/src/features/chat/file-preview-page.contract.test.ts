import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const FILE_PREVIEW_PAGE_PATH = path.join(process.cwd(), "src/features/chat/FilePreviewPage.tsx");
const APP_PATH = path.join(process.cwd(), "src/App.tsx");
const WINDOW_NAVIGATION_PATH = path.join(process.cwd(), "src/services/windowNavigation.ts");
const WINDOW_NAVIGATION_RUST_PATH = path.join(process.cwd(), "src-tauri/src/window_navigation.rs");

test("file preview page keeps the extracted route-state acceptance boundary and owner branches", async () => {
  const source = await readFile(FILE_PREVIEW_PAGE_PATH, "utf8");

  assert.match(source, /if \(state === null\) \{\s*return <div className="h-full" \/>;\s*\}/s);
  assert.match(source, /if \(resolveFilePreviewMimeType\(state\.filePath\) === "application\/pdf"\)/);
  assert.match(source, /{t\("wham\.diff\.binaryFile"\)}/);
  assert.match(source, /isWorkspaceFilePdbPreview\(\{\s*mimeType: null,\s*name: state\.filePath,\s*path: state\.filePath,\s*relativePath: state\.filePath,\s*\}\)/s);
  assert.match(source, /showActionBar=\{false\}/);
  assert.match(source, /wrapperClassName="border-0 shadow-none rounded-none"/);
  assert.match(source, /codeContainerClassName="p-panel overflow-visible"/);
  assert.match(source, /if \(typeof filePath !== "string"\) \{\s*return null;\s*\}/s);
  assert.doesNotMatch(source, /filePath\.trim\(\)\.length === 0/);
});

test("file preview host bridge stays aligned with the page owner route-state contract", async () => {
  const appSource = await readFile(APP_PATH, "utf8");
  const windowNavigationSource = await readFile(WINDOW_NAVIGATION_PATH, "utf8");
  const rustSource = await readFile(WINDOW_NAVIGATION_RUST_PATH, "utf8");

  assert.match(appSource, /takePendingFilePreview\(\)/);
  assert.match(appSource, /window\.history\.replaceState\(pendingFilePreview, "", FILE_PREVIEW_ROUTE_PATH\)/);
  assert.match(appSource, /if \(isFilePreviewRoute\(path\)\) \{/);
  assert.match(appSource, /setCurrentRoute\("file-preview"\)/);
  assert.match(windowNavigationSource, /export type PendingFilePreviewState = \{/);
  assert.match(windowNavigationSource, /export async function showFilePreview\(params: PendingFilePreviewState\)/);
  assert.match(windowNavigationSource, /export async function takePendingFilePreview\(\)/);
  assert.match(rustSource, /const FILE_PREVIEW_ROUTE_PATH: &str = "\/file-preview";/);
  assert.match(rustSource, /#\[tauri::command\(rename = "show-file-preview"\)\]/);
  assert.match(rustSource, /pub fn take_pending_file_preview\(/);
});
