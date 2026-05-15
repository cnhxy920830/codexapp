import { invoke } from "@tauri-apps/api/core";
import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { AuthSnapshot } from "../../services/auth";

const STATSIG_SDK_KEY =
  "client-sYWqzCYMRkUg4DqqiZcR5DGTNl2iD7zNJY0HoeDLzxR";
const STATSIG_STABLE_ID_STORAGE_KEY =
  `codex-app-replica.statsig.stable-id.${STATSIG_SDK_KEY}`;
const GATE_HOTKEY_WINDOW = "1372061905";
const GATE_HOTKEY_WINDOW_SUPPRESS = "1981165915";
const GATE_DICTATION_PRIMARY = "1244621283";
const GATE_DICTATION_SECONDARY = "4100906017";
const GATE_GPU_TEARING_DEBUG = "2423536643";
const GATE_AMBIENT_SUGGESTIONS = "2425897452";
const GATE_CODEx_MOBILE_HOME_BANNER = "2798711298";
const GATE_MEMORIES = "875176429";
const GATE_PERSONALITY = "1444479692";
const GATE_CHRONICLE = "2574306096";
const GATE_GIT_PR_MERGE_METHOD = "2764989143";
const GATE_GIT_HIDE_SIDEBAR_PR_ICONS = "2553306736";
const GATE_REMOTE_CONNECTIONS_HOME_BANNER = "4114442250";
const GATE_REMOTE_CONTROL_VISIBILITY = "1042620455";
const GATE_AGENT_EXPERIMENTAL_FEATURES = "2106641128";
const GATE_GUARDIAN_APPROVAL = "3902016271";
const GATE_WORKSPACE_ONBOARDING_WELCOME_V2_DEFAULT_FLOW = "3979170498";
const STATSIG_RUNTIME_LAYER = "2096615506";
const STATSIG_DEFAULT_FEATURE_NAMES = [
  "apps",
  "memories",
  "plugins",
  "tool_call_mcp_elicitation",
  "tool_search",
  "tool_suggest",
  "workspace_dependencies",
] as const;

type StatsigDefaultFeatureName = (typeof STATSIG_DEFAULT_FEATURE_NAMES)[number];

type ReplicaStatsigSharedDefaultFeatures = Record<StatsigDefaultFeatureName, boolean>;

export type ReplicaStatsigDefaultFeatures = ReplicaStatsigSharedDefaultFeatures & {
  guardian_approval: boolean;
};

type ReplicaStatsigState = {
  defaultFeatures: ReplicaStatsigDefaultFeatures;
  error: string | null;
  gates: Record<string, boolean>;
  isLoading: boolean;
  lastUpdatedAtMs: number | null;
};

type StatsigFetchValuesParams = {
  body: {
    deltasResponseRequested: boolean;
    full_checksum: null;
    hash: "djb2";
    user: Record<string, unknown>;
  };
};

const INITIAL_STATE: ReplicaStatsigState = {
  defaultFeatures: {
    apps: false,
    guardian_approval: false,
    memories: false,
    plugins: false,
    tool_call_mcp_elicitation: false,
    tool_search: false,
    tool_suggest: false,
    workspace_dependencies: false,
  },
  error: null,
  gates: {},
  isLoading: false,
  lastUpdatedAtMs: null,
};

let currentState: ReplicaStatsigState = INITIAL_STATE;
const listeners = new Set<() => void>();

export const REPLICA_STATSIG_GATES = {
  agentExperimentalFeatures: GATE_AGENT_EXPERIMENTAL_FEATURES,
  ambientSuggestions: GATE_AMBIENT_SUGGESTIONS,
  chronicle: GATE_CHRONICLE,
  codexMobileHomeBanner: GATE_CODEx_MOBILE_HOME_BANNER,
  dictationPrimary: GATE_DICTATION_PRIMARY,
  dictationSecondary: GATE_DICTATION_SECONDARY,
  gitHideSidebarPrIcons: GATE_GIT_HIDE_SIDEBAR_PR_ICONS,
  gitPullRequestMergeMethod: GATE_GIT_PR_MERGE_METHOD,
  gpuTearingDebug: GATE_GPU_TEARING_DEBUG,
  guardianApproval: GATE_GUARDIAN_APPROVAL,
  hotkeyWindow: GATE_HOTKEY_WINDOW,
  hotkeyWindowSuppress: GATE_HOTKEY_WINDOW_SUPPRESS,
  memories: GATE_MEMORIES,
  personality: GATE_PERSONALITY,
  remoteControlVisibility: GATE_REMOTE_CONTROL_VISIBILITY,
  remoteConnectionsHomeBanner: GATE_REMOTE_CONNECTIONS_HOME_BANNER,
  workspaceOnboardingWelcomeV2DefaultFlow:
    GATE_WORKSPACE_ONBOARDING_WELCOME_V2_DEFAULT_FLOW,
} as const;

function emitStateChanged() {
  for (const listener of listeners) {
    listener();
  }
}

function setState(nextState: ReplicaStatsigState) {
  currentState = nextState;
  emitStateChanged();
}

function patchState(
  updater: (state: ReplicaStatsigState) => ReplicaStatsigState,
) {
  setState(updater(currentState));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getStateSnapshot() {
  return currentState;
}

export function useReplicaStatsigState() {
  return useSyncExternalStore(subscribe, getStateSnapshot, getStateSnapshot);
}

export function useReplicaStatsigGateValue(gateName: string) {
  const state = useReplicaStatsigState();
  return state.gates[gateName] === true;
}

export function useReplicaStatsigDefaultFeatures() {
  return useReplicaStatsigState().defaultFeatures;
}

export function useReplicaStatsigOwner(authSnapshot: AuthSnapshot) {
  const authSignature = useMemo(
    () =>
      JSON.stringify({
        accountId: authSnapshot.authState.accountId,
        authMethod: authSnapshot.authState.authMethod,
        email: authSnapshot.authState.email,
        planAtLogin: authSnapshot.authState.planAtLogin,
        requiresAuth: authSnapshot.authState.requiresAuth,
        userId: authSnapshot.authState.userId,
      }),
    [
      authSnapshot.authState.accountId,
      authSnapshot.authState.authMethod,
      authSnapshot.authState.email,
      authSnapshot.authState.planAtLogin,
      authSnapshot.authState.requiresAuth,
      authSnapshot.authState.userId,
    ],
  );
  const latestRequestIdRef = useRef(0);
  const state = useReplicaStatsigState();

  useEffect(() => {
    if (authSnapshot.isLoading) {
      return;
    }

    const requestId = latestRequestIdRef.current + 1;
    latestRequestIdRef.current = requestId;
    patchState((current) => ({
      ...current,
      error: null,
      isLoading: true,
    }));

    const request = buildStatsigInitializeRequest(authSnapshot);
    void invoke<unknown>("statsig-fetch-values", {
      params: {
        body: request,
      } satisfies StatsigFetchValuesParams,
    })
      .then((response) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        const gates = extractGateValues(response);
        const sharedDefaultFeatures = extractSharedDefaultFeatures(
          response,
          currentState.defaultFeatures,
        );
        void invoke("sync-primary-runtime-shared-objects", {
          params: {
            codexRuntimesConfig: extractCodexRuntimesConfig(response),
            statsigDefaultEnableFeatures: sharedDefaultFeatures,
          },
        }).catch(() => undefined);
        setState({
          defaultFeatures: {
            ...sharedDefaultFeatures,
            guardian_approval: gates[GATE_GUARDIAN_APPROVAL] === true,
          },
          error: null,
          gates,
          isLoading: false,
          lastUpdatedAtMs: Date.now(),
        });
      })
      .catch((error) => {
        if (latestRequestIdRef.current !== requestId) {
          return;
        }
        patchState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : String(error),
          isLoading: false,
        }));
      });
  }, [authSignature, authSnapshot.isLoading]);

  const globalDictationEnabled =
    state.gates[GATE_DICTATION_PRIMARY] === true &&
    state.gates[GATE_DICTATION_SECONDARY] === true;
  const hotkeyWindowEnabled =
    state.gates[GATE_HOTKEY_WINDOW] === true &&
    !authSnapshot.isLoading &&
    (authSnapshot.authState.authMethod !== null ||
      !authSnapshot.authState.requiresAuth);

  useEffect(() => {
    void invoke("global-dictation-enabled-changed", {
      params: {
        enabled: globalDictationEnabled,
      },
    }).catch(() => undefined);
  }, [globalDictationEnabled]);

  useEffect(() => {
    if (authSnapshot.isLoading) {
      return;
    }

    void invoke("hotkey-window-enabled-changed", {
      params: {
        enabled: hotkeyWindowEnabled,
      },
    }).catch(() => undefined);
  }, [authSnapshot.isLoading, hotkeyWindowEnabled]);
}

function buildStatsigInitializeRequest(authSnapshot: AuthSnapshot) {
  return {
    deltasResponseRequested: false,
    full_checksum: null,
    hash: "djb2" as const,
    user: buildStatsigUser(authSnapshot),
  };
}

function buildStatsigUser(authSnapshot: AuthSnapshot) {
  const authState = authSnapshot.authState;
  const authMethod = normalizeOptionalString(authState.authMethod);
  const accountId = normalizeOptionalString(authState.accountId);
  const email = normalizeOptionalString(authState.email);
  const plan = normalizeOptionalString(authState.planAtLogin);
  const stableID = getOrCreateStableId();
  const userID =
    normalizeOptionalString(authState.userId) ??
    (authMethod === "chatgpt" ? null : `ua-${stableID}`);
  const customIDs: Record<string, string> = {
    stableID,
  };

  if (accountId) {
    customIDs.account_id = accountId;
  }

  return {
    ...(email ? { email } : {}),
    ...(userID ? { userID } : {}),
    custom: {
      account_id: accountId ?? undefined,
      auth_method: authMethod ?? undefined,
      auth_status: authMethod === "chatgpt" ? "logged_in" : "logged_out",
      codex_window_type: "electron",
      is_openai_internal: email?.endsWith("@openai.com") ?? false,
      plan_type: plan ?? undefined,
      systemName: detectSystemName(),
    },
    customIDs,
    locale:
      typeof navigator === "undefined" ? "en-US" : navigator.language || "en-US",
    stableID,
  };
}

function getOrCreateStableId() {
  if (typeof window === "undefined") {
    return "replica-ssr-stable-id";
  }

  try {
    const existingValue = window.localStorage.getItem(
      STATSIG_STABLE_ID_STORAGE_KEY,
    );
    if (existingValue && existingValue.trim().length > 0) {
      return existingValue;
    }
  } catch {
    // Ignore localStorage read failures and fall through to an ephemeral id.
  }

  const nextValue =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `replica-${Math.random().toString(16).slice(2)}`;

  try {
    window.localStorage.setItem(STATSIG_STABLE_ID_STORAGE_KEY, nextValue);
  } catch {
    // Keep the in-memory value for this session when persistence is unavailable.
  }

  return nextValue;
}

function extractGateValues(response: unknown) {
  const gates = readNamedValueCollection(response, "feature_gates");
  return Object.fromEntries(
    Object.entries(gates).flatMap(([name, entry]) =>
      typeof entry.value === "boolean" ? [[name, entry.value]] : [],
    ),
  );
}

function extractCodexRuntimesConfig(response: unknown) {
  const runtimeLayer = readNamedValueCollection(response, "layer_configs")[
    STATSIG_RUNTIME_LAYER
  ]?.value;
  if (!isPlainObject(runtimeLayer)) {
    return null;
  }

  return {
    runtimes: {
      "codex-primary-runtime": runtimeLayer,
    },
  };
}

function extractSharedDefaultFeatures(
  response: unknown,
  fallback: ReplicaStatsigDefaultFeatures,
): ReplicaStatsigSharedDefaultFeatures {
  const source = readStatsigDefaultEnableFeaturesSource(response);
  return Object.fromEntries(
    STATSIG_DEFAULT_FEATURE_NAMES.map((featureName) => [
      featureName,
      source?.[featureName] === true ? true : fallback[featureName] === true,
    ]),
  ) as ReplicaStatsigSharedDefaultFeatures;
}

function readStatsigDefaultEnableFeaturesSource(response: unknown) {
  const rootValue =
    isPlainObject(response) &&
    isPlainObject(response.statsig_default_enable_features)
      ? response.statsig_default_enable_features
      : isPlainObject(response) && isPlainObject(response.default_enable_features)
        ? response.default_enable_features
        : null;
  if (rootValue !== null) {
    return rootValue;
  }

  const dynamicValue = readNamedValueCollection(response, "dynamic_configs")[
    "statsig_default_enable_features"
  ]?.value;
  if (isPlainObject(dynamicValue)) {
    return dynamicValue;
  }

  const layerValue = readNamedValueCollection(response, "layer_configs")[
    "statsig_default_enable_features"
  ]?.value;
  return isPlainObject(layerValue) ? layerValue : null;
}

function readNamedValueCollection(
  root: unknown,
  key: "feature_gates" | "layer_configs" | "dynamic_configs",
) {
  const source =
    root && typeof root === "object" && !Array.isArray(root)
      ? (root as Record<string, unknown>)[key]
      : null;
  if (!source) {
    return {} as Record<string, { groupName: string | null; value: unknown }>;
  }

  if (Array.isArray(source)) {
    return Object.fromEntries(
      source.flatMap((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return [];
        }

        const record = entry as Record<string, unknown>;
        const name = normalizeOptionalString(record.name);
        if (!name) {
          return [];
        }

        return [
          [
            name,
            {
              groupName: normalizeOptionalString(record.group_name),
              value: record.value,
            },
          ] as const,
        ];
      }),
    );
  }

  if (typeof source !== "object") {
    return {} as Record<string, { groupName: string | null; value: unknown }>;
  }

  return Object.fromEntries(
    Object.entries(source).map(([name, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return [name, { groupName: null, value: entry }] as const;
      }
      const record = entry as Record<string, unknown>;
      return [
        name,
        {
          groupName: normalizeOptionalString(record.group_name),
          value: "value" in record ? record.value : entry,
        },
      ] as const;
    }),
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function detectSystemName() {
  if (typeof navigator === "undefined") {
    return "Windows";
  }

  const platform = navigator.userAgent || navigator.platform || "";
  if (/mac/i.test(platform)) {
    return "macOS";
  }
  if (/linux/i.test(platform)) {
    return "Linux";
  }
  return "Windows";
}
