/// <reference types="node" />

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../i18n/i18n";
import { MarkdownPreview } from "./MarkdownPreview";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src/components/__snapshots__/markdown-preview.snap.json",
);
const UPDATE_SNAPSHOTS =
  process.env.MARKDOWN_PREVIEW_UPDATE_SNAPSHOTS === "1";

test("markdown preview snapshots", async (t) => {
  const actualSnapshots = buildSnapshots();

  if (UPDATE_SNAPSHOTS) {
    await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
    await writeFile(SNAPSHOT_PATH, `${JSON.stringify(actualSnapshots, null, 2)}\n`);
    return;
  }

  const expectedSnapshots = JSON.parse(
    await readFile(SNAPSHOT_PATH, "utf8"),
  ) as SnapshotMap;

  for (const [name, actual] of Object.entries(actualSnapshots)) {
    await t.test(name, () => {
      assert.equal(actual, expectedSnapshots[name as keyof SnapshotMap]);
    });
  }
});

type SnapshotMap = {
  appShellRichMarkdown: string;
  notebookBasicHtml: string;
  notebookDetailsBlocks: string;
  notebookFileLinks: string;
  notebookMathBlocks: string;
  notebookMermaidBlocks: string;
  notebookMentionLinks: string;
  notebookMediaBlocks: string;
};

function buildSnapshots(): SnapshotMap {
  return {
    appShellRichMarkdown: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          text={[
            "## Shared Markdown",
            "",
            "Paragraph with **bold**, *italic*, ~~done~~, `code`, and [link](https://example.com).",
            "",
            "- [x] shipped",
            "- [ ] next step",
            "",
            "| Name | Value |",
            "| --- | --- |",
            "| alpha | 1 |",
            "",
            "![Diagram](https://example.com/diagram.png)",
            "",
            "```ts",
            "console.log('hi');",
            "```",
          ].join("\n")}
          variant="appShell"
        />
      </div>,
    ),
    notebookBasicHtml: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          allowBasicHtml
          text={[
            "Run `summary()` and inspect the <strong>output</strong>.<br/>Then mark it <del>done</del>.",
            "",
            "<table><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody><tr><td>alpha</td><td>ready</td></tr></tbody></table>",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookDetailsBlocks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          allowBasicHtml
          cwd="D:\\workspace\\notebooks"
          hostId="host-local"
          text={[
            ':::github-details{summary="Expanded section" open="true"}',
            "Inspect [summary.ipynb](./summary.ipynb:8) before rerunning the cell.",
            "",
            "- [x] keep parity",
            ":::",
            "",
            "<details>",
            "<summary>HTML fallback</summary>",
            "Collapsed notes still share the same owner shell.",
            "</details>",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookFileLinks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          cwd="D:\\workspace\\notebooks"
          hostId="host-local"
          text={[
            "Inspect [summary.ipynb](./summary.ipynb:8) before opening [the hosted docs](www.example.com).",
            "",
            "Use [absolute note](file:///D:/workspace/notebooks/notes/overview.md) when the file is outside cwd.",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookMathBlocks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          text={[
            "Inline math keeps $E=mc^2$ in flow.",
            "",
            "$$",
            "\\int_0^1 x^2 \\, dx",
            "$$",
            "",
            "```math",
            "\\frac{a+b}{c}",
            "```",
            "",
            "Invalid $\\badcommand$ still shows a fallback.",
            "",
            "$$not closed",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookMermaidBlocks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          text={[
            "Notebook diagrams render through the shared mermaid owner.",
            "",
            "```mermaid",
            "flowchart TD",
            "  Start --> Review",
            "  Review --> Ship",
            "```",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookMentionLinks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          apps={[
            {
              id: "google-calendar",
              name: "Google Calendar",
              description: "Manage events from markdown",
              installUrl: null,
              logoUrl: "https://cdn.example.com/google-calendar.png",
              logoUrlDark: null,
              isAccessible: true,
              isEnabled: true,
              pluginDisplayNames: [],
            },
          ]}
          plugins={[
            {
              id: "browser-use",
              name: "browser-use",
              shareContext: null,
              source: {
                type: "remote",
              },
              installed: true,
              enabled: true,
              installPolicy: "AVAILABLE",
              authPolicy: "ON_USE",
              availability: "AVAILABLE",
              interface: {
                displayName: "Browser Use",
                shortDescription: "Inspect and control browser sessions",
                longDescription: null,
                developerName: null,
                category: null,
                capabilities: [],
                websiteUrl: null,
                privacyPolicyUrl: null,
                termsOfServiceUrl: null,
                defaultPrompt: null,
                brandColor: "#00AAFF",
                composerIcon: null,
                composerIconUrl: "https://cdn.example.com/browser-use.png",
                logo: null,
                logoUrl: null,
                screenshots: [],
                screenshotUrls: [],
              },
              keywords: [],
            },
          ]}
          skills={[
            {
              brandColor: "#9f7aea",
              cwd: "D:\\skills",
              defaultPrompt: null,
              name: "notebook-helper",
              displayName: "Notebook Helper",
              description: "Notebook aware helper",
              iconLarge: null,
              iconSmall: "https://cdn.example.com/notebook-helper.png",
              shortDescription: "Opens notebook support files",
              path: "D:\\skills\\notebook-helper\\SKILL.md",
              scope: "user",
              enabled: true,
            },
          ]}
          text={[
            "Pair [@Calendar](app://google-calendar) with [@Browser Use](plugin://browser-use).",
            "",
            "Notebook refs can also surface [@Planner](agent://conv_123) and [@Reviewer](subagent://code-reviewer).",
            "",
            "Open [$Notebook helper](D:/skills/notebook-helper/SKILL.md) before running the next cell.",
            "",
            "Inline prompt-links also upgrade `[$Notebook helper](D:/skills/notebook-helper/SKILL.md)`.",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
    notebookMediaBlocks: renderSnapshot(
      <div className="w-[640px] px-4 py-4">
        <MarkdownPreview
          text={[
            "![Preview chart](https://example.com/chart.png)",
            "",
            "![Demo reel](https://example.com/demo.mp4)",
          ].join("\n")}
          variant="notebook"
        />
      </div>,
    ),
  };
}

function renderSnapshot(element: ReactElement) {
  return normalizeMarkup(
    renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>),
  );
}

function normalizeMarkup(markup: string) {
  return markup
    .replace(/\sd="[^"]*"/g, ' d="[path]"')
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}
