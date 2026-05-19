import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveWelcomeMode } from "./useWelcomeMode";

test("welcome mode follows the extracted debug override and default-flow routing", () => {
  assert.equal(
    resolveWelcomeMode({
      debugOverride: "on",
      statsigIsLoading: false,
      welcomeV2DefaultFlowEnabled: false,
    }),
    "role",
  );
  assert.equal(
    resolveWelcomeMode({
      debugOverride: "off",
      statsigIsLoading: false,
      welcomeV2DefaultFlowEnabled: true,
    }),
    "intent",
  );
  assert.equal(
    resolveWelcomeMode({
      debugOverride: "auto",
      statsigIsLoading: true,
      welcomeV2DefaultFlowEnabled: true,
    }),
    null,
  );
  assert.equal(
    resolveWelcomeMode({
      debugOverride: "auto",
      statsigIsLoading: false,
      welcomeV2DefaultFlowEnabled: true,
    }),
    "role",
  );
  assert.equal(
    resolveWelcomeMode({
      debugOverride: "auto",
      statsigIsLoading: false,
      welcomeV2DefaultFlowEnabled: false,
    }),
    "intent",
  );
});
