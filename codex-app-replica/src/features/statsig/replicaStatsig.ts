import { invoke } from "@tauri-apps/api/core";
import {
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import { StatsigClient } from "@statsig/js-client";

type StatsigClientLike = {
  getContext: () => { user?: { appVersion?: string } };
  initializeAsync: () => Promise<unknown>;
  logEvent: (eventName: string, value?: string | number, metadata?: Record<string, string>) => void;
};
import type { AuthSnapshot } from "../../services/auth";
import { statsigFetchThroughTauri } from "../../services/statsig";

const STATSIG_SDK_KEY =
  "client-sYWqzCYMRkUg4DqqiZcR5DGTNl2iD7zNJY0HoeDLzxR";
const STATSIG_API_URL = "https://ab.chatgpt.com/v1";
const STATSIG_LOG_EVENT_URL = "https://chatgpt.com/ces/v1/rgstr";
const STATSIG_SDK_EXCEPTION_URL = "https://ab.chatgpt.com/v1/sdk_exception";
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
const GATE_GLOBAL_DICTATION_CLEANUP = "1025755912";
const GATE_BROWSER_USE = "410262010";
const GATE_BROWSER_USE_EXTERNAL = "410065390";
const GATE_COMPUTER_USE = "1506311413";
const GATE_EXTERNAL_AGENT_ONBOARDING_IMPORT = "2900529421";
const GATE_EXTERNAL_AGENT_COWORK_MIGRATION = "816842483";
const GATE_WORKSPACE_ONBOARDING_WELCOME_V2_FLOW = "3760797255";
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
  dynamicConfigs: Record<string, unknown>;
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
  dynamicConfigs: {},
  error: null,
  gates: {},
  isLoading: false,
  lastUpdatedAtMs: null,
};

let currentState: ReplicaStatsigState = INITIAL_STATE;
const listeners = new Set<() => void>();
let latestStatsigAuthSnapshot: AuthSnapshot | null = null;
let productEventClient: StatsigClientLike | null = null;
let productEventClientPromise: Promise<StatsigClientLike | null> | null = null;
let productEventClientSignature: string | null = null;
const queuedProductEvents: StatsigProductEvent[] = [];

type StatsigProductEvent = {
  eventName: string;
  metadata?: Record<string, unknown>;
  value?: number | string | null;
};

export const REPLICA_STATSIG_GATES = {
  agentExperimentalFeatures: GATE_AGENT_EXPERIMENTAL_FEATURES,
  ambientSuggestions: GATE_AMBIENT_SUGGESTIONS,
  browserUse: GATE_BROWSER_USE,
  browserUseExternal: GATE_BROWSER_USE_EXTERNAL,
  chronicle: GATE_CHRONICLE,
  codexMobileHomeBanner: GATE_CODEx_MOBILE_HOME_BANNER,
  computerUse: GATE_COMPUTER_USE,
  dictationPrimary: GATE_DICTATION_PRIMARY,
  dictationSecondary: GATE_DICTATION_SECONDARY,
  externalAgentCoworkMigration: GATE_EXTERNAL_AGENT_COWORK_MIGRATION,
  externalAgentOnboardingImport: GATE_EXTERNAL_AGENT_ONBOARDING_IMPORT,
  gitHideSidebarPrIcons: GATE_GIT_HIDE_SIDEBAR_PR_ICONS,
  gitPullRequestMergeMethod: GATE_GIT_PR_MERGE_METHOD,
  globalDictationCleanup: GATE_GLOBAL_DICTATION_CLEANUP,
  gpuTearingDebug: GATE_GPU_TEARING_DEBUG,
  guardianApproval: GATE_GUARDIAN_APPROVAL,
  hotkeyWindow: GATE_HOTKEY_WINDOW,
  hotkeyWindowSuppress: GATE_HOTKEY_WINDOW_SUPPRESS,
  memories: GATE_MEMORIES,
  personality: GATE_PERSONALITY,
  remoteControlVisibility: GATE_REMOTE_CONTROL_VISIBILITY,
  remoteConnectionsHomeBanner: GATE_REMOTE_CONNECTIONS_HOME_BANNER,
  workspaceOnboardingWelcomeV2Flow:
    GATE_WORKSPACE_ONBOARDING_WELCOME_V2_FLOW,
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

export function useReplicaStatsigDynamicConfigValue(name: string) {
  const state = useReplicaStatsigState();
  return state.dynamicConfigs[name];
}

export function useReplicaStatsigOwner(authSnapshot: AuthSnapshot) {
  const authSignature = useMemo(
    () => createStatsigAuthSignature(authSnapshot),
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

  latestStatsigAuthSnapshot = authSnapshot;

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
        const dynamicConfigs = extractDynamicConfigValues(response);
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
          dynamicConfigs,
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

  useEffect(() => {
    if (authSnapshot.isLoading) {
      return;
    }

    void ensureStatsigProductEventClient(authSnapshot).catch(() => undefined);
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

export function logReplicaStatsigProductEvent({
  eventName,
  metadata,
  value,
}: StatsigProductEvent) {
  const authSnapshot = latestStatsigAuthSnapshot;
  if (authSnapshot == null || authSnapshot.isLoading) {
    return;
  }

  queuedProductEvents.push({
    eventName,
    metadata,
    value,
  });
  void ensureStatsigProductEventClient(authSnapshot)
    .then((client) => {
      if (client != null) {
        flushQueuedProductEvents(client);
      }
    })
    .catch(() => undefined);
}

export function readReplicaStatsigTelemetryIdentity() {
  const authState = latestStatsigAuthSnapshot?.authState;
  return {
    userId: normalizeOptionalString(authState?.userId),
    workspaceId: normalizeOptionalString(authState?.accountId),
  };
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

function createStatsigAuthSignature(authSnapshot: AuthSnapshot) {
  return JSON.stringify({
    accountId: authSnapshot.authState.accountId,
    authMethod: authSnapshot.authState.authMethod,
    email: authSnapshot.authState.email,
    planAtLogin: authSnapshot.authState.planAtLogin,
    requiresAuth: authSnapshot.authState.requiresAuth,
    userId: authSnapshot.authState.userId,
  });
}

async function ensureStatsigProductEventClient(authSnapshot: AuthSnapshot) {
  const signature = createStatsigAuthSignature(authSnapshot);
  if (productEventClient != null && productEventClientSignature === signature) {
    return productEventClient;
  }

  if (
    productEventClientPromise != null &&
    productEventClientSignature === signature
  ) {
    return productEventClientPromise;
  }

  productEventClientSignature = signature;
  productEventClientPromise = initializeStatsigProductEventClient(
    authSnapshot,
    signature,
  ).catch((error) => {
    if (productEventClientSignature === signature) {
      productEventClientPromise = null;
    }
    throw error;
  });
  return productEventClientPromise;
}

async function initializeStatsigProductEventClient(
  authSnapshot: AuthSnapshot,
  signature: string,
) {
  const client = new StatsigClient(
    STATSIG_SDK_KEY,
    buildStatsigUser(authSnapshot),
    {
      networkConfig: {
        api: STATSIG_API_URL,
        logEventUrl: STATSIG_LOG_EVENT_URL,
        networkOverrideFunc: statsigFetchThroughTauri,
        sdkExceptionUrl: STATSIG_SDK_EXCEPTION_URL,
      },
    },
  );

  await client.initializeAsync();
  if (productEventClientSignature !== signature) {
    return productEventClient;
  }

  productEventClient = client;
  productEventClientPromise = Promise.resolve(client);
  flushQueuedProductEvents(client);
  return client;
}

function flushQueuedProductEvents(client: StatsigClientLike) {
  if (queuedProductEvents.length === 0) {
    return;
  }

  const events = queuedProductEvents.splice(0, queuedProductEvents.length);
  for (const event of events) {
    client.logEvent(
      event.eventName,
      event.value ?? undefined,
      sanitizeStatsigProductEventMetadata({
        ...buildStatsigProductEventBaseMetadata(client),
        ...event.metadata,
      }),
    );
  }
}

function buildStatsigProductEventBaseMetadata(client: StatsigClientLike) {
  const appVersion = normalizeOptionalString(client.getContext().user?.appVersion);
  return {
    ...(appVersion ? { app_version: appVersion } : {}),
    origin: "codex_vscode",
  };
}

function sanitizeStatsigProductEventMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).flatMap(([key, value]) =>
      typeof value === "boolean" ||
      typeof value === "number" ||
      typeof value === "string"
        ? [[key, String(value)]]
        : [],
    ),
  );
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

function extractDynamicConfigValues(response: unknown) {
  const configs = readNamedValueCollection(response, "dynamic_configs");
  return Object.fromEntries(
    Object.entries(configs).map(([name, entry]) => [name, entry.value]),
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
