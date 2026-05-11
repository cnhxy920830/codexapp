import { useEffect, useState } from "react";
import { onAppsSnapshotUpdated, readAppsSnapshot } from "../../services/apps";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";

function resolvePluginsRouteEnabled(data: Array<{ name: string; isEnabled: boolean }>) {
  return data.find((app) => app.name === "plugins")?.isEnabled ?? true;
}

type PluginsRouteEnabledOptions = {
  allowRemoteHost?: boolean;
};

export function usePluginsRouteEnabled(
  hostId: string = LOCAL_SETTINGS_HOST_ID,
  options: PluginsRouteEnabledOptions = {},
) {
  const allowRemoteHost = options.allowRemoteHost === true;
  const [isPluginsRouteEnabled, setIsPluginsRouteEnabled] = useState(
    allowRemoteHost || hostId === LOCAL_SETTINGS_HOST_ID,
  );

  useEffect(() => {
    if (!allowRemoteHost && hostId !== LOCAL_SETTINGS_HOST_ID) {
      setIsPluginsRouteEnabled(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void readAppsSnapshot({ hostId })
      .then((response) => {
        if (!cancelled) {
          setIsPluginsRouteEnabled(resolvePluginsRouteEnabled(response.data));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsPluginsRouteEnabled(true);
        }
      });

    if (hostId === LOCAL_SETTINGS_HOST_ID) {
      void onAppsSnapshotUpdated((snapshot) => {
        if (!cancelled) {
          setIsPluginsRouteEnabled(resolvePluginsRouteEnabled(snapshot.data));
        }
      }).then((dispose) => {
        unlisten = dispose;
      });
    }

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [allowRemoteHost, hostId]);

  return isPluginsRouteEnabled;
}
