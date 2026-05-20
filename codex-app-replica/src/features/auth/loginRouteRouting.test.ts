/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { resolveLoginOnboardingRouteTarget } from "./loginRouteRouting";

test("requires auth users stay on login until authenticated", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 1,
      authState: {
        authMethod: null,
        requiresAuth: true,
      },
      forcedOverride: "auto",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: false,
      projectlessOnboardingCompleted: false,
    }),
    "login",
  );
});

test("forced override wins over workspace and onboarding state", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 1,
      authState: {
        authMethod: "chatgpt",
        requiresAuth: true,
      },
      forcedOverride: "workspace",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: false,
      projectlessOnboardingCompleted: true,
    }),
    "select-workspace",
  );
});

test("post-login welcome takes precedence over workspace selection when no roots exist", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 0,
      authState: {
        authMethod: "chatgpt",
        requiresAuth: true,
      },
      forcedOverride: "auto",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: true,
      projectlessOnboardingCompleted: false,
    }),
    "welcome",
  );
});

test("workspace onboarding is selected when authenticated without roots", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 0,
      authState: {
        authMethod: "chatgpt",
        requiresAuth: true,
      },
      forcedOverride: "auto",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: false,
      projectlessOnboardingCompleted: false,
    }),
    "select-workspace",
  );
});

test("projectless onboarding bypasses workspace gating", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 0,
      authState: {
        authMethod: "chatgpt",
        requiresAuth: true,
      },
      forcedOverride: "auto",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: false,
      projectlessOnboardingCompleted: true,
    }),
    "app",
  );
});

test("saved workspace roots bypass select-workspace even when no active root is selected", () => {
  assert.equal(
    resolveLoginOnboardingRouteTarget({
      workspaceRootCount: 2,
      authState: {
        authMethod: "chatgpt",
        requiresAuth: true,
      },
      forcedOverride: "auto",
      isWorkspaceRootsLoading: false,
      isAuthLoading: false,
      postLoginWelcomePending: false,
      projectlessOnboardingCompleted: false,
    }),
    "app",
  );
});
