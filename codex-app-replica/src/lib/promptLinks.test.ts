import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyPromptLink } from "./promptLinks";

test("classifyPromptLink resolves app and skill mentions from local snapshots", () => {
  const appSegment = classifyPromptLink({
    label: "$Calendar",
    href: "app://google-calendar",
    apps: [
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
        labels: null,
      },
    ],
  });

  assert.deepEqual(appSegment, {
    type: "app",
    raw: "[$Calendar](app://google-calendar)",
    label: "$Calendar",
    href: "app://google-calendar",
    appId: "google-calendar",
    name: "google-calendar",
    displayLabel: "Google Calendar",
    detail: "Manage events from markdown",
    iconSource: "https://cdn.example.com/google-calendar.png",
    resolved: true,
  });

  const skillSegment = classifyPromptLink({
    label: "$Notebook helper",
    href: "D:/skills/notebook-helper/SKILL.md",
    skills: [
      {
        brandColor: "#9f7aea",
        cwd: "D:\\skills",
        defaultPrompt: null,
        name: "notebook-helper",
        displayName: "Notebook Helper",
        description: "Notebook aware helper",
      iconLarge: null,
      iconSmall: null,
      shortDescription: "Opens notebook support files",
      path: "D:\\skills\\notebook-helper\\SKILL.md",
      scope: "user",
        enabled: true,
      },
    ],
  });

  assert.equal(skillSegment.type, "skill");
  assert.equal(skillSegment.displayLabel, "Notebook Helper");
  assert.equal(skillSegment.path, "D:\\skills\\notebook-helper\\SKILL.md");
  assert.equal(skillSegment.iconSource, null);
  assert.equal(skillSegment.resolved, true);
});

test("classifyPromptLink keeps plugin mentions and file references distinct", () => {
  const pluginSegment = classifyPromptLink({
    label: "@Browser Use",
    href: "plugin://browser-use",
    plugins: [
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
    ],
  });
  assert.deepEqual(pluginSegment, {
    type: "plugin",
    raw: "[@Browser Use](plugin://browser-use)",
    label: "@Browser Use",
    href: "plugin://browser-use",
    displayLabel: "Browser Use",
    detail: "Inspect and control browser sessions",
    brandColor: "#00AAFF",
    iconSource: "https://cdn.example.com/browser-use.png",
    resolved: true,
  });

  const agentSegment = classifyPromptLink({
    label: "@Planner",
    href: "agent://conv_123",
  });
  assert.deepEqual(agentSegment, {
    type: "agent",
    raw: "[@Planner](agent://conv_123)",
    label: "@Planner",
    href: "agent://conv_123",
    displayLabel: "Planner",
    detail: null,
    conversationId: "conv_123",
    roleName: null,
  });

  const subagentSegment = classifyPromptLink({
    label: "@Reviewer",
    href: "subagent://code-reviewer",
  });
  assert.deepEqual(subagentSegment, {
    type: "agent",
    raw: "[@Reviewer](subagent://code-reviewer)",
    label: "@Reviewer",
    href: "subagent://code-reviewer",
    displayLabel: "Reviewer",
    detail: null,
    conversationId: null,
    roleName: "code-reviewer",
  });

  const fileSegment = classifyPromptLink({
    label: "notes.md",
    href: "./notes.md:14",
  });
  assert.deepEqual(fileSegment, {
    type: "file",
    raw: "[notes.md](./notes.md:14)",
    label: "notes.md",
    href: "./notes.md:14",
    path: ".\\notes.md",
    line: 14,
    column: null,
    locationSuffix: ":14",
  });
});

test("classifyPromptLink marks unresolved app, plugin, and skill mentions for raw-text fallback owners", () => {
  const unresolvedAppSegment = classifyPromptLink({
    label: "$Calendar",
    href: "app://google-calendar",
  });
  assert.equal(unresolvedAppSegment.type, "app");
  assert.equal(unresolvedAppSegment.resolved, false);
  assert.equal(unresolvedAppSegment.name, "calendar");

  const unresolvedPluginSegment = classifyPromptLink({
    label: "@Browser Use",
    href: "plugin://browser-use",
  });
  assert.equal(unresolvedPluginSegment.type, "plugin");
  assert.equal(unresolvedPluginSegment.resolved, false);

  const unresolvedSkillSegment = classifyPromptLink({
    label: "$Code Review",
    href: "D:/skills/code-review",
  });
  assert.equal(unresolvedSkillSegment.type, "skill");
  assert.equal(unresolvedSkillSegment.resolved, false);
});
