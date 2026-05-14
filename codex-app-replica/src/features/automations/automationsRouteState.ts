export type AutomationsRouteState = {
  automationId: string | null;
  automationMode: "create" | null;
};

type AutomationsHistoryState = {
  automationMode?: unknown;
} | null;

export function parseAutomationsRouteState(
  search: string,
  historyState?: AutomationsHistoryState,
): AutomationsRouteState {
  const params = new URLSearchParams(search);
  const automationId = normalizeSearchValue(params.get("automationId"));
  const automationMode = normalizeAutomationMode(
    normalizeSearchValue(params.get("automationMode")) ??
      normalizeHistoryAutomationMode(historyState),
  );

  return {
    automationId,
    automationMode,
  };
}

export function serializeAutomationsRouteState(
  state: AutomationsRouteState,
): URLSearchParams {
  const params = new URLSearchParams();

  if (state.automationId !== null) {
    params.set("automationId", state.automationId);
  }

  if (state.automationMode !== null) {
    params.set("automationMode", state.automationMode);
  }

  return params;
}

function normalizeSearchValue(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function normalizeHistoryAutomationMode(historyState?: AutomationsHistoryState) {
  if (!historyState || typeof historyState !== "object") {
    return null;
  }

  return typeof historyState.automationMode === "string"
    ? normalizeSearchValue(historyState.automationMode)
    : null;
}

function normalizeAutomationMode(value: string | null) {
  return value === "create" ? "create" : null;
}
