import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildExternalLinkMenuSpecs,
  buildFileLinkMenuSpecs,
  filterOpenTargets,
  resolvePreferredOpenTarget,
} from "./markdownPreviewLinks";

const translate = (key: string, values?: Record<string, number | string>) => {
  switch (key) {
    case "markdown.externalLink.openInBrowser":
      return "Open in browser";
    case "markdown.externalLink.openInExternalBrowser":
      return "Open in external browser";
    case "markdown.externalLink.copyLink":
      return "Copy link";
    case "markdown.fileReference.openInTarget":
      return `Open in ${values?.target ?? ""}`;
    case "markdown.fileReference.viewInCodexBrowser":
      return "View in browser";
    case "markdown.fileReference.viewFile":
      return "Open file";
    case "markdown.fileReference.openWith":
      return "Open with";
    case "markdown.fileReference.openWithTarget":
      return String(values?.target ?? "");
    case "markdown.fileReference.copyPath":
      return "Copy path";
    case "markdown.fileReference.openInExplorer":
      return "Open in Explorer";
    default:
      return key;
  }
};

const editorTargets = [
  {
    id: "vscode",
    target: "vscode",
    label: "VS Code",
    icon: null,
    kind: "editor",
    hidden: false,
    available: true,
    default: false,
  },
  {
    id: "systemDefault",
    target: "systemDefault",
    label: "Default app",
    icon: null,
    kind: "systemDefault",
    hidden: true,
    available: true,
    default: true,
  },
  {
    id: "fileManager",
    target: "fileManager",
    label: "File Explorer",
    icon: null,
    kind: "fileManager",
    hidden: false,
    available: true,
    default: false,
  },
] as const;

test("filterOpenTargets hides hidden editor targets but keeps native defaults", () => {
  assert.deepEqual(
    filterOpenTargets({
      targets: [...editorTargets],
      availableTargets: ["vscode", "systemDefault", "fileManager"],
    }).map((target) => target.target),
    ["vscode", "fileManager"],
  );

  assert.deepEqual(
    filterOpenTargets({
      targets: [...editorTargets],
      availableTargets: ["vscode", "systemDefault", "fileManager"],
      mode: "native",
    }).map((target) => target.target),
    ["systemDefault", "fileManager"],
  );
});

test("resolvePreferredOpenTarget falls back to the first filtered target", () => {
  assert.equal(
    resolvePreferredOpenTarget({
      preferredTarget: "missing",
      targets: [...editorTargets],
      availableTargets: ["vscode", "systemDefault", "fileManager"],
    })?.target,
    "vscode",
  );
});

test("buildFileLinkMenuSpecs includes open-with, copy, and reveal actions", () => {
  const specs = buildFileLinkMenuSpecs({
    mode: "editor",
    preferredTarget: editorTargets[0],
    revealLabelKey: "markdown.fileReference.openInExplorer",
    revealTargetSupported: true,
    t: translate,
    targets: [editorTargets[0], editorTargets[2]],
  });

  assert.deepEqual(specs, [
    {
      id: "open-primary",
      kind: "action",
      key: "open-primary",
      label: "Open in VS Code",
      target: editorTargets[0],
    },
    {
      id: "open-with",
      kind: "submenu",
      label: "Open with",
      items: [
        {
          id: "open-with:vscode",
          label: "VS Code",
          checked: true,
          target: editorTargets[0],
        },
        {
          id: "open-with:fileManager",
          label: "File Explorer",
          checked: false,
          target: editorTargets[2],
        },
      ],
    },
    {
      id: "open-target-separator",
      kind: "separator",
    },
    {
      id: "copy-path",
      kind: "action",
      key: "copy-path",
      label: "Copy path",
    },
    {
      id: "reveal-path",
      kind: "action",
      key: "reveal-path",
      label: "Open in Explorer",
    },
  ]);
});

test("buildFileLinkMenuSpecs prefers the file-view label for side-panel notebook previews", () => {
  const specs = buildFileLinkMenuSpecs({
    mode: "editor",
    preferSidePanelPrimaryAction: true,
    preferredTarget: editorTargets[0],
    revealLabelKey: "markdown.fileReference.openInExplorer",
    revealTargetSupported: false,
    t: translate,
    targets: [editorTargets[0]],
  });

  assert.deepEqual(specs[0], {
    id: "open-primary",
    kind: "action",
    key: "open-primary",
    label: "Open file",
    target: editorTargets[0],
  });
});

test("buildFileLinkMenuSpecs prefers the browser-view label for local html files without side-panel routing", () => {
  const specs = buildFileLinkMenuSpecs({
    mode: "editor",
    preferBrowserPrimaryAction: true,
    preferredTarget: editorTargets[0],
    revealLabelKey: "markdown.fileReference.openInExplorer",
    revealTargetSupported: false,
    t: translate,
    targets: [editorTargets[0]],
  });

  assert.deepEqual(specs[0], {
    id: "open-primary",
    kind: "action",
    key: "open-primary",
    label: "View in browser",
    target: editorTargets[0],
  });
});

test("buildFileLinkMenuSpecs uses the file-view label for native default-app files", () => {
  const specs = buildFileLinkMenuSpecs({
    mode: "native",
    preferredTarget: editorTargets[1],
    revealLabelKey: "markdown.fileReference.openInExplorer",
    revealTargetSupported: false,
    t: translate,
    targets: [editorTargets[1], editorTargets[2]],
  });

  assert.deepEqual(specs[0], {
    id: "open-primary",
    kind: "action",
    key: "open-primary",
    label: "Open file",
    target: editorTargets[1],
  });
});

test("buildExternalLinkMenuSpecs keeps the internal-browser, external-browser, and copy actions", () => {
  assert.deepEqual(buildExternalLinkMenuSpecs({ t: translate }), [
    {
      id: "open-in-codex-browser",
      kind: "action",
      key: "open-primary",
      label: "Open in browser",
    },
    {
      id: "open-in-external-browser",
      kind: "action",
      key: "open-external-browser",
      label: "Open in external browser",
    },
    {
      id: "external-link-separator",
      kind: "separator",
    },
    {
      id: "copy-link",
      kind: "action",
      key: "copy-link",
      label: "Copy link",
    },
  ]);
});
