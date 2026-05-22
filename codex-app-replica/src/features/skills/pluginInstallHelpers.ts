import type {
  AppConnectorDisclosureBlurb,
  AppConnectorPersonalizationToggle,
  ConnectorPersonalizationMode,
  ConnectAppConnectorCallbackMode,
  ConnectAppConnectorResponse,
} from "../../services/appConnect";
import { connectAppConnector, readAppConnectorDisclosure } from "../../services/appConnect";
import {
  type AppConnectResumeTarget,
  markAppConnectOAuthPending,
} from "../../services/appConnectOAuth";
import type { AppInfo } from "../../services/apps";
import {
  openInBrowser,
  readFileBinary,
  readFileText,
} from "../../services/hostFiles";
import type {
  PluginAppSummary,
  PluginDetail,
  PluginReadParams,
} from "../../services/plugins";

const CHROME_EXTENSION_ICON_RELATIVE_PATH = "assets/google-chrome.png";
const CHROME_EXTENSION_ID_RELATIVE_PATH = "scripts/extension-id.json";
const CHROME_EXTENSION_INSTALL_URL_PREFIX =
  "https://chromewebstore.google.com/detail/codex/";
const CHROME_LIKE_PLUGIN_NAMES = ["chrome", "chrome-dev", "chrome-internal"] as const;

export type PluginInstallBlockedReason =
  | "connector-unavailable"
  | "disabled-by-admin";

export type RequiredAppInstallStatus =
  | "connected"
  | "launching"
  | "pending"
  | "waitingForCallback";

export type RequiredAppInstallState = {
  appId: string;
  description: string | null;
  installUrl: string | null;
  logoUrl: string | null;
  name: string;
  status: RequiredAppInstallStatus;
};

export type BrowserExtensionState = {
  iconUrl: string | null;
  id: string;
  installUrl: string;
  name: string;
};

export type PluginConnectableApp = {
  appId: string;
  installUrl: string | null;
  name: string;
};

export type PluginConnectorDisclosure = {
  blurbs: AppConnectorDisclosureBlurb[];
  personalizationToggle: AppConnectorPersonalizationToggle | null;
};

export type PluginAppConnectLaunchResult =
  | {
      kind: "browser-fallback";
    }
  | {
      kind: "connected-directly";
    }
  | {
      kind: "failed";
    }
  | {
      kind: "waiting-for-callback";
    };

export function buildPluginInstallParams(
  detail: PluginDetail,
  hostId: string,
): PluginReadParams | null {
  if (detail.marketplacePath != null) {
    return {
      hostId,
      marketplacePath: detail.marketplacePath,
      pluginName: detail.summary.name,
    };
  }

  if (detail.marketplaceName.trim().length === 0) {
    return null;
  }

  return {
    hostId,
    pluginName: detail.summary.name,
    remoteMarketplaceName: detail.marketplaceName,
  };
}

export async function readPluginInstallDisclosure(
  apps: PluginAppSummary[],
): Promise<PluginConnectorDisclosure[]> {
  return Promise.all(
    apps.map((app) =>
      readAppConnectorDisclosure({
        appId: app.id,
        appName: app.name,
      }),
    ),
  );
}

export async function readPluginBrowserExtensions({
  detail,
  hostId,
}: {
  detail: PluginDetail | null;
  hostId?: string | null;
}): Promise<BrowserExtensionState[]> {
  if (
    detail == null ||
    detail.summary.authPolicy !== "ON_INSTALL" ||
    detail.summary.source.type !== "local" ||
    !isChromeLikePlugin(detail.summary.name)
  ) {
    return [];
  }

  try {
    const response = await readFileText({
      hostId,
      path: buildNestedPath(
        detail.summary.source.path,
        CHROME_EXTENSION_ID_RELATIVE_PATH,
      ),
    });
    const parsed = JSON.parse(response.contents) as { extensionId?: unknown };
    const extensionId =
      typeof parsed.extensionId === "string" ? parsed.extensionId.trim() : "";
    if (extensionId.length === 0) {
      return [];
    }

    return [
      {
        iconUrl: await readPluginBrowserExtensionIconUrl({
          detail,
          hostId,
        }),
        id: extensionId,
        installUrl: `${CHROME_EXTENSION_INSTALL_URL_PREFIX}${extensionId}`,
        name: "Codex Chrome Extension",
      },
    ];
  } catch {
    return [];
  }
}

export async function launchPluginAppConnect({
  app,
  callbackMode = "native",
  hostId,
  personalizationMode,
  resumeTarget,
  returnTo,
}: {
  app: PluginConnectableApp;
  callbackMode?: ConnectAppConnectorCallbackMode;
  hostId: string;
  personalizationMode?: ConnectorPersonalizationMode | null;
  resumeTarget?: AppConnectResumeTarget;
  returnTo: string;
}): Promise<PluginAppConnectLaunchResult | null> {
  const response = await connectAppConnector({
    appId: app.appId,
    appName: app.name,
    callbackMode,
    installUrl: app.installUrl,
    personalizationMode,
  });

  return handlePluginAppConnectResponse({
    app,
    hostId,
    response,
    resumeTarget,
    returnTo,
  });
}

export function resolveInstallBlockedReason(
  detail: PluginDetail | null,
  apps: AppInfo[],
): PluginInstallBlockedReason | null {
  if (detail == null || detail.summary.installed) {
    return null;
  }
  if (detail.summary.availability === "DISABLED_BY_ADMIN") {
    return "disabled-by-admin";
  }
  const inaccessibleApp = detail.apps.some(
    (pluginApp) =>
      !apps.some((app) => app.id === pluginApp.id && app.isAccessible),
  );
  return inaccessibleApp ? "connector-unavailable" : null;
}

export function readPluginSourcePath(detail: PluginDetail) {
  const source = detail.summary.source;
  if (source.type !== "local") {
    return null;
  }
  return source.path;
}

export function reconcileRequiredAppsWithSnapshot({
  apps,
  current,
}: {
  apps: AppInfo[];
  current: RequiredAppInstallState[];
}) {
  return current.map((requiredApp) => {
    const connectedApp = apps.find((app) => app.id === requiredApp.appId) ?? null;
    if (connectedApp?.isAccessible === true) {
      return {
        ...requiredApp,
        description: connectedApp.description ?? requiredApp.description,
        installUrl: connectedApp.installUrl ?? requiredApp.installUrl,
        logoUrl:
          connectedApp.logoUrl ?? connectedApp.logoUrlDark ?? requiredApp.logoUrl,
        name: connectedApp.name ?? requiredApp.name,
        status: "connected" as const,
      };
    }
    return requiredApp;
  });
}

function isChromeLikePlugin(pluginName: string) {
  return CHROME_LIKE_PLUGIN_NAMES.includes(
    pluginName as (typeof CHROME_LIKE_PLUGIN_NAMES)[number],
  );
}

function buildNestedPath(rootPath: string, relativePath: string) {
  return `${rootPath.replace(/[\\/]+$/u, "")}/${relativePath}`;
}

async function readPluginBrowserExtensionIconUrl({
  detail,
  hostId,
}: {
  detail: PluginDetail;
  hostId?: string | null;
}) {
  if (detail.summary.source.type !== "local") {
    return detail.summary.interface?.logoUrl ?? null;
  }

  try {
    const binary = await readFileBinary({
      hostId,
      path: buildNestedPath(
        detail.summary.source.path,
        CHROME_EXTENSION_ICON_RELATIVE_PATH,
      ),
    });
    const mimeType = binary.mimeType?.trim() || "image/png";
    return `data:${mimeType};base64,${binary.contentsBase64}`;
  } catch {
    return detail.summary.interface?.logoUrl ?? null;
  }
}

async function handlePluginAppConnectResponse({
  app,
  hostId,
  response,
  resumeTarget,
  returnTo,
}: {
  app: PluginConnectableApp;
  hostId: string;
  response: ConnectAppConnectorResponse;
  resumeTarget?: AppConnectResumeTarget;
  returnTo: string;
}): Promise<PluginAppConnectLaunchResult | null> {
  switch (response.kind) {
    case "connected-directly":
      return { kind: "connected-directly" };
    case "oauth-started":
      markAppConnectOAuthPending({
        app: {
          id: app.appId,
          name: app.name,
        },
        hostId,
        redirectUrl: response.redirectUrl,
        returnTo,
        resumeTarget: resumeTarget ?? { kind: "plugin-install" },
      });
      await openInBrowser(response.redirectUrl);
      return {
        kind: "waiting-for-callback",
      };
    case "browser-fallback":
      if (app.installUrl == null) {
        return { kind: "failed" };
      }
      await openInBrowser(app.installUrl);
      return { kind: "browser-fallback" };
    case "failed":
      return { kind: "failed" };
  }
}
