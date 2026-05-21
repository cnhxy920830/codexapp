import { useEffect, useMemo, useState } from "react";
import { REPLICA_STATSIG_GATES, useReplicaStatsigGateValue } from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import {
  readChroniclePermissions,
  type ChroniclePermissionsResponse,
  type ChroniclePermissionStatus,
  type ChronicleSidecarProcessState,
} from "../services/personalization";
import { getGlobalState, setGlobalState } from "../services/settings";
import { SettingsDialog, SettingsDialogFooter } from "./SettingsDialog";
import { Button } from "./Button";
import { SettingsRow } from "./SettingsRow";
import { Tooltip } from "./Tooltip";
import { ToggleSwitch } from "./ToggleSwitch";

const CHRONICLE_DOCS_URL = "https://developers.openai.com/codex/memories/chronicle";
const CHRONICLE_PROMPT = "Describe what I'm working on right now and suggest how I can use Codex to help.";
const CHRONICLE_CONSENT_ACCEPTED_KEY = "chronicle-consent-accepted";
const CHRONICLE_SETUP_COMPLETION_PENDING_KEY = "chronicle-setup-completion-pending";
const SIDECAR_MISSING_MESSAGE = "Chronicle sidecar binary is missing from app resources.";

type ChronicleSetupState =
  | { kind: "preparing" }
  | { kind: "starting" }
  | {
      kind: "screen-recording-permission-needed";
      status: ChroniclePermissionStatus;
    }
  | {
      kind: "accessibility-permission-needed";
      status: ChroniclePermissionStatus;
    }
  | { kind: "ready" }
  | { kind: "failed"; message: string };

export function PersonalizationChronicleSettings({
  checked,
  disabled,
  memoriesEnabled,
  onOpenChatWithPrompt,
  onSetEnabled,
}: {
  checked: boolean;
  disabled: boolean;
  memoriesEnabled: boolean;
  onOpenChatWithPrompt?: (prompt: string) => void;
  onSetEnabled: (enabled: boolean) => Promise<void>;
}) {
  const { t } = useI18n();
  const chronicleGateEnabled = useReplicaStatsigGateValue(REPLICA_STATSIG_GATES.chronicle);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isLoadingConsent, setIsLoadingConsent] = useState(true);
  const [isConsentDialogOpen, setIsConsentDialogOpen] = useState(false);
  const [isSetupDialogOpen, setIsSetupDialogOpen] = useState(false);
  const [isUpdatingChronicle, setIsUpdatingChronicle] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const [permissionsRefreshVersion, setPermissionsRefreshVersion] = useState(0);
  const [permissionsState, setPermissionsState] = useState<{
    data: ChroniclePermissionsResponse | null;
    isLoading: boolean;
  }>({
    data: null,
    isLoading: false,
  });

  useEffect(() => {
    let cancelled = false;

    void getGlobalState(CHRONICLE_CONSENT_ACCEPTED_KEY)
      .then((response) => {
        if (!cancelled) {
          setConsentAccepted(response.value === true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConsentAccepted(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConsent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!chronicleGateEnabled) {
      setPermissionsState({
        data: null,
        isLoading: false,
      });
      return;
    }

    let cancelled = false;
    let isInFlight = false;

    const loadPermissions = async () => {
      if (isInFlight) {
        return;
      }
      isInFlight = true;
      try {
        const nextPermissions = await readChroniclePermissions();
        if (!cancelled) {
          setPermissionsState({
            data: nextPermissions,
            isLoading: false,
          });
        }
      } catch {
        if (!cancelled) {
          setPermissionsState((current) => ({
            data: current.data,
            isLoading: false,
          }));
        }
      } finally {
        isInFlight = false;
      }
    };

    setPermissionsState((current) => ({
      data: current.data,
      isLoading: current.data === null,
    }));
    void loadPermissions();
    const intervalId = window.setInterval(() => {
      void loadPermissions();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [chronicleGateEnabled, permissionsRefreshVersion]);

  const permissions = permissionsState.data;
  const shouldShowChronicle = chronicleGateEnabled && permissions?.chronicleSidecarPresent === true;
  const isBusy = disabled || isLoadingConsent || isUpdatingChronicle;
  const setupState = useMemo(
    () =>
      deriveChronicleSetupState({
        accessibilityStatus: permissions?.accessibility,
        errorMessage: enableError,
        isSidecarPresent: permissions?.chronicleSidecarPresent === true,
        isUpdatingChronicle,
        processState: permissions?.chronicleSidecarProcessState ?? "disabled",
        screenRecordingStatus: permissions?.screenRecording,
      }),
    [enableError, isUpdatingChronicle, permissions],
  );

  useEffect(() => {
    if (!isSetupDialogOpen || !isSetupCompletionState(setupState.kind)) {
      return;
    }

    void setGlobalState(CHRONICLE_SETUP_COMPLETION_PENDING_KEY, true).catch(() => undefined);
  }, [isSetupDialogOpen, setupState.kind]);

  if (!shouldShowChronicle) {
    return null;
  }

  const chronicleDisplayName = t("settings.general.experimentalFeatures.chronicle.name");
  const chronicleToggleDisabled = isBusy || !memoriesEnabled;
  const reloadPermissions = () => {
    setPermissionsRefreshVersion((current) => current + 1);
  };

  const setSetupPending = async (value: boolean) => {
    await setGlobalState(CHRONICLE_SETUP_COMPLETION_PENDING_KEY, value);
  };

  const handleEnableChronicle = async ({
    rememberConsentAccepted,
    showSetupDialog,
  }: {
    rememberConsentAccepted: boolean;
    showSetupDialog: boolean;
  }) => {
    setIsUpdatingChronicle(true);
    setEnableError(null);
    setIsConsentDialogOpen(false);
    setIsSetupDialogOpen(showSetupDialog);

    try {
      if (rememberConsentAccepted) {
        await setGlobalState(CHRONICLE_CONSENT_ACCEPTED_KEY, true);
        setConsentAccepted(true);
      }
      if (!showSetupDialog) {
        await setSetupPending(false);
      }
      await onSetEnabled(true);
      reloadPermissions();
    } catch (error) {
      await setSetupPending(false).catch(() => undefined);
      setEnableError(resolveErrorMessage(error));
    } finally {
      setIsUpdatingChronicle(false);
    }
  };

  const handleDisableChronicle = async () => {
    setIsUpdatingChronicle(true);
    setEnableError(null);
    try {
      await setSetupPending(false);
      await onSetEnabled(false);
      reloadPermissions();
    } finally {
      setIsUpdatingChronicle(false);
    }
  };

  const handleToggleChange = (enabled: boolean) => {
    if (!enabled) {
      void handleDisableChronicle();
      return;
    }
    if (consentAccepted) {
      void handleEnableChronicle({
        rememberConsentAccepted: false,
        showSetupDialog: false,
      });
      return;
    }
    setEnableError(null);
    setIsConsentDialogOpen(true);
  };

  const handleSetupDialogOpenChange = (open: boolean) => {
    if (!open) {
      void setSetupPending(false).catch(() => undefined);
    }
    setIsSetupDialogOpen(open);
  };

  const handleAskCodex = () => {
    void setSetupPending(false).catch(() => undefined);
    setIsSetupDialogOpen(false);
    onOpenChatWithPrompt?.(CHRONICLE_PROMPT);
  };

  return (
    <>
      <SettingsRow
        label={chronicleDisplayName}
        description={
          <ChronicleDescription
            checked={checked}
            permissions={permissions}
            isChecking={permissionsState.isLoading}
            onOpenSetup={() => {
              setEnableError(null);
              setIsSetupDialogOpen(true);
            }}
          />
        }
        control={
          <Tooltip
            disabled={memoriesEnabled}
            tooltipContent={t("settings.general.experimentalFeatures.chronicle.memoriesRequiredTooltip")}
          >
            <span className={memoriesEnabled ? "inline-flex" : "inline-flex cursor-not-allowed"} tabIndex={memoriesEnabled ? undefined : 0}>
              <ToggleSwitch
                checked={checked}
                disabled={chronicleToggleDisabled}
                className={memoriesEnabled ? undefined : "pointer-events-none"}
                ariaLabel={t("settings.general.experimentalFeatures.chronicle.buttonAriaLabel", {
                  featureName: chronicleDisplayName,
                })}
                onChange={handleToggleChange}
              />
            </span>
          </Tooltip>
        }
      />

      {isConsentDialogOpen ? (
        <ChronicleConsentDialog
          chronicleDisplayName={chronicleDisplayName}
          isPending={isBusy}
          onCancel={() => setIsConsentDialogOpen(false)}
          onContinue={() =>
            void handleEnableChronicle({
              rememberConsentAccepted: true,
              showSetupDialog: true,
            })
          }
        />
      ) : null}

      {isSetupDialogOpen ? (
        <ChronicleSetupDialog
          open={isSetupDialogOpen}
          setupState={setupState}
          onAskCodex={handleAskCodex}
          onClose={() => handleSetupDialogOpenChange(false)}
        />
      ) : null}
    </>
  );
}

function ChronicleDescription({
  checked,
  permissions,
  isChecking,
  onOpenSetup,
}: {
  checked: boolean;
  permissions: ChroniclePermissionsResponse | null;
  isChecking: boolean;
  onOpenSetup: () => void;
}) {
  const { t } = useI18n();

  return (
    <span className="flex min-w-0 flex-col gap-1.5">
      <span>
        {renderInlineLinkMessage(
          t("settings.general.experimentalFeatures.chronicle.description"),
          CHRONICLE_DOCS_URL,
        )}
      </span>
      {checked ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <ChronicleStatusText
            accessibilityStatus={permissions?.accessibility}
            isChecking={isChecking}
            processState={permissions?.chronicleSidecarProcessState}
            screenRecordingStatus={permissions?.screenRecording}
            onOpenSetup={onOpenSetup}
          />
        </span>
      ) : null}
    </span>
  );
}

function ChronicleConsentDialog({
  isPending,
  chronicleDisplayName,
  onCancel,
  onContinue,
}: {
  isPending: boolean;
  chronicleDisplayName: string;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const { t } = useI18n();

  return (
    <SettingsDialog
      footer={
        <SettingsDialogFooter
          cancelLabel={t("settings.general.experimentalFeatures.chronicle.cancel")}
          confirmLabel={t("settings.general.experimentalFeatures.chronicle.continue")}
          confirmLoading={isPending}
          onCancel={onCancel}
          onConfirm={onContinue}
        />
      }
      onOpenChange={(open) => {
        if (!open) {
          onCancel();
        }
      }}
      open
      title={t("settings.general.experimentalFeatures.chronicle.consentTitle")}
    >
      <h2 className="sr-only">{chronicleDisplayName}</h2>
      <div className="max-h-[calc(100vh-6rem)] min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 text-token-foreground/70">
        <p>{t("settings.general.experimentalFeatures.chronicle.consentBodyIntro")}</p>
        <p>{t("settings.general.experimentalFeatures.chronicle.consentBodyConsiderations")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{renderStrongMessage(t("settings.general.experimentalFeatures.chronicle.consentBodyCost"))}</li>
          <li>{renderStrongMessage(t("settings.general.experimentalFeatures.chronicle.consentBodyPrivacy"))}</li>
          <li>{renderStrongMessage(t("settings.general.experimentalFeatures.chronicle.consentBodyPromptInjection"))}</li>
        </ul>
        <p>{t("settings.general.experimentalFeatures.chronicle.consentBodyStorageHeading")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("settings.general.experimentalFeatures.chronicle.consentBodyStorageProcessing")}</li>
          <li>{t("settings.general.experimentalFeatures.chronicle.consentBodyStorageLocal")}</li>
        </ul>
        <p>
          {renderInlineLinkMessage(
            t("settings.general.experimentalFeatures.chronicle.consentBodyDisableIntro"),
            CHRONICLE_DOCS_URL,
          )}
        </p>
      </div>
    </SettingsDialog>
  );
}

function ChronicleSetupDialog({
  open,
  setupState,
  onAskCodex,
  onClose,
}: {
  open: boolean;
  setupState: ChronicleSetupState;
  onAskCodex: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const title = resolveSetupTitle(setupState, t);

  if (!open) {
    return null;
  }

  const subtitle = resolveSetupSubtitle(setupState, t);
  const body = resolveSetupBody(setupState, t);
  const footer = resolveSetupFooter({
    onAskCodex,
    onClose,
    setupState,
    t,
  });

  return (
    <SettingsDialog
      footer={footer}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      open={open}
      title={title}
      subtitle={subtitle || undefined}
    >
      <div className="space-y-3 text-[13px] leading-6 text-token-text-secondary">
        {body}
        {setupState.kind === "failed" ? (
          <p className="text-[var(--app-shell-danger,#b42318)]">{setupState.message}</p>
        ) : null}
      </div>
    </SettingsDialog>
  );
}

function ChronicleStatusText({
  accessibilityStatus,
  isChecking,
  onOpenSetup,
  processState,
  screenRecordingStatus,
}: {
  accessibilityStatus: ChroniclePermissionStatus | undefined;
  isChecking: boolean;
  onOpenSetup: () => void;
  processState: ChronicleSidecarProcessState | undefined;
  screenRecordingStatus: ChroniclePermissionStatus | undefined;
}) {
  const { t } = useI18n();
  const missingPermission = getMissingPermissionLabel(t, {
    accessibilityStatus,
    screenRecordingStatus,
  });

  if (!isChecking && missingPermission) {
    return (
      <button
        type="button"
        onClick={onOpenSetup}
        className="min-w-0 border-0 bg-transparent p-0 text-left text-[var(--app-shell-danger,#b42318)] underline underline-offset-2"
      >
        {t("settings.general.experimentalFeatures.chronicle.permission.notGranted", {
          permission: missingPermission,
          statusLabel: t("settings.general.experimentalFeatures.chronicle.permission.statusLabel"),
        })}
      </button>
    );
  }

  if (!isChecking && screenRecordingStatus === "granted") {
    const processLabel = resolveProcessStateLabel(t, processState);

    return (
      <span className="min-w-0 truncate">
        {t("settings.general.experimentalFeatures.chronicle.permission.runningStatus", {
          status: processLabel,
        })}
        {accessibilityStatus !== "granted" ? (
          <>
            {"; "}
            <button
              type="button"
              onClick={onOpenSetup}
              className="border-0 bg-transparent p-0 underline underline-offset-2"
            >
              {t("settings.general.experimentalFeatures.chronicle.permission.runningStatusAccessibility", {
                status: renderPermissionStatusText(t, isChecking, accessibilityStatus),
              })}
            </button>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <span className="min-w-0 truncate">
      {t("settings.general.experimentalFeatures.chronicle.permission.status", {
        permission: t("settings.general.experimentalFeatures.chronicle.permission.screenRecording"),
        status: renderPermissionStatusText(t, isChecking, screenRecordingStatus),
      })}
    </span>
  );
}

function renderStrongMessage(template: string) {
  const match = template.match(/^(.*)<strong>(.*)<\/strong>(.*)$/);
  if (!match) {
    return template;
  }

  const [, prefix, emphasizedText, suffix] = match;
  return (
    <>
      {prefix}
      <strong className="font-semibold text-[var(--app-shell-text)]">{emphasizedText}</strong>
      {suffix}
    </>
  );
}

function resolveSetupTitle(
  setupState: ChronicleSetupState,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (setupState.kind) {
    case "ready":
      return t("settings.general.experimentalFeatures.chronicle.setupReadyTitle");
    case "failed":
      return t("settings.general.experimentalFeatures.chronicle.setupFailedTitle");
    case "screen-recording-permission-needed":
      return t("settings.general.experimentalFeatures.chronicle.setupScreenRecordingPermissionNeededTitle");
    case "accessibility-permission-needed":
      return t("settings.general.experimentalFeatures.chronicle.setupAccessibilityPermissionNeededTitle");
    case "preparing":
    case "starting":
      return t("settings.general.experimentalFeatures.chronicle.setupInProgressTitle");
  }
}

function resolveSetupSubtitle(
  setupState: ChronicleSetupState,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  if (setupState.kind === "preparing" || setupState.kind === "starting") {
    return t("settings.general.experimentalFeatures.chronicle.setupWaiting");
  }
  return "";
}

function resolveSetupBody(
  setupState: ChronicleSetupState,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  switch (setupState.kind) {
    case "preparing":
    case "starting":
      return null;
    case "screen-recording-permission-needed":
      if (setupState.status === "restricted") {
        return <p>{t("settings.general.experimentalFeatures.chronicle.setupScreenRecordingRestricted")}</p>;
      }
      return <p>{t("settings.general.experimentalFeatures.chronicle.setupScreenRecordingDenied", { bundleName: "Codex" })}</p>;
    case "accessibility-permission-needed":
      if (setupState.status === "restricted") {
        return <p>{t("settings.general.experimentalFeatures.chronicle.setupAccessibilityRestricted")}</p>;
      }
      return <p>{t("settings.general.experimentalFeatures.chronicle.setupAccessibilityDenied", { bundleName: "Codex" })}</p>;
    case "ready":
      return <p>{t("settings.general.experimentalFeatures.chronicle.setupReady")}</p>;
    case "failed":
      return <p>{t("settings.general.experimentalFeatures.chronicle.setupFailed")}</p>;
  }
}

function resolveSetupFooter({
  onAskCodex,
  onClose,
  setupState,
  t,
}: {
  onAskCodex: () => void;
  onClose: () => void;
  setupState: ChronicleSetupState;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  switch (setupState.kind) {
    case "screen-recording-permission-needed":
      return <button type="button" onClick={() => undefined} className="app-control rounded-[11px] px-3 py-1.5 text-[12px]">{t("settings.general.experimentalFeatures.chronicle.openScreenRecordingSettings")}</button>;
    case "accessibility-permission-needed":
      return <button type="button" onClick={() => undefined} className="app-control rounded-[11px] px-3 py-1.5 text-[12px]">{t("settings.general.experimentalFeatures.chronicle.openAccessibilitySettings")}</button>;
    case "ready":
      return (
        <Button color="primary" onClick={onAskCodex}>
          {t("settings.general.experimentalFeatures.chronicle.askCodex")}
        </Button>
      );
    case "failed":
      return (
        <Button color="ghost" onClick={onClose}>
          {t("settings.general.experimentalFeatures.chronicle.setupClose")}
        </Button>
      );
    case "preparing":
    case "starting":
      return null;
  }
}

function deriveChronicleSetupState({
  accessibilityStatus,
  errorMessage,
  isSidecarPresent,
  isUpdatingChronicle,
  processState,
  screenRecordingStatus,
}: {
  accessibilityStatus: ChroniclePermissionStatus | undefined;
  errorMessage: string | null;
  isSidecarPresent: boolean;
  isUpdatingChronicle: boolean;
  processState: ChronicleSidecarProcessState;
  screenRecordingStatus: ChroniclePermissionStatus | undefined;
}): ChronicleSetupState {
  if (errorMessage) {
    return {
      kind: "failed",
      message: errorMessage,
    };
  }
  if (isUpdatingChronicle) {
    return { kind: "preparing" };
  }
  if (!isSidecarPresent) {
    return {
      kind: "failed",
      message: SIDECAR_MISSING_MESSAGE,
    };
  }
  if (isPermissionMissing(screenRecordingStatus)) {
    return {
      kind: "screen-recording-permission-needed",
      status: screenRecordingStatus,
    };
  }
  if (isPermissionMissing(accessibilityStatus)) {
    return {
      kind: "accessibility-permission-needed",
      status: accessibilityStatus,
    };
  }
  if (
    processState === "running" &&
    accessibilityStatus === "granted" &&
    screenRecordingStatus === "granted"
  ) {
    return { kind: "ready" };
  }
  return { kind: "starting" };
}

function isPermissionMissing(status: ChroniclePermissionStatus | undefined): status is ChroniclePermissionStatus {
  return status !== undefined && status !== "granted";
}

function isSetupCompletionState(kind: ChronicleSetupState["kind"]) {
  return kind === "screen-recording-permission-needed" || kind === "accessibility-permission-needed" || kind === "ready";
}

function getMissingPermissionLabel(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  {
  accessibilityStatus,
  screenRecordingStatus,
}: {
  accessibilityStatus: ChroniclePermissionStatus | undefined;
  screenRecordingStatus: ChroniclePermissionStatus | undefined;
}) {
  if (screenRecordingStatus === "denied") {
    return t("settings.general.experimentalFeatures.chronicle.permission.screenRecording");
  }
  if (screenRecordingStatus === "granted" && accessibilityStatus === "denied") {
    return t("settings.general.experimentalFeatures.chronicle.permission.accessibility");
  }
  return null;
}

function resolveProcessStateLabel(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  processState: ChronicleSidecarProcessState | undefined,
) {
  switch (processState) {
    case "running":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.running");
    case "starting":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.starting");
    case "stopping":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.stopping");
    case "disabled":
    case "failed":
    case undefined:
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.paused");
  }
}

function renderPermissionStatusText(
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
  isChecking: boolean,
  status: ChroniclePermissionStatus | undefined,
) {
  if (isChecking) {
    return t("settings.general.experimentalFeatures.chronicle.permissionStatus.checking");
  }
  switch (status) {
    case "granted":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.granted");
    case "not-determined":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.notDetermined");
    case "denied":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.denied");
    case "restricted":
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.restricted");
    case "unknown":
    case undefined:
      return t("settings.general.experimentalFeatures.chronicle.permissionStatus.unknown");
  }
}

function resolveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to enable Chronicle";
}
