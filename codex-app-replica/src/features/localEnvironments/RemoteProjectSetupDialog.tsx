import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/Button";
import { SettingsRemoteHostIcon } from "../../components/SettingsHostDropdown";
import { Spinner } from "../../components/Spinner";
import { useI18n } from "../../i18n/i18n";
import {
  getRemoteProjectLabel,
  normalizeRemoteProjectPath,
  readRemoteWorkspaceDirectoryEntries,
  type RemoteConnection,
  type RemoteProject,
} from "../../services/settingsHosts";

type RemoteProjectSetupDialogProps = {
  connectedRemoteConnections: RemoteConnection[];
  initialHostId: string;
  isSaving: boolean;
  remoteProjects: RemoteProject[];
  onClose: () => void;
  onSave: (params: { hostId: string; remotePath: string }) => void | Promise<void>;
};

type SubmitBlocker =
  | { kind: "no-connected-remote" }
  | { kind: "selected-remote-unavailable" }
  | { kind: "invalid-path" }
  | { kind: "path-validation-pending" }
  | { kind: "conflicting-remote-project"; conflictingProjectName: string; remoteName: string };

export function RemoteProjectSetupDialog({
  connectedRemoteConnections,
  initialHostId,
  isSaving,
  remoteProjects,
  onClose,
  onSave,
}: RemoteProjectSetupDialogProps) {
  const { t } = useI18n();
  const fallbackHostId = connectedRemoteConnections[0]?.hostId ?? "";
  const [selectedHostId, setSelectedHostId] = useState("");
  const [remotePath, setRemotePath] = useState("");
  const [isHostMenuOpen, setIsHostMenuOpen] = useState(false);
  const [isPathValidationPending, setIsPathValidationPending] = useState(false);
  const [validatedDirectoryPath, setValidatedDirectoryPath] = useState<string | null>(null);
  const [validationErrorPath, setValidationErrorPath] = useState<string | null>(null);

  const resolvedInitialHostId = useMemo(() => {
    return connectedRemoteConnections.some((remoteConnection) => remoteConnection.hostId === initialHostId)
      ? initialHostId
      : fallbackHostId;
  }, [connectedRemoteConnections, fallbackHostId, initialHostId]);

  useEffect(() => {
    setSelectedHostId(resolvedInitialHostId);
    setRemotePath("");
    setValidatedDirectoryPath(null);
    setValidationErrorPath(null);
    setIsPathValidationPending(false);
  }, [resolvedInitialHostId]);

  const connectedHostIds = useMemo(() => {
    return connectedRemoteConnections.map((remoteConnection) => remoteConnection.hostId);
  }, [connectedRemoteConnections]);

  const selectedConnection =
    connectedRemoteConnections.find((remoteConnection) => remoteConnection.hostId === selectedHostId) ?? null;
  const normalizedRemotePath = useMemo(() => normalizeRemoteProjectPath(remotePath), [remotePath]);
  const normalizedValidatedPath = useMemo(
    () => (validatedDirectoryPath ? normalizeRemoteProjectPath(validatedDirectoryPath) : null),
    [validatedDirectoryPath],
  );
  const conflictingRemoteProject = useMemo(() => {
    if (!selectedConnection || !normalizedValidatedPath) {
      return null;
    }

    return (
      remoteProjects.find((remoteProject) => {
        return (
          remoteProject.hostId === selectedConnection.hostId &&
          normalizeRemoteProjectPath(remoteProject.remotePath) === normalizedValidatedPath
        );
      }) ?? null
    );
  }, [normalizedValidatedPath, remoteProjects, selectedConnection]);

  useEffect(() => {
    if (!selectedConnection || normalizedRemotePath === null) {
      setValidatedDirectoryPath(null);
      setIsPathValidationPending(false);
      return;
    }

    let cancelled = false;
    setIsPathValidationPending(true);
    setValidatedDirectoryPath(null);

    void readRemoteWorkspaceDirectoryEntries({
      hostId: selectedConnection.hostId,
      directoryPath: normalizedRemotePath,
      directoriesOnly: true,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setValidatedDirectoryPath(response.directoryPath);
      })
      .catch(() => {
        if (!cancelled) {
          setValidatedDirectoryPath(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsPathValidationPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [normalizedRemotePath, selectedConnection]);

  const submitBlocker = useMemo<SubmitBlocker | null>(() => {
    if (connectedRemoteConnections.length === 0) {
      return { kind: "no-connected-remote" };
    }
    if (selectedConnection === null) {
      return { kind: "selected-remote-unavailable" };
    }
    if (normalizedRemotePath === null) {
      return { kind: "invalid-path" };
    }
    if (validationErrorPath !== null && normalizeRemoteProjectPath(validationErrorPath) === normalizedRemotePath) {
      return { kind: "invalid-path" };
    }
    if (isPathValidationPending) {
      return { kind: "path-validation-pending" };
    }
    if (normalizedValidatedPath === null) {
      return { kind: "invalid-path" };
    }
    if (conflictingRemoteProject) {
      return {
        kind: "conflicting-remote-project",
        conflictingProjectName: conflictingRemoteProject.label,
        remoteName: selectedConnection.displayName,
      };
    }
    return null;
  }, [
    connectedRemoteConnections.length,
    conflictingRemoteProject,
    isPathValidationPending,
    normalizedRemotePath,
    normalizedValidatedPath,
    selectedConnection,
    validationErrorPath,
  ]);

  const notice = useMemo(() => {
    if (submitBlocker === null || submitBlocker.kind === "path-validation-pending") {
      return null;
    }
    if (submitBlocker.kind === "no-connected-remote") {
      return {
        toneClassName: "text-token-editor-warning-foreground",
        message: t("projectSetupDialog.noConnectedRemotes"),
      };
    }
    if (submitBlocker.kind === "selected-remote-unavailable") {
      return {
        toneClassName: "text-token-editor-warning-foreground",
        message: t("projectSetupDialog.selectedRemoteUnavailable"),
      };
    }
    if (submitBlocker.kind === "invalid-path") {
      return {
        toneClassName: "text-token-error-foreground",
        message: t("projectSetupDialog.invalidPath.missing"),
      };
    }
    return {
      toneClassName: "text-token-error-foreground",
      message: t("projectSetupDialog.conflict.remoteProjectAlreadyMapped.standalone", {
        projectName: submitBlocker.conflictingProjectName,
        remoteName: submitBlocker.remoteName,
      }),
    };
  }, [submitBlocker, t]);

  const handleSubmit = async () => {
    if (submitBlocker !== null || selectedConnection === null || normalizedValidatedPath === null) {
      return;
    }

    setIsPathValidationPending(true);
    try {
      const response = await readRemoteWorkspaceDirectoryEntries({
        hostId: selectedConnection.hostId,
        directoryPath: normalizedValidatedPath,
        directoriesOnly: true,
      });
      const normalizedRoundTripPath = normalizeRemoteProjectPath(response.directoryPath);
      if (normalizedRoundTripPath === null || normalizedRoundTripPath !== normalizedValidatedPath) {
        setValidationErrorPath(normalizedValidatedPath);
        return;
      }
      setValidationErrorPath(null);
      setValidatedDirectoryPath(response.directoryPath);
      await onSave({
        hostId: selectedConnection.hostId,
        remotePath: response.directoryPath,
      });
    } catch {
      setValidationErrorPath(normalizedValidatedPath);
    } finally {
      setIsPathValidationPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="app-card w-full max-w-[460px] rounded-[18px] px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="text-[18px] font-medium text-token-text-primary">{t("projectSetupDialog.title")}</div>
        <div className="mt-2 text-[13px] leading-6 text-token-text-secondary">
          {connectedRemoteConnections.length > 0
            ? t("projectSetupDialog.description")
            : t("projectSetupDialog.description.noConnectedRemotes")}
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-token-text-primary">{t("workspaceRootDialog.remoteLabel")}</span>
            <div className="relative">
              <button
                type="button"
                disabled={connectedRemoteConnections.length === 0 || isSaving}
                onClick={() => setIsHostMenuOpen((open) => !open)}
                className="app-control flex h-10 w-full items-center justify-between gap-2 rounded-[12px] border border-token-border bg-token-bg-fog px-3 text-[13px] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {selectedConnection ? (
                    <SettingsRemoteHostIcon
                      className="h-4 w-4 shrink-0"
                      hostId={selectedConnection.hostId}
                      hostIdsForColorAssignment={connectedHostIds}
                    />
                  ) : null}
                  <span
                    className={[
                      "truncate text-left",
                      selectedConnection ? "text-token-text-primary" : "text-token-text-secondary",
                    ].join(" ")}
                  >
                    {selectedConnection?.displayName ?? t("workspaceRootDialog.remotePlaceholder")}
                  </span>
                </span>
                <span className="h-3.5 w-3.5 shrink-0 text-token-text-secondary">⌄</span>
              </button>
              {isHostMenuOpen ? (
                <div className="app-card absolute top-[calc(100%+8px)] left-0 right-0 z-20 rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <div className="max-h-40 overflow-y-auto">
                    {connectedRemoteConnections.length === 0 ? (
                      <div className="px-3 py-2 text-[13px] text-token-text-secondary">
                        {t("workspaceRootDialog.remoteEmpty")}
                      </div>
                    ) : (
                      connectedRemoteConnections.map((remoteConnection) => {
                        const isSelected = remoteConnection.hostId === selectedHostId;
                        return (
                          <button
                            key={remoteConnection.hostId}
                            type="button"
                            onClick={() => {
                              setIsHostMenuOpen(false);
                              if (selectedHostId === remoteConnection.hostId) {
                                return;
                              }
                              setSelectedHostId(remoteConnection.hostId);
                              setRemotePath("");
                              setValidatedDirectoryPath(null);
                              setValidationErrorPath(null);
                            }}
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
                              isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                            ].join(" ")}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <SettingsRemoteHostIcon
                                className="h-4 w-4 shrink-0"
                                hostId={remoteConnection.hostId}
                                hostIdsForColorAssignment={connectedHostIds}
                              />
                              <span className="truncate">{remoteConnection.displayName}</span>
                            </span>
                            {isSelected ? <span className="text-token-text-secondary">✓</span> : null}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-token-text-primary">{t("workspaceRootDialog.pathLabel")}</span>
            <input
              value={remotePath}
              disabled={connectedRemoteConnections.length === 0 || isSaving}
              onChange={(event) => {
                setRemotePath(event.target.value);
                setValidatedDirectoryPath(null);
                setValidationErrorPath(null);
              }}
              className="app-control app-text-input w-full rounded-[12px] px-3 py-2 text-[13px] outline-none disabled:opacity-60"
            />
          </label>

          <div className="text-[13px] leading-6 text-token-text-secondary">
            {t("projectSetupDialog.remoteMode.standalone.description")}
          </div>
        </div>

        <div className="mt-4 min-h-5">
          {submitBlocker?.kind === "path-validation-pending" ? (
            <div className="flex items-center gap-2 text-sm text-token-text-secondary">
              <Spinner className="icon-xs" />
            </div>
          ) : notice ? (
            <div className={`text-sm leading-5 ${notice.toneClassName}`}>{notice.message}</div>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <Button color="ghost" disabled={isSaving} onClick={onClose} size="composer">
            {t("workspaceRootDialog.cancel")}
          </Button>
          <Button
            color="primary"
            disabled={submitBlocker !== null}
            loading={isSaving}
            onClick={() => void handleSubmit()}
            size="composer"
          >
            {t("workspaceRootDialog.confirmAdd")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function isConflictingRemoteProject(
  remoteProjects: RemoteProject[],
  hostId: string,
  remotePath: string,
) {
  const normalizedRemotePath = normalizeRemoteProjectPath(remotePath);
  if (normalizedRemotePath === null) {
    return null;
  }

  return (
    remoteProjects.find((remoteProject) => {
      return (
        remoteProject.hostId === hostId &&
        normalizeRemoteProjectPath(remoteProject.remotePath) === normalizedRemotePath
      );
    }) ?? null
  );
}

export function getRemoteProjectDisplayLabel(remotePath: string) {
  return getRemoteProjectLabel(remotePath);
}
