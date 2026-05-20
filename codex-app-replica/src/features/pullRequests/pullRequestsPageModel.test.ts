/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPullRequestProjectGroups,
  buildPullRequestRepoOptions,
  getPullRequestGitOriginRequests,
  type PullRequestGitOriginEntry,
} from "./pullRequestsPageModel";

test("pull requests repo options include local and connected remote projects with host-aware origins", () => {
  const projectGroups = buildPullRequestProjectGroups({
    codexHome: "C:/Users/demo/.codex",
    connectedRemoteHostIds: ["remote-a"],
    remoteProjects: [
      { id: "remote-a-1", hostId: "remote-a", remotePath: "/srv/work/codex", label: "codex" },
      { id: "remote-b-1", hostId: "remote-b", remotePath: "/srv/work/ignored", label: "ignored" },
    ],
    workspaceRoots: ["D:/repo/codex", "C:/Users/demo/.codex/worktrees/codex-pr"],
  });

  assert.deepEqual(
    projectGroups.map((group) => ({
      path: group.path,
      hostId: group.hostId,
      isCodexWorktree: group.isCodexWorktree,
    })),
    [
      { path: "D:/repo/codex", hostId: null, isCodexWorktree: false },
      { path: "C:/Users/demo/.codex/worktrees/codex-pr", hostId: null, isCodexWorktree: true },
      { path: "/srv/work/codex", hostId: "remote-a", isCodexWorktree: false },
    ],
  );

  const originRequests = getPullRequestGitOriginRequests(projectGroups);
  assert.deepEqual(originRequests, [
    {
      hostId: null,
      dirs: ["D:/repo/codex", "C:/Users/demo/.codex/worktrees/codex-pr"],
    },
    {
      hostId: "remote-a",
      dirs: ["/srv/work/codex"],
    },
  ]);

  const gitOrigins: PullRequestGitOriginEntry[] = [
    {
      hostId: null,
      origin: {
        dir: "D:/repo/codex",
        root: "D:/repo/codex",
        originUrl: "https://github.com/openai/codex.git",
      },
    },
    {
      hostId: null,
      origin: {
        dir: "C:/Users/demo/.codex/worktrees/codex-pr",
        root: "D:/repo/codex",
        originUrl: "https://github.com/openai/codex.git",
      },
    },
    {
      hostId: "remote-a",
      origin: {
        dir: "/srv/work/codex",
        root: "/srv/work/codex",
        originUrl: "git@github.example.com:team/codex.git",
      },
    },
  ];

  const repoOptions = buildPullRequestRepoOptions({
    codexHome: "C:/Users/demo/.codex",
    gitOrigins,
    projectGroups,
  });

  assert.deepEqual(repoOptions, [
    {
      cwd: "D:/repo/codex",
      hostId: null,
      key: "openai/codex",
      label: "openai/codex",
      originUrl: "https://github.com/openai/codex.git",
      repo: "openai/codex",
    },
    {
      cwd: "/srv/work/codex",
      hostId: "remote-a",
      key: "github.example.com/team/codex",
      label: "team/codex",
      originUrl: "git@github.example.com:team/codex.git",
      repo: "github.example.com/team/codex",
    },
  ]);
});
