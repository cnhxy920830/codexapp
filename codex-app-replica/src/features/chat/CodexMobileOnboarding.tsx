import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppToast } from "../../components/AppToastRegion";
import { Button } from "../../components/Button";
import { ToggleSwitch } from "../../components/ToggleSwitch";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import {
  getPluginCandidateDescription,
  getPluginCandidateDisplayName,
  selectPluginCandidatesByName,
  type PluginCandidate,
} from "../../lib/pluginSelectors";
import { openInBrowser, readFileText } from "../../services/hostFiles";
import { readAppsSnapshot } from "../../services/apps";
import {
  listExperimentalFeatures,
  setExperimentalFeatureEnablement,
} from "../../services/personalization";
import {
  hasConnectedRemoteControlClients,
  readRemoteControlMfaRequiredButDisabled,
} from "../../services/remoteControl";
import {
  getGlobalState,
  readConfigForHost,
  readPreventSleepWhileRunningPreference,
  setGlobalState,
} from "../../services/settings";
import {
  installPlugin,
  readPlugin,
  readPluginsSnapshot,
  setPluginEnabled,
  type PluginDetail,
  type PluginInstallResponse,
  type PluginListSnapshot,
  type PluginAppSummary,
} from "../../services/plugins";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../statsig/replicaStatsig";

const REMOTE_CONTROL_FEATURE_NAME = "remote_control";
const COMPUTER_USE_PLUGIN_NAMES = ["computer-use"] as const;
const CHROME_PLUGIN_NAMES = ["chrome-internal", "chrome"] as const;
const CHROME_EXTENSION_ID_RELATIVE_PATH = "scripts/extension-id.json";
const CHROME_EXTENSION_INSTALL_URL_PREFIX =
  "https://chromewebstore.google.com/detail/codex/";
const SECURITY_SETTINGS_URL = "https://chatgpt.com/#settings/Security";
const WINDOWS_PLATFORM_TOKEN = "Windows";
const LOCAL_HOST_ID = "local";

type SetupStep = "initial" | "allow-host" | "mfa-required" | "waiting" | "connected";
type PluginInstallIntent = "computerUseEnable" | "chromeExtension";
type InstallModalPhase = "details" | "needsApps";

type HomeBannerProps = {
  onDismiss: () => void;
  onSetUp: () => void;
};

type SetupDialogProps = {
  computerUseEnabled: boolean;
  computerUseToggleDisabled: boolean;
  installModal: ReactNode;
  keepComputerAwake: boolean;
  keepComputerAwakeToggleDisabled: boolean;
  onAllowHost: () => void;
  onComputerUseEnabledChange: (enabled: boolean) => void;
  onContinueOnChatGpt: () => void;
  onFinishSetup: () => void;
  onInstallChromeExtension: (() => void) | null;
  onKeepComputerAwakeChange: (enabled: boolean) => void;
  onOpenChange: (open: boolean) => void;
  onSkip: () => void;
  onStartSetup: () => void;
  open: boolean;
  setupInProgress: boolean;
  showKeepComputerAwake: boolean;
  showStartSetupError: boolean;
  step: SetupStep;
};

type ConnectedSettingsState = {
  computerUseEnabled: boolean;
  computerUseToggleDisabled: boolean;
  installModal: ReactNode;
  keepComputerAwake: boolean;
  keepComputerAwakeToggleDisabled: boolean;
  onComputerUseEnabledChange: (enabled: boolean) => void;
  onInstallChromeExtension: (() => void) | null;
  onKeepComputerAwakeChange: (enabled: boolean) => void;
  showKeepComputerAwake: boolean;
};

type ChromeExtensionSetup = {
  extensionId: string;
  installUrl: string;
};

type PluginInstallRequest = {
  candidate: PluginCandidate;
  intent: PluginInstallIntent;
};

type RequiredAppState = {
  appId: string;
  description: string | null;
  installUrl: string | null;
  name: string;
  status: "connected" | "launching" | "pending";
};

type RequiredBrowserExtensionState = {
  id: string;
  installUrl: string;
  name: string;
};

type InstallModalState = {
  detail: PluginDetail | null;
  phase: InstallModalPhase;
  request: PluginInstallRequest;
  requiredApps: RequiredAppState[];
  requiredBrowserExtensions: RequiredBrowserExtensionState[];
};

export function CodexMobileOnboarding({
  onShowToast,
}: {
  onShowToast?: (toast: AppToast) => void;
}) {
  const [hasSeenBanner, setHasSeenBanner] = useState<boolean | null>(null);
  const [remoteControlFeatureEnabled, setRemoteControlFeatureEnabled] =
    useState<boolean | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>("initial");
  const [showStartSetupError, setShowStartSetupError] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);

  const codexMobileHomeBannerEnabled = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.codexMobileHomeBanner,
  );
  const remoteVisibilityEnabled = useCodexMobileRemoteVisibility();

  useEffect(() => {
    let cancelled = false;

    const loadState = async () => {
      try {
        const [features, seenResponse] = await Promise.all([
          listExperimentalFeatures(),
          getGlobalState("has-seen-codex-mobile-home-announcement"),
        ]);
        if (cancelled) {
          return;
        }
        setHasSeenBanner(seenResponse.value === true);
        setRemoteControlFeatureEnabled(
          features.find((feature) => feature.name === REMOTE_CONTROL_FEATURE_NAME)
            ?.enabled ?? null,
        );
      } catch {
        if (!cancelled) {
          setHasSeenBanner(false);
          setRemoteControlFeatureEnabled(null);
        }
      }
    };

    void loadState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isDialogOpen || setupStep !== "waiting") {
      return;
    }

    let cancelled = false;
    const interval = window.setInterval(() => {
      void hasConnectedRemoteControlClients()
        .then((hasConnectedClients) => {
          if (!cancelled && hasConnectedClients) {
            setSetupStep("connected");
          }
        })
        .catch(() => undefined);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isDialogOpen, setupStep]);

  const connectedSettings = useConnectedSettings({
    enabled: isDialogOpen || setupStep === "connected",
    onShowToast,
  });
  const shouldShowBanner =
    hasSeenBanner === false &&
    codexMobileHomeBannerEnabled &&
    remoteVisibilityEnabled &&
    remoteControlFeatureEnabled === false;

  const handleDismissBanner = async () => {
    await markBannerSeen();
    setHasSeenBanner(true);
  };

  const handleOpenSetup = () => {
    setSetupStep("initial");
    setShowStartSetupError(false);
    setIsDialogOpen(true);
  };

  const handleStartSetup = async () => {
    setSetupInProgress(true);
    setShowStartSetupError(false);
    try {
      const response = await readRemoteControlMfaRequiredButDisabled();
      setSetupStep(response.mfaRequiredButDisabled ? "mfa-required" : "allow-host");
    } catch {
      setShowStartSetupError(true);
    } finally {
      setSetupInProgress(false);
    }
  };

  const handleAllowHost = async () => {
    setSetupInProgress(true);
    try {
      const hasConnectedClients = await hasConnectedRemoteControlClients();
      await setExperimentalFeatureEnablement({
        [REMOTE_CONTROL_FEATURE_NAME]: true,
      });
      setRemoteControlFeatureEnabled(true);
      setSetupStep(hasConnectedClients ? "connected" : "waiting");
    } finally {
      setSetupInProgress(false);
    }
  };

  const handleFinishSetup = async () => {
    await Promise.all([
      setGlobalState("has-completed-codex-mobile-setup", true),
      setGlobalState("has-seen-codex-mobile-home-announcement", true),
    ]);
    setHasSeenBanner(true);
    setIsDialogOpen(false);
  };

  const handleSkip = async () => {
    await markBannerSeen();
    setHasSeenBanner(true);
    setIsDialogOpen(false);
  };

  async function markBannerSeen() {
    await setGlobalState("has-seen-codex-mobile-home-announcement", true);
  }

  if (hasSeenBanner == null || remoteControlFeatureEnabled == null) {
    return <BlankHomeHero />;
  }

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-5 px-5 py-10">
        <BlankHomeHero />
        {shouldShowBanner ? (
          <HomeBanner
            onDismiss={() => void handleDismissBanner()}
            onSetUp={handleOpenSetup}
          />
        ) : null}
      </div>
      <SetupDialog
        computerUseEnabled={connectedSettings.computerUseEnabled}
        computerUseToggleDisabled={connectedSettings.computerUseToggleDisabled}
        installModal={connectedSettings.installModal}
        keepComputerAwake={connectedSettings.keepComputerAwake}
        keepComputerAwakeToggleDisabled={
          connectedSettings.keepComputerAwakeToggleDisabled
        }
        onAllowHost={() => void handleAllowHost()}
        onComputerUseEnabledChange={(enabled) =>
          void connectedSettings.onComputerUseEnabledChange(enabled)
        }
        onContinueOnChatGpt={() => void openInBrowser(SECURITY_SETTINGS_URL)}
        onFinishSetup={() => void handleFinishSetup()}
        onInstallChromeExtension={connectedSettings.onInstallChromeExtension}
        onKeepComputerAwakeChange={(enabled) =>
          void connectedSettings.onKeepComputerAwakeChange(enabled)
        }
        onOpenChange={setIsDialogOpen}
        onSkip={() => void handleSkip()}
        onStartSetup={() => void handleStartSetup()}
        open={isDialogOpen}
        setupInProgress={setupInProgress}
        showKeepComputerAwake={connectedSettings.showKeepComputerAwake}
        showStartSetupError={showStartSetupError}
        step={setupStep}
      />
    </>
  );
}

function useCodexMobileRemoteVisibility() {
  const remoteConnectionsVisibilityGate = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.remoteConnectionsHomeBanner,
  );
  const remoteControlVisibilityGate = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.remoteControlVisibility,
  );
  const [configRemoteConnectionsEnabled, setConfigRemoteConnectionsEnabled] =
    useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    void readConfigForHost({
      hostId: LOCAL_HOST_ID,
      includeLayers: false,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setConfigRemoteConnectionsEnabled(
          response.config.features?.remote_connections === true,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setConfigRemoteConnectionsEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    configRemoteConnectionsEnabled === true ||
    remoteConnectionsVisibilityGate ||
    remoteControlVisibilityGate
  );
}

function BlankHomeHero() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-token-foreground/[0.05] text-token-foreground shadow-[0_10px_24px_rgba(0,0,0,0.06)]">
        <CodexMobileGlyph className="h-8 w-8" />
      </div>
      <h1 className="text-[28px] font-medium tracking-[-0.03em] text-token-text-primary">
        {t("home.hero.letsBuild")}
      </h1>
    </div>
  );
}

function HomeBanner({ onDismiss, onSetUp }: HomeBannerProps) {
  const { t } = useI18n();

  return (
    <div className="app-card overflow-hidden rounded-[20px] border border-token-border shadow-[0_20px_60px_rgba(0,0,0,0.08)]">
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,rgba(255,201,60,0.85),rgba(255,236,190,0.65))] text-token-foreground">
          <CodexMobileGlyph className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium text-token-text-primary">
            {t("codexMobile.homeBanner.title")}
          </div>
          <div className="mt-1 text-[13px] leading-6 text-token-text-secondary">
            {t("codexMobile.homeBanner.body")}
          </div>
        </div>
        <button
          type="button"
          aria-label={t("codexMobile.homeBanner.dismiss")}
          className="app-control-weak shrink-0 rounded-full px-2 py-1 text-[12px]"
          onClick={onDismiss}
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-end gap-3 border-t border-token-border px-5 py-3">
        <Button size="toolbar" className="justify-center" onClick={onSetUp}>
          {t("codexMobile.homeBanner.primary")}
        </Button>
      </div>
    </div>
  );
}

export function SetupDialog({
  computerUseEnabled,
  computerUseToggleDisabled,
  installModal,
  keepComputerAwake,
  keepComputerAwakeToggleDisabled,
  onAllowHost,
  onComputerUseEnabledChange,
  onContinueOnChatGpt,
  onFinishSetup,
  onInstallChromeExtension,
  onKeepComputerAwakeChange,
  onOpenChange,
  onSkip,
  onStartSetup,
  open,
  setupInProgress,
  showKeepComputerAwake,
  showStartSetupError,
  step,
}: SetupDialogProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <>
      <DialogOverlay>
        <div
          aria-modal="true"
          role="dialog"
          aria-label={t(getDialogTitleKey(step))}
          className="app-card w-full max-w-[480px] overflow-hidden rounded-[16px] bg-token-bg-primary shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.1),0px_20px_25px_-5px_rgba(0,0,0,0.1)]"
        >
          <div className="relative h-[214px] overflow-hidden bg-token-foreground/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,214,102,0.95),transparent_42%),radial-gradient(circle_at_80%_18%,rgba(255,239,168,0.95),transparent_36%),linear-gradient(135deg,rgba(255,201,60,0.75),rgba(255,236,190,0.45))]" />
            <div className="absolute top-6 left-1/2 h-36 w-20 -translate-x-1/2 rounded-[24px] border-[5px] border-token-foreground bg-token-bg-primary shadow-lg">
              <div className="mx-auto mt-2 h-2 w-8 rounded-full bg-token-foreground" />
              <div className="mt-5 space-y-2 px-3">
                <div className="h-2 w-8 rounded-full bg-token-foreground/80" />
                <div className="h-2 w-12 rounded-full bg-token-foreground/15" />
                <div className="h-2 w-10 rounded-full bg-token-foreground/15" />
                <div className="h-2 w-11 rounded-full bg-token-foreground/15" />
              </div>
            </div>
            <button
              type="button"
              aria-label={t("codexMobile.setupDialog.close")}
              className="absolute top-[14px] right-[14px] cursor-interaction rounded p-0.5 text-token-description-foreground transition-opacity hover:opacity-80"
              onClick={() => onOpenChange(false)}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
          {step === "initial" ? (
            <InitialSetupStep
              onSkip={onSkip}
              onStartSetup={onStartSetup}
              setupInProgress={setupInProgress}
              showStartSetupError={showStartSetupError}
            />
          ) : null}
          {step === "allow-host" ? (
            <AllowHostStep
              onAllowHost={onAllowHost}
              setupInProgress={setupInProgress}
            />
          ) : null}
          {step === "mfa-required" ? (
            <MfaRequiredStep onContinueOnChatGpt={onContinueOnChatGpt} />
          ) : null}
          {step === "waiting" ? <WaitingStep /> : null}
          {step === "connected" ? (
            <ConnectedStep
              computerUseEnabled={computerUseEnabled}
              computerUseToggleDisabled={computerUseToggleDisabled}
              keepComputerAwake={keepComputerAwake}
              keepComputerAwakeToggleDisabled={keepComputerAwakeToggleDisabled}
              onComputerUseEnabledChange={onComputerUseEnabledChange}
              onFinishSetup={onFinishSetup}
              onInstallChromeExtension={onInstallChromeExtension}
              onKeepComputerAwakeChange={onKeepComputerAwakeChange}
              showKeepComputerAwake={showKeepComputerAwake}
            />
          ) : null}
        </div>
      </DialogOverlay>
      {installModal}
    </>
  );
}

function InitialSetupStep({
  onSkip,
  onStartSetup,
  setupInProgress,
  showStartSetupError,
}: {
  onSkip: () => void;
  onStartSetup: () => void;
  setupInProgress: boolean;
  showStartSetupError: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-6">
      <DialogHeading
        titleKey="codexMobile.setupDialog.initial.heading"
        descriptionKey="codexMobile.setupDialog.initial.description"
      />
      <div className="flex w-[380px] max-w-full flex-col gap-4">
        <FeatureRow
          icon={<GlobeThreadsIcon className="h-5 w-5" />}
          textKey="codexMobile.setupDialog.initial.feature.threads"
        />
        <FeatureRow
          icon={<CodexMobileGlyph className="h-5 w-5" />}
          textKey="codexMobile.setupDialog.initial.feature.notifications"
        />
        <FeatureRow
          icon={<SparkleActionsIcon className="h-5 w-5" />}
          textKey="codexMobile.setupDialog.initial.feature.actions"
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          color="secondary"
          size="large"
          className="justify-center"
          disabled={setupInProgress}
          onClick={onSkip}
        >
          {t("codexMobile.setupDialog.initial.skip")}
        </Button>
        <Button
          size="large"
          className="justify-center"
          loading={setupInProgress}
          onClick={onStartSetup}
        >
          {t("codexMobile.setupDialog.initial.primary")}
        </Button>
      </div>
      {showStartSetupError ? (
        <div className="text-sm text-token-text-error">
          {t("codexMobile.setupDialog.initial.startSetupError")}
        </div>
      ) : null}
    </div>
  );
}

function AllowHostStep({
  onAllowHost,
  setupInProgress,
}: {
  onAllowHost: () => void;
  setupInProgress: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-6">
      <DialogHeading
        titleKey="codexMobile.setupDialog.allowHost.heading"
        descriptionKey="codexMobile.setupDialog.allowHost.description"
      />
      <Button
        size="large"
        className="justify-center"
        loading={setupInProgress}
        onClick={onAllowHost}
      >
        {t("codexMobile.setupDialog.allowHost.primary")}
      </Button>
    </div>
  );
}

function MfaRequiredStep({
  onContinueOnChatGpt,
}: {
  onContinueOnChatGpt: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-6">
      <DialogHeading
        titleKey="codexMobile.setupDialog.mfaRequired.heading"
        descriptionKey="codexMobile.setupDialog.mfaRequired.description"
      />
      <Button
        size="large"
        className="justify-center"
        onClick={onContinueOnChatGpt}
      >
        {t("codexMobile.setupDialog.mfaRequired.primary")}
      </Button>
    </div>
  );
}

function WaitingStep() {
  return (
    <div className="flex flex-col items-center gap-4 px-8 py-6 text-center">
      <DialogHeading
        titleKey="codexMobile.setupDialog.waiting.heading"
        descriptionKey="codexMobile.setupDialog.waiting.description"
      />
    </div>
  );
}

function ConnectedStep({
  computerUseEnabled,
  computerUseToggleDisabled,
  keepComputerAwake,
  keepComputerAwakeToggleDisabled,
  onComputerUseEnabledChange,
  onFinishSetup,
  onInstallChromeExtension,
  onKeepComputerAwakeChange,
  showKeepComputerAwake,
}: {
  computerUseEnabled: boolean;
  computerUseToggleDisabled: boolean;
  keepComputerAwake: boolean;
  keepComputerAwakeToggleDisabled: boolean;
  onComputerUseEnabledChange: (enabled: boolean) => void;
  onFinishSetup: () => void;
  onInstallChromeExtension: (() => void) | null;
  onKeepComputerAwakeChange: (enabled: boolean) => void;
  showKeepComputerAwake: boolean;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center gap-6 px-8 py-6">
      <DialogHeading
        titleKey="codexMobile.setupDialog.connected.heading"
        descriptionKey="codexMobile.setupDialog.connected.description"
      />
      <div className="flex w-full flex-col gap-2">
        {showKeepComputerAwake ? (
          <ConnectedSettingsRow
            title={t("codexMobile.setupDialog.connected.keepAwake.title")}
            description={t("codexMobile.setupDialog.connected.keepAwake.description")}
            trailing={
              <ToggleSwitch
                ariaLabel={t("codexMobile.setupDialog.connected.keepAwake.toggle")}
                checked={keepComputerAwake}
                disabled={keepComputerAwakeToggleDisabled}
                onChange={onKeepComputerAwakeChange}
              />
            }
          />
        ) : null}
        <ConnectedSettingsRow
          title={t("codexMobile.setupDialog.connected.computerUse.title")}
          description={t("codexMobile.setupDialog.connected.computerUse.description")}
          trailing={
            <ToggleSwitch
              ariaLabel={t("codexMobile.setupDialog.connected.computerUse.toggle")}
              checked={computerUseEnabled}
              disabled={computerUseToggleDisabled}
              onChange={onComputerUseEnabledChange}
            />
          }
        />
        {onInstallChromeExtension ? (
          <ConnectedSettingsRow
            title={t("codexMobile.setupDialog.connected.chromeExtension.title")}
            description={t(
              "codexMobile.setupDialog.connected.chromeExtension.description",
            )}
            onClick={onInstallChromeExtension}
            trailing={<ArrowTopRightIcon className="h-4 w-4" />}
          />
        ) : null}
      </div>
      <Button size="large" className="justify-center" onClick={onFinishSetup}>
        {t("codexMobile.setupDialog.connected.finish")}
      </Button>
    </div>
  );
}

function DialogHeading({
  titleKey,
  descriptionKey,
}: {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-2 text-center">
      <div className="text-[22px] font-semibold tracking-[-0.03em] text-token-text-primary">
        {t(titleKey)}
      </div>
      <div className="text-base leading-normal tracking-normal text-token-description-foreground">
        {t(descriptionKey)}
      </div>
    </div>
  );
}

function FeatureRow({
  icon,
  textKey,
}: {
  icon: ReactNode;
  textKey: MessageKey;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-4 px-[10px] py-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center text-token-description-foreground">
        {icon}
      </div>
      <div className="text-left text-base leading-normal tracking-normal text-token-description-foreground">
        {t(textKey)}
      </div>
    </div>
  );
}

function ConnectedSettingsRow({
  description,
  onClick,
  title,
  trailing,
}: {
  description: string;
  onClick?: () => void;
  title: string;
  trailing: ReactNode;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <div className="text-sm text-token-text-primary">{title}</div>
        <div className="text-sm text-token-description-foreground">
          {description}
        </div>
      </div>
      <div className="shrink-0 text-token-description-foreground">{trailing}</div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className="flex cursor-interaction items-center justify-between gap-4 rounded-xl bg-token-foreground/[0.03] px-4 py-2.5 text-left"
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-token-foreground/[0.03] px-4 py-2.5">
      {content}
    </div>
  );
}

export function DialogOverlay({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      {children}
    </div>
  );
}

export function useConnectedSettings({
  enabled,
  onShowToast,
}: {
  enabled: boolean;
  onShowToast?: (toast: AppToast) => void;
}): ConnectedSettingsState {
  const { t } = useI18n();
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(
    null,
  );
  const [pluginsLoading, setPluginsLoading] = useState(false);
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);
  const [keepComputerAwake, setKeepComputerAwake] = useState(false);
  const [keepComputerAwakeLoading, setKeepComputerAwakeLoading] = useState(false);
  const [chromeExtensionSetup, setChromeExtensionSetup] =
    useState<ChromeExtensionSetup | null>(null);
  const [installModalState, setInstallModalState] =
    useState<InstallModalState | null>(null);
  const showKeepComputerAwake =
    typeof navigator === "undefined"
      ? false
      : !navigator.userAgent.includes(WINDOWS_PLATFORM_TOKEN);

  const showToast = (toast: AppToast) => {
    onShowToast?.(toast);
  };

  const loadPlugins = async () => {
    const snapshot = await readPluginsSnapshot(null, LOCAL_HOST_ID);
    setPluginsSnapshot(snapshot);
    const nextChromePlugin = selectChromePlugin(snapshot);
    if (nextChromePlugin?.plugin.installed === true) {
      setChromeExtensionSetup(await readChromeExtensionSetup(nextChromePlugin));
    } else {
      setChromeExtensionSetup(null);
    }
    return snapshot;
  };

  useEffect(() => {
    let cancelled = false;

    if (!enabled) {
      setPluginsSnapshot(null);
      setChromeExtensionSetup(null);
      setInstallModalState(null);
      return () => {
        cancelled = true;
      };
    }

    setPluginsLoading(true);
    void loadPlugins()
      .catch(() => {
        if (!cancelled) {
          setPluginsSnapshot(null);
          setChromeExtensionSetup(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPluginsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    let cancelled = false;

    if (!enabled || !showKeepComputerAwake) {
      setKeepComputerAwake(false);
      setKeepComputerAwakeLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setKeepComputerAwakeLoading(true);
    void readPreventSleepWhileRunningPreference()
      .then((value) => {
        if (!cancelled) {
          setKeepComputerAwake(value);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setKeepComputerAwake(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setKeepComputerAwakeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, showKeepComputerAwake]);

  const computerUsePlugin = useMemo(
    () =>
      selectPluginCandidatesByName(pluginsSnapshot, COMPUTER_USE_PLUGIN_NAMES)[0] ??
      null,
    [pluginsSnapshot],
  );
  const chromePlugin = useMemo(
    () => selectChromePlugin(pluginsSnapshot),
    [pluginsSnapshot],
  );

  const refreshRequiredApps = async (current: InstallModalState) => {
    if (current.phase !== "needsApps" || current.requiredApps.length === 0) {
      return current;
    }

    const appsSnapshot = await readAppsSnapshot({ hostId: LOCAL_HOST_ID });
    const appsById = new Map(appsSnapshot.data.map((app) => [app.id, app]));
    return {
      ...current,
      requiredApps: current.requiredApps.map<RequiredAppState>((app) => {
        const nextApp = appsById.get(app.appId);
        return nextApp?.isAccessible === true
          ? { ...app, status: "connected" }
          : app;
      }),
    };
  };

  useEffect(() => {
    if (installModalState?.phase !== "needsApps") {
      return;
    }

    let cancelled = false;

    const sync = () => {
      void refreshRequiredApps(installModalState)
        .then((nextState) => {
          if (!cancelled) {
            setInstallModalState(nextState);
          }
        })
        .catch(() => undefined);
    };

    sync();
    const interval = window.setInterval(sync, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [installModalState]);

  useEffect(() => {
    if (
      installModalState?.phase !== "needsApps" ||
      installModalState.requiredApps.length === 0
    ) {
      return;
    }

    const allConnected = installModalState.requiredApps.every(
      (app) => app.status === "connected",
    );
    if (!allConnected) {
      return;
    }

    setInstallModalState(null);
    showToast({
      tone: "success",
      message: t("plugins.install.ready", {
        pluginName: getPluginCandidateDisplayName(installModalState.request.candidate),
      }),
    });
  }, [installModalState, showToast, t]);

  const openInstallModalForCandidate = async (request: PluginInstallRequest) => {
    try {
      const response = await readPlugin(buildPluginReadParams(request.candidate));
      setInstallModalState({
        detail: response.plugin,
        phase: "details",
        request,
        requiredApps: [],
        requiredBrowserExtensions: [],
      });
    } catch (error) {
      showToast({
        tone: "error",
        message:
          error instanceof Error ? error.message : String(error),
      });
    }
  };

  const computerUseEnabled =
    computerUsePlugin?.plugin.installed === true &&
    computerUsePlugin.plugin.enabled === true;
  const computerUseToggleDisabled =
    pluginsLoading ||
    computerUsePlugin == null ||
    pendingPluginId === computerUsePlugin.plugin.id;

  const handleComputerUseEnabledChange = async (nextEnabled: boolean) => {
    if (computerUsePlugin == null || pendingPluginId != null) {
      return;
    }

    if (!computerUsePlugin.plugin.installed) {
      if (nextEnabled) {
        await openInstallModalForCandidate({
          candidate: computerUsePlugin,
          intent: "computerUseEnable",
        });
      }
      return;
    }

    setPendingPluginId(computerUsePlugin.plugin.id);
    try {
      await setPluginEnabled({
        hostId: LOCAL_HOST_ID,
        pluginId: computerUsePlugin.plugin.id,
        enabled: nextEnabled,
      });
      await loadPlugins();
    } catch {
      showToast({
        tone: "error",
        message: t("plugins.card.toggleError"),
      });
    } finally {
      setPendingPluginId(null);
    }
  };

  const handleKeepComputerAwakeChange = async (nextEnabled: boolean) => {
    setKeepComputerAwakeLoading(true);
    try {
      await setGlobalState("preventSleepWhileRunning", nextEnabled);
      setKeepComputerAwake(nextEnabled);
    } finally {
      setKeepComputerAwakeLoading(false);
    }
  };

  const handleInstallChromeExtension =
    chromePlugin == null
      ? null
      : () => {
          if (pendingPluginId != null) {
            return;
          }

          if (!chromePlugin.plugin.installed) {
            void openInstallModalForCandidate({
              candidate: chromePlugin,
              intent: "chromeExtension",
            });
            return;
          }

          if (chromeExtensionSetup?.installUrl) {
            void openInBrowser(chromeExtensionSetup.installUrl);
          }
        };

  const handleInstallFromModal = async () => {
    if (installModalState == null || pendingPluginId != null) {
      return;
    }

    const { candidate, intent } = installModalState.request;
    setPendingPluginId(candidate.plugin.id);
    try {
      const installResponse = await installPlugin(
        buildPluginInstallParams(candidate),
      );
        const nextSnapshot = await loadPlugins().catch((error) => {
          showToast({
            tone: "error",
            message: t("plugins.install.refreshError", {
              pluginName: getPluginCandidateDisplayName(candidate),
            }),
          description: error instanceof Error ? error.message : String(error),
        });
        return null;
      });

      const nextComputerUsePlugin = selectPluginCandidatesByName(
        nextSnapshot,
        COMPUTER_USE_PLUGIN_NAMES,
      )[0] ?? null;
      if (
        intent === "computerUseEnable" &&
        nextComputerUsePlugin?.plugin.installed === true &&
        nextComputerUsePlugin.plugin.enabled !== true
      ) {
        await setPluginEnabled({
          hostId: LOCAL_HOST_ID,
          pluginId: nextComputerUsePlugin.plugin.id,
          enabled: true,
        });
        await loadPlugins();
      }

      const requiredBrowserExtensions = await readRequiredBrowserExtensions(
        candidate,
        installResponse,
      );
      const requiredApps = buildRequiredApps(installResponse.appsNeedingAuth);
      if (
        installResponse.authPolicy === "ON_USE" ||
        (requiredApps.length === 0 && requiredBrowserExtensions.length === 0)
      ) {
        setInstallModalState(null);
        showToast({
          tone: "success",
          message: t("plugins.install.success", {
            pluginName: getPluginCandidateDisplayName(candidate),
          }),
        });
        return;
      }

      setInstallModalState({
        ...installModalState,
        phase: "needsApps",
        requiredApps,
        requiredBrowserExtensions,
      });
    } catch {
      showToast({
        tone: "error",
        message: t("plugins.install.error"),
      });
    } finally {
      setPendingPluginId(null);
    }
  };

  const handleConnectRequiredApp = async (appId: string) => {
    setInstallModalState((current) => {
      if (current == null || current.phase !== "needsApps") {
        return current;
      }
      return {
        ...current,
        requiredApps: current.requiredApps.map((app) =>
          app.appId === appId ? { ...app, status: "launching" } : app,
        ),
      };
    });

    const requiredApp = installModalState?.requiredApps.find(
      (app) => app.appId === appId,
    );
    if (requiredApp?.installUrl) {
      await openInBrowser(requiredApp.installUrl);
    }
  };

  const installModal = (
    <PluginInstallModal
      installModalState={installModalState}
      isInstalling={pendingPluginId != null}
      onClose={() => setInstallModalState(null)}
      onConnectRequiredApp={(appId) => void handleConnectRequiredApp(appId)}
      onInstall={() => void handleInstallFromModal()}
    />
  );

  const effectiveInstallChromeExtension =
    chromePlugin?.plugin.installed === true &&
    chromeExtensionSetup?.installUrl == null
      ? null
      : handleInstallChromeExtension;

  return {
    computerUseEnabled,
    computerUseToggleDisabled,
    installModal,
    keepComputerAwake,
    keepComputerAwakeToggleDisabled: keepComputerAwakeLoading,
    onComputerUseEnabledChange: handleComputerUseEnabledChange,
    onInstallChromeExtension: effectiveInstallChromeExtension,
    onKeepComputerAwakeChange: handleKeepComputerAwakeChange,
    showKeepComputerAwake,
  };
}

function PluginInstallModal({
  installModalState,
  isInstalling,
  onClose,
  onConnectRequiredApp,
  onInstall,
}: {
  installModalState: InstallModalState | null;
  isInstalling: boolean;
  onClose: () => void;
  onConnectRequiredApp: (appId: string) => void;
  onInstall: () => void;
}) {
  const { t } = useI18n();

  if (installModalState == null) {
    return null;
  }

  const { detail, phase, request, requiredApps, requiredBrowserExtensions } =
    installModalState;
  const displayName = getPluginCandidateDisplayName(request.candidate);
  const description =
    detail?.description?.trim() ||
    getPluginCandidateDescription(request.candidate);

  return (
    <DialogOverlay>
      <div className="app-card w-full max-w-[560px] rounded-[18px] px-6 py-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[22px] font-semibold tracking-[-0.03em] text-token-text-primary">
              {phase === "details"
                ? t("plugins.installModal.title", { pluginName: displayName })
                : t("plugins.installModal.finishSetup.title", {
                    pluginName: displayName,
                  })}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-token-description-foreground">
              {phase === "details"
                ? description
                : t("plugins.installModal.finishSetup.description")}
            </div>
          </div>
          <button
            type="button"
            aria-label={t("codex.alert.closeAriaLabel")}
            className="app-control-weak shrink-0 rounded-full px-2 py-1 text-[12px]"
            onClick={onClose}
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {phase === "details" ? (
          <div className="mt-6 space-y-4">
            {detail?.summary.interface?.capabilities?.length ? (
              <ModalSection title={t("plugins.installModal.capabilities")}>
                <div className="flex flex-wrap gap-2">
                  {detail.summary.interface.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-full border border-token-border px-2 py-1 text-[12px] text-token-description-foreground"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </ModalSection>
            ) : null}
            {detail?.apps.length ||
            detail?.skills.length ||
            detail?.mcpServers.length ? (
              <ModalSection title={t("plugins.installModal.includes")}>
                <div className="space-y-3">
                  {detail.apps.length ? (
                    <ModalIncludesBlock
                      title={t("plugins.installModal.includes.apps")}
                      items={detail.apps.map((app) => app.name)}
                    />
                  ) : null}
                  {detail.skills.length ? (
                    <ModalIncludesBlock
                      title={t("plugins.installModal.includes.skills")}
                      items={detail.skills.map((skill) => skill.name)}
                    />
                  ) : null}
                  {detail.mcpServers.length ? (
                    <ModalIncludesBlock
                      title={t("plugins.installModal.includes.mcpServers")}
                      items={detail.mcpServers}
                    />
                  ) : null}
                </div>
              </ModalSection>
            ) : null}
            <div className="flex justify-end">
              <Button
                size="large"
                className="justify-center"
                loading={isInstalling}
                onClick={onInstall}
              >
                {isInstalling
                  ? t("plugins.installModal.installing", {
                      pluginName: displayName,
                    })
                  : t("plugins.installModal.install", {
                      pluginName: displayName,
                    })}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {requiredApps.length ? (
              <ModalSection title={t("plugins.installModal.requiredApps")}>
                <div className="space-y-2">
                  {requiredApps.map((app) => (
                    <RequiredAppRow
                      key={app.appId}
                      app={app}
                      onConnect={() => onConnectRequiredApp(app.appId)}
                    />
                  ))}
                </div>
              </ModalSection>
            ) : null}
            {requiredBrowserExtensions.length ? (
              <ModalSection title={t("plugins.installModal.browserExtensions")}>
                <div className="space-y-2">
                  {requiredBrowserExtensions.map((extension) => (
                    <button
                      key={extension.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 rounded-[14px] border border-token-border bg-token-foreground/[0.03] px-4 py-3 text-left"
                      onClick={() => void openInBrowser(extension.installUrl)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-token-text-primary">
                          {extension.name}
                        </div>
                        <div className="mt-1 text-[12px] leading-5 text-token-description-foreground">
                          {t("plugins.installModal.browserExtension.description")}
                        </div>
                      </div>
                      <ArrowTopRightIcon className="h-4 w-4 shrink-0" />
                    </button>
                  ))}
                </div>
              </ModalSection>
            ) : null}
            <div className="flex justify-end">
              <Button color="secondary" size="large" onClick={onClose}>
                {t("plugins.installModal.done")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogOverlay>
  );
}

function ModalSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[12px] font-medium tracking-[0.08em] text-token-description-foreground uppercase">
        {title}
      </div>
      {children}
    </div>
  );
}

function ModalIncludesBlock({
  items,
  title,
}: {
  items: string[];
  title: string;
}) {
  return (
    <div className="rounded-[14px] border border-token-border bg-token-foreground/[0.03] px-4 py-3">
      <div className="text-[12px] font-medium text-token-text-primary">{title}</div>
      <div className="mt-2 space-y-1">
        {items.map((item) => (
          <div
            key={item}
            className="text-[12px] leading-5 text-token-description-foreground"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function RequiredAppRow({
  app,
  onConnect,
}: {
  app: RequiredAppState;
  onConnect: () => void;
}) {
  const { t } = useI18n();

  const buttonLabel =
    app.status === "connected"
      ? t("plugins.installModal.requiredApps.connected")
      : app.status === "launching"
        ? t("plugins.installModal.requiredApps.connecting")
        : t("plugins.installModal.requiredApps.connect");
  const buttonDisabled =
    app.status === "connected" ||
    app.status === "launching";

  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-token-border bg-token-foreground/[0.03] px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-token-text-primary">
          {app.name}
        </div>
        {app.description ? (
          <div className="mt-1 text-[12px] leading-5 text-token-description-foreground">
            {app.description}
          </div>
        ) : null}
      </div>
      <Button
        color="secondary"
        size="toolbar"
        disabled={buttonDisabled}
        onClick={onConnect}
      >
        {buttonLabel}
      </Button>
    </div>
  );
}

function selectChromePlugin(snapshot: PluginListSnapshot | null) {
  return selectPluginCandidatesByName(snapshot, CHROME_PLUGIN_NAMES)[0] ?? null;
}

function buildPluginInstallParams(candidate: PluginCandidate) {
  return candidate.marketplacePath == null
    ? { hostId: LOCAL_HOST_ID, pluginName: candidate.plugin.name }
    : {
        hostId: LOCAL_HOST_ID,
        marketplacePath: candidate.marketplacePath,
        pluginName: candidate.plugin.name,
      };
}

function buildPluginReadParams(candidate: PluginCandidate) {
  return candidate.marketplacePath == null
    ? { hostId: LOCAL_HOST_ID, pluginName: candidate.plugin.name }
    : {
        hostId: LOCAL_HOST_ID,
        marketplacePath: candidate.marketplacePath,
        pluginName: candidate.plugin.name,
      };
}

function buildRequiredApps(apps: PluginAppSummary[]) {
  return apps.map<RequiredAppState>((app) => ({
    appId: app.id,
    description: app.description,
    installUrl: app.installUrl,
    name: app.name,
    status: "pending",
  }));
}

async function readRequiredBrowserExtensions(
  candidate: PluginCandidate,
  response: PluginInstallResponse,
) {
  if (response.authPolicy !== "ON_INSTALL" || !isChromeLikePlugin(candidate)) {
    return [];
  }

  const setup = await readChromeExtensionSetup(candidate);
  if (setup == null) {
    return [];
  }

  return [
    {
      id: setup.extensionId,
      installUrl: setup.installUrl,
      name: "Codex Chrome Extension",
    },
  ];
}

function isChromeLikePlugin(candidate: PluginCandidate) {
  return CHROME_PLUGIN_NAMES.includes(
    candidate.plugin.name as (typeof CHROME_PLUGIN_NAMES)[number],
  );
}

async function readChromeExtensionSetup(
  candidate: PluginCandidate,
): Promise<ChromeExtensionSetup | null> {
  if (candidate.plugin.source.type !== "local") {
    return null;
  }

  const response = await readFileText({
    path: buildNestedPath(
      candidate.plugin.source.path,
      CHROME_EXTENSION_ID_RELATIVE_PATH,
    ),
  });
  const parsed = JSON.parse(response.contents) as { extensionId?: unknown };
  const extensionId =
    typeof parsed.extensionId === "string" ? parsed.extensionId.trim() : "";
  if (extensionId.length === 0) {
    return null;
  }

  return {
    extensionId,
    installUrl: `${CHROME_EXTENSION_INSTALL_URL_PREFIX}${extensionId}`,
  };
}

function buildNestedPath(rootPath: string, relativePath: string) {
  return `${rootPath.replace(/[\\/]+$/, "")}/${relativePath}`;
}

function getDialogTitleKey(step: SetupStep): MessageKey {
  switch (step) {
    case "initial":
      return "codexMobile.setupDialog.initial.title";
    case "allow-host":
      return "codexMobile.setupDialog.allowHost.title";
    case "mfa-required":
      return "codexMobile.setupDialog.mfaRequired.title";
    case "waiting":
      return "codexMobile.setupDialog.waiting.title";
    case "connected":
      return "codexMobile.setupDialog.connected.title";
  }
}

function CodexMobileGlyph({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10.0004 2.04327C13.4217 2.04346 16.2944 4.61966 16.6655 8.02081L17.227 13.1712L17.2358 13.3353C17.2361 14.1509 16.5738 14.8312 15.7377 14.8314H13.9018C13.5034 16.6195 11.9085 17.9562 10.0004 17.9564C8.09213 17.9564 6.49643 16.6196 6.09808 14.8314H4.26214C3.37065 14.8311 2.67643 14.0575 2.77288 13.1712L3.3344 8.02081L3.37737 7.70441C3.88652 4.46108 6.68591 2.04327 10.0004 2.04327ZM7.48089 14.8314C7.8428 15.8758 8.83285 16.6263 10.0004 16.6263C11.1678 16.6261 12.1571 15.8756 12.519 14.8314H7.48089ZM10.0004 3.37335C7.34338 3.37335 5.09898 5.31146 4.69085 7.91144L4.65667 8.16534L4.09515 13.3148C4.08429 13.4142 4.16215 13.501 4.26214 13.5013H15.7377C15.8252 13.5012 15.8956 13.4351 15.9047 13.3519V13.3148L15.3432 8.16534C15.0458 5.43887 12.743 3.37354 10.0004 3.37335Z"
        fill="currentColor"
      />
    </svg>
  );
}

function GlobeThreadsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path d="M13.8875 14.6895C17.2961 14.853 20.1743 17.5201 20.1743 20.4947C20.1743 20.9923 19.7708 21.3958 19.2732 21.3958C18.7755 21.3958 18.3721 20.9923 18.3721 20.4947C18.3721 18.6736 16.4459 16.6172 13.8134 16.4905L13.5567 16.4839C10.7939 16.4839 8.74141 18.6169 8.74141 20.4947C8.74139 20.9923 8.33792 21.3958 7.84028 21.3958C7.34264 21.3958 6.93917 20.9923 6.93914 20.4947C6.93914 17.4267 10.0053 14.6816 13.5567 14.6816L13.8875 14.6895Z" fill="currentColor" />
      <path d="M5.41872 15.0296C5.72112 15.0467 6.0168 15.0882 6.30266 15.1527C6.78787 15.2622 7.09341 15.7445 6.98413 16.2298C6.87471 16.7152 6.39104 17.0205 5.90568 16.9113C5.71567 16.8685 5.51926 16.8393 5.31816 16.8279L5.11438 16.8226C3.18178 16.8226 1.80227 18.3144 1.80227 19.5419C1.80217 20.0394 1.39858 20.4429 0.901136 20.443C0.403544 20.443 0.00010128 20.0395 0 19.5419C0 17.1243 2.39317 15.0203 5.11438 15.0204L5.41872 15.0296Z" fill="currentColor" />
      <path d="M21.9925 15.0204C24.7137 15.0203 27.1069 17.1243 27.1069 19.5419C27.1067 20.0395 26.7033 20.443 26.2057 20.443C25.7083 20.4429 25.3047 20.0394 25.3046 19.5419C25.3046 18.3144 23.9251 16.8226 21.9925 16.8226L21.7887 16.8279C21.5876 16.8393 21.3912 16.8685 21.2012 16.9113C20.7158 17.0205 20.2321 16.7152 20.1227 16.2298C20.0134 15.7445 20.319 15.2622 20.8042 15.1527C21.09 15.0882 21.3857 15.0467 21.6881 15.0296L21.9925 15.0204Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M4.64727 6.86514C6.58541 6.86514 8.15639 8.4363 8.15654 10.3744C8.15639 12.3125 6.58541 13.8837 4.64727 13.8837C2.70925 13.8835 1.13814 12.3124 1.138 10.3744C1.13814 8.43639 2.70924 6.86528 4.64727 6.86514ZM4.64727 8.66741C3.70455 8.66755 2.94041 9.43169 2.94027 10.3744C2.94041 11.3171 3.70455 12.0813 4.64727 12.0814C5.5901 12.0814 6.35412 11.3172 6.35426 10.3744C6.35412 9.43161 5.5901 8.66741 4.64727 8.66741Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M22.4596 6.86514C24.3976 6.86528 25.9687 8.43639 25.9689 10.3744C25.9687 12.3124 24.3976 13.8835 22.4596 13.8837C20.5214 13.8837 18.9505 12.3125 18.9503 10.3744C18.9505 8.4363 20.5214 6.86514 22.4596 6.86514ZM22.4596 8.66741C21.5167 8.66741 20.7527 9.43161 20.7526 10.3744C20.7527 11.3172 21.5167 12.0814 22.4596 12.0814C23.4023 12.0813 24.1664 11.3171 24.1666 10.3744C24.1664 9.43169 23.4023 8.66755 22.4596 8.66741Z" fill="currentColor" />
      <path fillRule="evenodd" clipRule="evenodd" d="M13.5567 5.87402C15.7382 5.87402 17.5066 7.64249 17.5066 9.82394C17.5066 12.0054 15.7382 13.7738 13.5567 13.7738C11.3753 13.7738 9.60682 12.0054 9.60682 9.82394C9.60682 7.64249 11.3753 5.87402 13.5567 5.87402ZM13.5567 7.67629C12.3706 7.67629 11.4091 8.6378 11.4091 9.82394C11.4091 11.0101 12.3706 11.9716 13.5567 11.9716C14.7429 11.9716 15.7044 11.0101 15.7044 9.82394C15.7044 8.6378 14.7429 7.6763 13.5567 7.67629Z" fill="currentColor" />
    </svg>
  );
}

function SparkleActionsIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M10 2.5L11.7305 7.26953L16.5 9L11.7305 10.7305L10 15.5L8.26953 10.7305L3.5 9L8.26953 7.26953L10 2.5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ArrowTopRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M14.3349 13.3301V6.60645L5.47065 15.4707C5.21095 15.7304 4.78895 15.7304 4.52925 15.4707C4.26955 15.211 4.26955 14.789 4.52925 14.5293L13.3935 5.66504H6.66011C6.29284 5.66504 5.99507 5.36727 5.99507 5C5.99507 4.63273 6.29284 4.33496 6.66011 4.33496H14.9999L15.1337 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V13.3301C15.6649 13.6973 15.3672 13.9951 14.9999 13.9951C14.6327 13.9951 14.335 13.6973 14.3349 13.3301Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5.46967 5.46967C5.72937 5.20998 6.15137 5.20998 6.41108 5.46967L10 9.05859L13.5889 5.46967C13.8486 5.20998 14.2706 5.20998 14.5303 5.46967C14.79 5.72937 14.79 6.15137 14.5303 6.41108L10.9414 10L14.5303 13.5889C14.79 13.8486 14.79 14.2706 14.5303 14.5303C14.2706 14.79 13.8486 14.79 13.5889 14.5303L10 10.9414L6.41108 14.5303C6.15137 14.79 5.72937 14.79 5.46967 14.5303C5.20998 14.2706 5.20998 13.8486 5.46967 13.5889L9.05859 10L5.46967 6.41108C5.20998 6.15137 5.20998 5.72937 5.46967 5.46967Z"
        fill="currentColor"
      />
    </svg>
  );
}
