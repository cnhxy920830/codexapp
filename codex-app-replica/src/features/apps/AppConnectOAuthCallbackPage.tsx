import { useEffect, useEffectEvent, useRef } from "react";
import { Spinner } from "../../components/Spinner";
import type { AppToast } from "../../components/AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import {
  finishAppConnectOAuthCallback,
  getPendingAppConnectForCallbackUrl,
  parseAppConnectCallbackLocationState,
} from "../../services/appConnectOAuth";

export function AppConnectOAuthCallbackPage({
  locationKey,
  routeState,
  onNavigate,
  onShowToast,
}: {
  locationKey: string;
  routeState: unknown;
  onNavigate: (path: string, state?: Record<string, unknown> | null) => void;
  onShowToast: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const handledLocationKeyRef = useRef<string | null>(null);

  const handleCallback = useEffectEvent(
    async ({
      appId,
      appName,
      fullRedirectUrl,
      shouldShowPendingToast,
    }: {
      appId?: string;
      appName?: string;
      fullRedirectUrl: string | null;
      shouldShowPendingToast: boolean;
    }) => {
      if (shouldShowPendingToast && fullRedirectUrl && fullRedirectUrl.length > 0) {
        onShowToast({
          durationMs: 0,
          tone: "info",
          message: (
            <span className="loading-shimmer-pure-text">
              {t("apps.appConnectOAuthCallbackPage.pending", {
                connector: appName ?? t("apps.appConnectOAuthCallbackPage.fallbackAppName"),
              })}
            </span>
          ),
        });
      }

      const result = await finishAppConnectOAuthCallback({
        fullRedirectUrl: fullRedirectUrl ?? "",
      });
      if (result.kind === "missing-callback-data") {
        onShowToast({
          tone: "error",
          message: t("apps.appConnectOAuthCallbackPage.missingData"),
        });
        return;
      }

      if (result.kind === "request-failed") {
        onShowToast({
          tone: "error",
          message:
            result.message ?? t("apps.appConnectOAuthCallbackPage.requestFailed"),
        });
        return;
      }

      onShowToast({
        tone: "success",
        message: t("apps.appConnectOAuthCallbackPage.success", {
          appName: result.appName,
        }),
      });
      void appId;
    },
  );

  useEffect(() => {
    if (handledLocationKeyRef.current === locationKey) {
      return;
    }
    handledLocationKeyRef.current = locationKey;

    const locationState = parseAppConnectCallbackLocationState(routeState);
    const fullRedirectUrl = locationState?.fullRedirectUrl?.trim();
    const pending =
      fullRedirectUrl && fullRedirectUrl.length > 0
        ? getPendingAppConnectForCallbackUrl(fullRedirectUrl)
        : null;
    const returnTo = pending?.returnTo ?? locationState?.returnTo ?? "/skills";

    void handleCallback({
      appId: pending?.appId,
      appName: pending?.appName,
      fullRedirectUrl: fullRedirectUrl ?? null,
      shouldShowPendingToast: pending?.resumeTarget.kind === "plugin-install",
    });

    if (isLocalConversationRoute(returnTo)) {
      onNavigate(returnTo);
      return;
    }

    if (pending?.resumeTarget.kind === "plugin-install") {
      onNavigate(returnTo, {
        initialHostId: pending.hostId,
        initialTab: "plugins",
      });
      return;
    }

    onNavigate(returnTo, {
      connectAppId: pending?.appId,
      initialHostId: pending?.hostId,
      initialTab: "apps",
    });
  }, [handleCallback, locationKey, onNavigate, routeState]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner className="icon-sm" />
    </div>
  );
}

function isLocalConversationRoute(path: string) {
  return /^\/local\/[^/?#]+$/u.test(path);
}
