import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveNotebookWorkspaceFileLinkTarget } from "./notebookFileLinks";

test("resolveNotebookWorkspaceFileLinkTarget resolves relative notebook links inside the workspace", () => {
  assert.deepEqual(
    resolveNotebookWorkspaceFileLinkTarget({
      fileReference: {
        column: null,
        line: 8,
        path: "./notes/overview.md",
      },
      hostId: "local",
      notebookCwd: "D:\\workspace\\notebooks",
      workspaceRoot: "D:\\workspace",
    }),
    {
      hostId: "local",
      name: "overview.md",
      path: "D:\\workspace\\notebooks\\notes\\overview.md",
      relativePath: "notebooks/notes/overview.md",
      workspaceRoot: "D:\\workspace",
    },
  );
});

test("resolveNotebookWorkspaceFileLinkTarget normalizes parent-directory hops", () => {
  assert.deepEqual(
    resolveNotebookWorkspaceFileLinkTarget({
      fileReference: {
        column: null,
        line: null,
        path: "../shared/results.csv",
      },
      notebookCwd: "D:\\workspace\\notebooks\\daily",
      workspaceRoot: "D:\\workspace",
    }),
    {
      hostId: null,
      name: "results.csv",
      path: "D:\\workspace\\notebooks\\shared\\results.csv",
      relativePath: "notebooks/shared/results.csv",
      workspaceRoot: "D:\\workspace",
    },
  );
});

test("resolveNotebookWorkspaceFileLinkTarget keeps absolute file urls inside the workspace", () => {
  assert.deepEqual(
    resolveNotebookWorkspaceFileLinkTarget({
      fileReference: {
        column: null,
        line: null,
        path: "D:\\workspace\\docs\\guide.md",
      },
      notebookCwd: "D:\\workspace\\notebooks",
      workspaceRoot: "D:\\workspace",
    }),
    {
      hostId: null,
      name: "guide.md",
      path: "D:\\workspace\\docs\\guide.md",
      relativePath: "docs/guide.md",
      workspaceRoot: "D:\\workspace",
    },
  );
});

test("resolveNotebookWorkspaceFileLinkTarget rejects links outside the current workspace", () => {
  assert.equal(
    resolveNotebookWorkspaceFileLinkTarget({
      fileReference: {
        column: null,
        line: null,
        path: "..\\..\\outside\\secret.md",
      },
      notebookCwd: "D:\\workspace\\notebooks",
      workspaceRoot: "D:\\workspace",
    }),
    null,
  );
});
