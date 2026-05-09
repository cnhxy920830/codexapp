import { useEffect, useState } from "react";
import { onAppsSnapshotUpdated, readAppsSnapshot } from "../../services/apps";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";

function resolvePluginsRouteEnabled(data: Array<{ name: string; isEnabled: boolean }>) {
  return data.find((app) => app.name === "plugins")?.isEnabled ?? true;
}

export function usePluginsRouteEnabled(hostId: string = LOCAL_SETTINGS_HOST_ID) {
  const [isPluginsRouteEnabled, setIsPluginsRouteEnabled] = useState(hostId === LOCAL_SETTINGS_HOST_ID);

  useEffect(() => {
    if (hostId !== LOCAL_SETTINGS_HOST_ID) {
      setIsPluginsRouteEnabled(false);
      return;
    }

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void readAppsSnapshot()
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

    void onAppsSnapshotUpdated((snapshot) => {
      if (!cancelled) {
        setIsPluginsRouteEnabled(resolvePluginsRouteEnabled(snapshot.data));
      }
    }).then((dispose) => {
      unlisten = dispose;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [hostId]);

  return isPluginsRouteEnabled;
}
