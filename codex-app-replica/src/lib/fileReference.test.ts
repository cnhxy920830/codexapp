import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeFileUrlPath, looksLikeFileReference, parseFileReference } from "./fileReference";

test("parseFileReference keeps relative file paths and source locations", () => {
  assert.deepEqual(parseFileReference("./docs/notebook.md:12:4"), {
    path: ".\\docs\\notebook.md",
    line: 12,
    column: 4,
  });
});

test("looksLikeFileReference excludes web urls", () => {
  assert.equal(looksLikeFileReference("https://example.com/notebook.md"), false);
  assert.equal(looksLikeFileReference("./docs/notebook.md"), true);
});

test("decodeFileUrlPath decodes Windows file urls", () => {
  assert.equal(
    decodeFileUrlPath("file:///D:/workspace/notes/My%20Notebook.md"),
    "D:/workspace/notes/My Notebook.md",
  );
});
