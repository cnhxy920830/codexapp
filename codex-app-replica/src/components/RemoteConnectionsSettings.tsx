import { useEffect, useState } from "react";
import {
  filterConnectedSettingsRemoteConnections,
  readSettingsRemoteConnectionStates,
  readSettingsRemoteConnectionsSnapshot,
  type AppServerConnectionState,
  type RemoteConnection,
} from "../services/settingsHosts";

export function RemoteConnectionsSettings({ embedded = false }: { embedded?: boolean }) {
  const [connections, setConnections] = useState<RemoteConnection[]>([]);
  const [states, setStates] = useState<Record<string, AppServerConnectionState>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const snapshot = await readSettingsRemoteConnectionsSnapshot();
        if (cancelled) {
          return;
        }
        setConnections(snapshot);
        const stateMap = await readSettingsRemoteConnectionStates(snapshot);
        if (cancelled) {
          return;
        }
        setStates(stateMap);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void refresh();
    return () => {
      cancelled = true;
    };
  }, []);

  const connectedCount = filterConnectedSettingsRemoteConnections(connections, states).length;

  return (
    <section className={embedded ? "p-panel" : "mx-auto max-w-3xl px-4 py-6"}>
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-medium text-[var(--app-shell-text)]">Connections</h1>
          <p className="text-[12px] text-[var(--app-shell-subtle)]">
            {connectedCount} connected · {connections.length} configured
          </p>
        </div>
      </header>

      {isLoading ? (
        <div className="text-[13px] text-[var(--app-shell-subtle)]">Loading connections…</div>
      ) : error ? (
        <div className="rounded-[10px] border border-[var(--app-shell-error-border)] bg-[var(--app-shell-error-surface)] px-3 py-2 text-[13px] text-[var(--app-shell-error-text)]">
          {error}
        </div>
      ) : connections.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[var(--app-shell-border)] px-4 py-6 text-center text-[13px] text-[var(--app-shell-subtle)]">
          No remote connections configured.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {connections.map((connection) => {
            const state = states[connection.hostId] ?? "disconnected";
            return (
              <li
                key={connection.hostId}
                className="rounded-[12px] border border-[var(--app-shell-border)] px-3 py-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-[var(--app-shell-text)]">
                      {connection.displayName}
                    </div>
                    <div className="truncate text-[12px] text-[var(--app-shell-subtle)]">
                      {connection.sshAlias ?? connection.sshHost ?? connection.hostId}
                    </div>
                  </div>
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      state === "connected"
                        ? "bg-[var(--app-shell-success-surface)] text-[var(--app-shell-success-text)]"
                        : state === "error"
                          ? "bg-[var(--app-shell-error-surface)] text-[var(--app-shell-error-text)]"
                          : "bg-[var(--app-shell-control)] text-[var(--app-shell-subtle)]",
                    ].join(" ")}
                  >
                    {state}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
