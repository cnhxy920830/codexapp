import { useEffect, useSyncExternalStore } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import { isAppConnectPending } from "../../services/appConnectOAuth";
import type { AppInfo } from "../../services/apps";
import type { ConnectorPersonalizationMode } from "../../services/appConnect";
import type { PluginDetail } from "../../services/plugins";
import {
  launchPluginAppConnect,
  reconcileRequiredAppsWithSnapshot,
  resolveInstallBlockedReason,
  type BrowserExtensionState,
  type RequiredAppInstallState,
} from "./pluginInstallHelpers";

export type PluginInstallSessionState =
  | {
      kind: "closed";
    }
  | {
      blockedReason: "connector-unavailable" | "disabled-by-admin" | null;
      includedBrowserExtensions: BrowserExtensionState[];
      kind: "details";
      plugin: PluginDetail;
      postInstallComposerPrefill: string | null;
    }
  | {
      blockedReason: "connector-unavailable" | "disabled-by-admin" | null;
      kind: "needsApps";
      plugin: PluginDetail;
      postInstallComposerPrefill: string | null;
      requiredApps: RequiredAppInstallState[];
      requiredBrowserExtensions: BrowserExtensionState[];
    };

type PluginInstallStoreSnapshot = {
  isInstalling: boolean;
  session: PluginInstallSessionState;
};

const INITIAL_SNAPSHOT: PluginInstallStoreSnapshot = {
  isInstalling: false,
  session: { kind: "closed" },
};

let currentSnapshot: PluginInstallStoreSnapshot = INITIAL_SNAPSHOT;
const listeners = new Set<() => void>();

export function getPluginInstallSnapshot() {
  return currentSnapshot;
}

export function subscribePluginInstallSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function openPluginInstallSession({
  blockedReason,
  includedBrowserExtensions,
  plugin,
  postInstallComposerPrefill,
}: {
  blockedReason: "connector-unavailable" | "disabled-by-admin" | null;
  includedBrowserExtensions?: BrowserExtensionState[];
  plugin: PluginDetail;
  postInstallComposerPrefill?: string | null;
}) {
  updateSnapshot({
    ...currentSnapshot,
    session: {
      blockedReason,
      includedBrowserExtensions: includedBrowserExtensions ?? [],
      kind: "details",
      plugin,
      postInstallComposerPrefill: postInstallComposerPrefill ?? null,
    },
  });
}

export function closePluginInstallSession() {
  updateSnapshot({
    isInstalling: false,
    session: { kind: "closed" },
  });
}

export function setPluginInstallIsInstalling(isInstalling: boolean) {
  updateSnapshot({
    ...currentSnapshot,
    isInstalling,
  });
}

export function setPluginInstallNeedsApps({
  blockedReason,
  plugin,
  postInstallComposerPrefill,
  requiredApps,
  requiredBrowserExtensions,
}: {
  blockedReason: "connector-unavailable" | "disabled-by-admin" | null;
  plugin: PluginDetail;
  postInstallComposerPrefill: string | null;
  requiredApps: RequiredAppInstallState[];
  requiredBrowserExtensions: BrowserExtensionState[];
}) {
  updateSnapshot({
    isInstalling: false,
    session: {
      blockedReason,
      kind: "needsApps",
      plugin,
      postInstallComposerPrefill,
      requiredApps,
      requiredBrowserExtensions,
    },
  });
}

export function markPluginInstallRequiredAppStatus({
  appId,
  status,
}: {
  appId: string;
  status: RequiredAppInstallState["status"];
}) {
  updateSnapshot({
    ...currentSnapshot,
    session:
      currentSnapshot.session.kind !== "needsApps"
        ? currentSnapshot.session
        : {
            ...currentSnapshot.session,
            requiredApps: currentSnapshot.session.requiredApps.map((app) =>
              app.appId === appId ? { ...app, status } : app,
            ),
          },
  });
}

export function reconcilePluginInstallSession({
  apps,
  detail,
}: {
  apps: AppInfo[];
  detail: PluginDetail | null;
}) {
  const session = currentSnapshot.session;
  if (session.kind === "closed" || detail == null) {
    return;
  }
  if (session.plugin.summary.id !== detail.summary.id) {
    return;
  }

  const blockedReason = resolveInstallBlockedReason(detail, apps);
  if (session.kind === "details") {
    updateSnapshot({
      ...currentSnapshot,
      session: {
        ...session,
        blockedReason,
        includedBrowserExtensions: session.includedBrowserExtensions,
        plugin: detail,
      },
    });
    return;
  }

  updateSnapshot({
    ...currentSnapshot,
    session: {
      ...session,
      blockedReason,
      plugin: detail,
      requiredApps: reconcileRequiredAppsWithSnapshot({
        apps,
        current: session.requiredApps,
      }).map((requiredApp) =>
        requiredApp.status === "waitingForCallback" &&
        !isAppConnectPending(requiredApp.appId)
          ? {
              ...requiredApp,
              status: "pending",
            }
          : requiredApp,
      ),
    },
  });
}

export function usePluginInstallStore() {
  return useSyncExternalStore(
    subscribePluginInstallSession,
    getPluginInstallSnapshot,
    getPluginInstallSnapshot,
  );
}

export function usePluginInstallAutoFinish({
  apps,
  detail,
  onInstalledReady,
  onShowToast,
}: {
  apps: AppInfo[];
  detail: PluginDetail | null;
  onInstalledReady: (options: { postInstallComposerPrefill: string | null }) => void;
  onShowToast: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const snapshot = usePluginInstallStore();

  useEffect(() => {
    reconcilePluginInstallSession({
      apps,
      detail,
    });
  }, [apps, detail]);

  useEffect(() => {
    const session = snapshot.session;
    if (session.kind !== "needsApps") {
      return;
    }

    const allRequiredAppsConnected =
      session.requiredApps.length > 0 &&
      session.requiredApps.every((app) => app.status === "connected");
    if (
      !allRequiredAppsConnected ||
      session.requiredBrowserExtensions.length > 0
    ) {
      return;
    }

    closePluginInstallSession();
    onShowToast({
      tone: "success",
      message: t("plugins.install.ready", {
        pluginName:
          session.plugin.summary.interface?.displayName ??
          session.plugin.summary.name,
      }),
    });
    onInstalledReady({
      postInstallComposerPrefill: session.postInstallComposerPrefill,
    });
  }, [onInstalledReady, onShowToast, snapshot.session, t]);

  return snapshot;
}

export async function connectPluginInstallRequiredApp({
  appId,
  hostId,
  onConnected,
  onDirectlyConnected,
  personalizationMode,
}: {
  appId: string;
  hostId: string;
  onConnected?: (() => Promise<void>) | (() => void);
  onDirectlyConnected?: (appName: string) => void;
  personalizationMode?: ConnectorPersonalizationMode | null;
}) {
  const session = currentSnapshot.session;
  if (session.kind !== "needsApps") {
    return;
  }

  const requiredApp =
    session.requiredApps.find((app) => app.appId === appId) ?? null;
  if (
    requiredApp == null ||
    requiredApp.status === "connected" ||
    requiredApp.status === "launching" ||
    requiredApp.status === "waitingForCallback"
  ) {
    return;
  }

  markPluginInstallRequiredAppStatus({
    appId,
    status: "launching",
  });
  try {
    const result = await launchPluginAppConnect({
      app: requiredApp,
      hostId,
      personalizationMode,
      returnTo: `${window.location.pathname}${window.location.search}`,
    });
    if (result == null) {
      markPluginInstallRequiredAppStatus({
        appId,
        status: "pending",
      });
      return;
    }

    if (result.kind === "connected-directly") {
      markPluginInstallRequiredAppStatus({
        appId,
        status: "connected",
      });
      onDirectlyConnected?.(requiredApp.name);
      await onConnected?.();
      return;
    }

    markPluginInstallRequiredAppStatus({
      appId,
      status: "waitingForCallback",
    });
    if (result.kind !== "waiting-for-callback") {
      markPluginInstallRequiredAppStatus({
        appId,
        status: "pending",
      });
    }
  } catch {
    markPluginInstallRequiredAppStatus({
      appId,
      status: "pending",
    });
  }
}

function updateSnapshot(nextSnapshot: PluginInstallStoreSnapshot) {
  currentSnapshot = nextSnapshot;
  for (const listener of listeners) {
    listener();
  }
}
