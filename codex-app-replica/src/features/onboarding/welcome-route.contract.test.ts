import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isExplicitWelcomeOnboardingOverride,
  shouldClearActiveWorkspaceRootOnWelcomeCompletion,
} from "./welcomeRouteModel";

test("simple welcome card is reserved for the explicit welcome override", () => {
  assert.equal(isExplicitWelcomeOnboardingOverride("welcome"), true);
  assert.equal(isExplicitWelcomeOnboardingOverride(" Welcome "), true);
  assert.equal(isExplicitWelcomeOnboardingOverride("auto"), false);
  assert.equal(isExplicitWelcomeOnboardingOverride("workspace"), false);
  assert.equal(isExplicitWelcomeOnboardingOverride(null), false);
});

test("welcome completion only preserves the active workspace root for the explicit welcome override", () => {
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("welcome"), false);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("auto"), true);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion("workspace"), true);
  assert.equal(shouldClearActiveWorkspaceRootOnWelcomeCompletion(null), true);
});
