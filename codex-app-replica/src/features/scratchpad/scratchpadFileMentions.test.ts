import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPromptLink } from "../../lib/promptLinks";
import {
  buildScratchpadFileMentionCandidate,
  buildScratchpadFilePromptLink,
  dedupeScratchpadFileMentionCandidates,
} from "./scratchpadFileMentions";

test("buildScratchpadFilePromptLink uses file-reference markdown text", () => {
  const link = buildScratchpadFilePromptLink({
    absolutePath: "D:\\workspace\\src\\main.ts",
    label: "src/main.ts",
  });

  assert.equal(link, "[src/main.ts](D:/workspace/src/main.ts)");

  const segment = classifyPromptLink({
    raw: link,
    label: "src/main.ts",
    href: "D:/workspace/src/main.ts",
  });

  assert.equal(segment.type, "file");
  assert.equal(segment.path, "D:\\workspace\\src\\main.ts");
  assert.equal(segment.label, "src/main.ts");
});

test("buildScratchpadFileMentionCandidate prefers relative path label", () => {
  const candidate = buildScratchpadFileMentionCandidate({
    workspaceRoot: "D:\\workspace",
    result: {
      name: "main.ts",
      path: "D:\\workspace\\src\\main.ts",
      relativePath: "src/main.ts",
    },
  });

  assert.deepEqual(candidate, {
    id: "file:d:\\workspace\\src\\main.ts",
    kind: "file",
    label: "src/main.ts",
    displayLabel: "src/main.ts",
    insertText: "[src/main.ts](D:/workspace/src/main.ts)",
    detail: "D:\\workspace",
    absolutePath: "D:\\workspace\\src\\main.ts",
  });
});

test("dedupeScratchpadFileMentionCandidates keeps first candidate per file path", () => {
  const deduped = dedupeScratchpadFileMentionCandidates([
    {
      id: "file:d:\\workspace\\src\\main.ts",
      kind: "file",
      label: "src/main.ts",
      displayLabel: "src/main.ts",
      insertText: "[src/main.ts](D:/workspace/src/main.ts)",
      detail: "D:\\workspace",
      absolutePath: "D:\\workspace\\src\\main.ts",
    },
    {
      id: "file:d:\\workspace\\src\\main.ts",
      kind: "file",
      label: "main.ts",
      displayLabel: "main.ts",
      insertText: "[main.ts](D:/workspace/src/main.ts)",
      detail: "D:\\workspace",
      absolutePath: "D:\\workspace\\src\\main.ts",
    },
  ]);

  assert.deepEqual(deduped, [
    {
      id: "file:d:\\workspace\\src\\main.ts",
      kind: "file",
      label: "src/main.ts",
      displayLabel: "src/main.ts",
      insertText: "[src/main.ts](D:/workspace/src/main.ts)",
      detail: "D:\\workspace",
      absolutePath: "D:\\workspace\\src\\main.ts",
    },
  ]);
});
