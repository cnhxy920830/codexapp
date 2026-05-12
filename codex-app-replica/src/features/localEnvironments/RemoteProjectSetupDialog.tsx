import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import type { RemoteConnection } from "../../services/settingsHosts";

type RemoteProjectSetupDialogProps = {
  connectedRemoteConnections: RemoteConnection[];
  initialHostId: string;
  isSaving: boolean;
  onClose: () => void;
  onSave: (params: { hostId: string; remotePath: string }) => void | Promise<void>;
};

export function RemoteProjectSetupDialog({
  connectedRemoteConnections,
  initialHostId,
  isSaving,
  onClose,
  onSave,
}: RemoteProjectSetupDialogProps) {
  const { t } = useI18n();
  const fallbackHostId = connectedRemoteConnections[0]?.hostId ?? "";
  const [selectedHostId, setSelectedHostId] = useState("");
  const [remotePath, setRemotePath] = useState("");

  const resolvedInitialHostId = useMemo(() => {
    return connectedRemoteConnections.some((remoteConnection) => remoteConnection.hostId === initialHostId)
      ? initialHostId
      : fallbackHostId;
  }, [connectedRemoteConnections, fallbackHostId, initialHostId]);

  useEffect(() => {
    setSelectedHostId(resolvedInitialHostId);
    setRemotePath("");
  }, [resolvedInitialHostId]);

  const saveDisabled =
    isSaving ||
    connectedRemoteConnections.length === 0 ||
    selectedHostId.trim().length === 0 ||
    remotePath.trim().length === 0;

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[460px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="text-[18px] font-medium text-token-text-primary">
          {t("settings.localEnvironments.remoteProjectDialog.title")}
        </div>
        <div className="mt-2 text-[13px] leading-6 text-token-text-secondary">
          {connectedRemoteConnections.length > 0
            ? t("settings.localEnvironments.remoteProjectDialog.description")
            : t("settings.localEnvironments.remoteProjectDialog.emptyDescription")}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
              {t("settings.localEnvironments.remoteProjectDialog.hostLabel")}
            </span>
            <select
              value={selectedHostId}
              disabled={connectedRemoteConnections.length === 0 || isSaving}
              onChange={(event) => setSelectedHostId(event.target.value)}
              className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none disabled:opacity-60"
            >
              {connectedRemoteConnections.map((remoteConnection) => (
                <option key={remoteConnection.hostId} value={remoteConnection.hostId}>
                  {remoteConnection.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-token-text-secondary">
              {t("settings.localEnvironments.remoteProjectDialog.pathLabel")}
            </span>
            <input
              value={remotePath}
              disabled={connectedRemoteConnections.length === 0 || isSaving}
              onChange={(event) => setRemotePath(event.target.value)}
              className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none disabled:opacity-60"
            />
          </label>

          <div className="text-[13px] leading-6 text-token-text-secondary">
            {t("settings.localEnvironments.remoteProjectDialog.note")}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("settings.localEnvironments.remoteProjectDialog.cancel")}
          </button>
          <button
            type="button"
            onClick={() =>
              void onSave({
                hostId: selectedHostId,
                remotePath,
              })
            }
            disabled={saveDisabled}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("settings.localEnvironments.remoteProjectDialog.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
