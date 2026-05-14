import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseAutomationsRouteState,
  serializeAutomationsRouteState,
} from "./automationsRouteState";

test("parse automations route state reads create and selected automation", () => {
  assert.deepEqual(
    parseAutomationsRouteState(
      "?automationMode=create&automationId=auto-123",
      null,
    ),
    {
      automationId: "auto-123",
      automationMode: "create",
    },
  );
});

test("parse automations route state ignores empty and unsupported values", () => {
  assert.deepEqual(
    parseAutomationsRouteState("?automationMode=edit&automationId=%20%20", null),
    {
      automationId: null,
      automationMode: null,
    },
  );
});

test("parse automations route state falls back to history state mode", () => {
  assert.deepEqual(parseAutomationsRouteState("", { automationMode: "create" }), {
    automationId: null,
    automationMode: "create",
  });
});

test("query automation mode wins over history state", () => {
  assert.deepEqual(
    parseAutomationsRouteState("?automationMode=create", { automationMode: "other" }),
    {
      automationId: null,
      automationMode: "create",
    },
  );
});

test("serialize automations route state writes only active values", () => {
  assert.equal(
    serializeAutomationsRouteState({
      automationId: "auto-789",
      automationMode: "create",
    }).toString(),
    "automationId=auto-789&automationMode=create",
  );

  assert.equal(
    serializeAutomationsRouteState({
      automationId: null,
      automationMode: null,
    }).toString(),
    "",
  );
});
