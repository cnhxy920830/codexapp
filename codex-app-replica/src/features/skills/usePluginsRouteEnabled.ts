import { useEffect, useState } from "react";
import { onAppsSnapshotUpdated, readAppsSnapshot } from "../../services/apps";

function resolvePluginsRouteEnabled(data: Array<{ name: string; isEnabled: boolean }>) {
  return data.find((app) => app.name === "plugins")?.isEnabled ?? true;
}

export function usePluginsRouteEnabled() {
  const [isPluginsRouteEnabled, setIsPluginsRouteEnabled] = useState(true);

  useEffect(() => {
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
  }, []);

  return isPluginsRouteEnabled;
}
