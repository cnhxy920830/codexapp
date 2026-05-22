import { useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertWarningIcon, ArrowTopRightIcon, LinkExternalIcon, WarningIcon } from "./AppShellIcons";
import { Alert } from "./Alert";
import type { AppToast } from "./AppToastRegion";
import { AgentExperimentalFeaturesSettings } from "./AgentExperimentalFeaturesSettings";
import { Button } from "./Button";
import { MarkdownPreview } from "./MarkdownPreview";
import { SettingsChoiceMenu } from "./SettingsChoiceMenu";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import { WorkspaceDependenciesSettings } from "./WorkspaceDependenciesSettings";
import { useReplicaStatsigDefaultFeatures, useReplicaStatsigGateValue } from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import type { LocaleCode, MessageKey, MessageValues } from "../i18n/messages";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import { MESSAGES, getMessageLocale } from "../i18n/messages";
import { openFile } from "../services/hostFiles";
import { readOpenInTargets } from "../services/openTargets";
import { writeProjectConfigValue } from "../services/agentSettingsConfig";
import {
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  getConfigurationValue,
  getConfigRequirementsForHost,
  onAgentSettingsNoticesChanged,
  readWslBashAvailability,
  readAgentSettingsNotices,
  readConfigForHost,
  resolveConfigOrigin,
  type AgentSettingsNotice,
  type ConfigLayer,
  type ConfigLayerMetadata,
  type ConfigRequirements,
  type ConfigScopeOption,
  type ConfigSnapshot,
  type ConfigWriteForHostParams,
  type ConfigWriteTarget,
  writeConfigValueForHost,
} from "../services/settings";
import { LOCAL_SETTINGS_HOST_ID, readAppServerConnectionState } from "../services/settingsHosts";

const AGENT_SETTINGS_DOCS_URL = "https://developers.openai.com/codex/config-basic";
const CONFIG_TOML_DOCS_URL = "https://developers.openai.com/codex/config-basic";
const RUN_CODEX_IN_WSL_KEY = "runCodexInWindowsSubsystemForLinux";

const APPROVAL_POLICY_OPTIONS = [
  {
    description: "Always ask before taking action",
    labelKey: "settings.agent.approval.untrusted",
    value: "untrusted",
  },
  {
    description: "Ask only when a command fails",
    labelKey: "settings.agent.approval.onFailure",
    value: "on-failure",
  },
  {
    description: "Ask when escalation is requested",
    labelKey: "settings.agent.approval.onRequest",
    value: "on-request",
  },
  {
    description: "Run without asking for approval",
    labelKey: "settings.agent.approval.never",
    value: "never",
  },
] as const;

const SANDBOX_MODE_OPTIONS = [
  {
    description: "Can read files, but cannot edit them",
    labelKey: "settings.agent.sandbox.readOnly",
    value: "read-only",
  },
  {
    description: "Can edit files, but only in this workspace",
    labelKey: "settings.agent.sandbox.workspaceWrite",
    value: "workspace-write",
  },
  {
    description: "Can edit files outside this workspace",
    labelKey: "settings.agent.sandbox.fullAccess",
    value: "danger-full-access",
  },
] as const;

type AgentConfigControlErrorKey = "approval" | "sandbox" | "network";
type AgentConfigControlErrors = Partial<Record<AgentConfigControlErrorKey, string>>;
type Translate = (key: MessageKey, values?: MessageValues) => string;

export function AgentSettings({
  codexHome: initialCodexHome = null,
  hostId,
  onNavigateToOpenSourceLicenses,
  onShowToast,
  settingsCwd = null,
  settingsWorkspaceRoot = null,
}: {
  codexHome?: string | null;
  hostId: string;
  onNavigateToOpenSourceLicenses: () => void;
  onShowToast?: (toast: AppToast) => void;
  settingsCwd?: string | null;
  settingsWorkspaceRoot?: string | null;
}) {
  const { locale, t } = useI18n();
  const defaultFeatures = useReplicaStatsigDefaultFeatures();
  const showExperimentalFeatures = useReplicaStatsigGateValue("2106641128");
  const isLocalHost = hostId === LOCAL_SETTINGS_HOST_ID;
  const [notices, setNotices] = useState<AgentSettingsNotice[]>([]);
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configOrigins, setConfigOrigins] = useState<Record<string, ConfigLayerMetadata> | null>(null);
  const [configScopeOptions, setConfigScopeOptions] = useState<ConfigScopeOption[]>([]);
  const [selectedConfigScopeKey, setSelectedConfigScopeKey] = useState<string>("user");
  const [agentConfigControlErrors, setAgentConfigControlErrors] = useState<AgentConfigControlErrors>({});
  const [configError, setConfigError] = useState<string | null>(null);
  const [configRequirements, setConfigRequirements] = useState<ConfigRequirements | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [pendingControlKey, setPendingControlKey] = useState<AgentConfigControlErrorKey | null>(null);
  const [codexHome, setCodexHome] = useState<string | null>(initialCodexHome);
  const [hasWsl, setHasWsl] = useState(false);
  const [runCodexInWsl, setRunCodexInWsl] = useState(false);
  const lastLoadRequestIdRef = useRef(0);
  const lastLocalConfigTomlRequestIdRef = useRef(0);
  const isWindows = typeof navigator === "undefined" ? true : (navigator.platform ?? "").startsWith("Win");

  void settingsCwd;

  const loadLocalConfigTomlState = useEffectEvent(async () => {
    const requestId = ++lastLocalConfigTomlRequestIdRef.current;
    const [connectionState, configuration, wslAvailability] = await Promise.all([
      isLocalHost ? Promise.resolve(null) : readAppServerConnectionState(hostId).catch(() => null),
      getConfigurationValue(RUN_CODEX_IN_WSL_KEY).catch(() => ({ value: null })),
      readWslBashAvailability().catch(() => ({ available: false, distro: null })),
    ]);

    if (requestId !== lastLocalConfigTomlRequestIdRef.current) {
      return;
    }

    setCodexHome(isLocalHost ? initialCodexHome : connectionState?.codexHome ?? null);
    setHasWsl(isLocalHost && (wslAvailability.available || wslAvailability.distro != null));
    setRunCodexInWsl(isLocalHost && configuration.value === true);
  });

  const loadConfigState = useEffectEvent(async () => {
    const requestId = ++lastLoadRequestIdRef.current;
    setIsConfigLoading(true);
    try {
      const [configResponse, requirementsResponse, noticesResponse] = await Promise.all([
        readConfigForHost({
          hostId,
          cwd: isLocalHost ? settingsWorkspaceRoot : null,
          includeLayers: true,
        }),
        getConfigRequirementsForHost({ hostId }),
        readAgentSettingsNotices(hostId),
      ]);

      if (requestId !== lastLoadRequestIdRef.current) {
        return;
      }

      const nextScopeOptions = buildConfigScopeOptions(configResponse);
      setConfigSnapshot(configResponse.config);
      setConfigOrigins(configResponse.origins);
      setConfigScopeOptions(nextScopeOptions);
      setSelectedConfigScopeKey((current) => {
        if (nextScopeOptions.some((scope) => scope.key === current)) {
          return current;
        }
        return chooseDefaultConfigScopeKey(nextScopeOptions);
      });
      setConfigRequirements(requirementsResponse.requirements);
      setNotices(noticesResponse.notices);
      setConfigError(null);
      setAgentConfigControlErrors({});
    } catch (error) {
      if (requestId !== lastLoadRequestIdRef.current) {
        return;
      }

      setConfigSnapshot(null);
      setConfigOrigins(null);
      setConfigScopeOptions([]);
      setSelectedConfigScopeKey("user");
      setConfigRequirements(null);
      setNotices([]);
      setAgentConfigControlErrors({});
      setConfigError(error instanceof Error ? error.message : String(error));
    } finally {
      if (requestId === lastLoadRequestIdRef.current) {
        setIsConfigLoading(false);
      }
    }
  });

  useEffect(() => {
    void loadConfigState();
  }, [hostId, isLocalHost, loadConfigState, settingsWorkspaceRoot]);

  useEffect(() => {
    const handleFocus = () => {
      void loadConfigState();
      void loadLocalConfigTomlState();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [loadConfigState, loadLocalConfigTomlState]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | null = null;

    void onAgentSettingsNoticesChanged((notification) => {
      if (notification.hostId !== hostId) {
        return;
      }
      setNotices(notification.notices);
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }
      unlisten = dispose;
    });

    return () => {
      disposed = true;
      if (unlisten !== null) {
        void unlisten();
      }
    };
  }, [hostId]);

  useEffect(() => {
    void loadLocalConfigTomlState();
  }, [hostId, isLocalHost, loadLocalConfigTomlState]);

  const selectedScope = useMemo(
    () => configScopeOptions.find((scope) => scope.key === selectedConfigScopeKey) ?? null,
    [configScopeOptions, selectedConfigScopeKey],
  );
  const projectScopeOptions = useMemo(
    () => configScopeOptions.filter((scope) => scope.kind === "project"),
    [configScopeOptions],
  );
  const userScope = useMemo(
    () =>
      configScopeOptions.find((scope) => scope.kind === "user") ?? {
        config: null,
        disabledReason: null,
        expectedVersion: null,
        filePath: null,
        key: "user",
        kind: "user" as const,
        label: t("settings.agent.configuration.scope.user"),
        workspaceRoot: null,
        layer: null,
      },
    [configScopeOptions, t],
  );
  const managedScope = useMemo(
    () => configScopeOptions.find((scope) => scope.kind === "managed") ?? null,
    [configScopeOptions],
  );

  const configLayerConfig = parseConfigLayerConfig(selectedScope?.config ?? null);
  const baseApprovalPolicy = normalizeApprovalPolicy(configSnapshot?.approvalPolicy ?? null) ?? "on-request";
  const baseSandboxMode = normalizeSandboxMode(configSnapshot?.sandboxMode ?? null) ?? "read-only";
  const selectedApprovalPolicy = configLayerConfig.approvalPolicy ?? baseApprovalPolicy;
  const selectedSandboxMode = configLayerConfig.sandboxMode ?? baseSandboxMode;
  const showNetworkAccess =
    configLayerConfig.sandboxMode === "workspace-write" ||
    (configLayerConfig.sandboxMode == null && baseSandboxMode === "workspace-write");
  const selectedNetworkAccess =
    configLayerConfig.networkAccess ??
    configSnapshot?.sandboxWorkspaceWrite?.networkAccess ??
    false;

  const selectedScopeLockReason = getScopeLockReason(selectedScope, t);
  const approvalOriginLayer =
    configOrigins == null ? null : resolveConfigOrigin(configOrigins, "approval_policy", ["approvalPolicy"]);
  const sandboxOriginLayer =
    configOrigins == null ? null : resolveConfigOrigin(configOrigins, "sandbox_mode");
  const networkOriginLayer =
    configOrigins == null ? null : resolveConfigOrigin(configOrigins, "sandbox_workspace_write", ["network_access"]);
  const filteredApprovalOptions = APPROVAL_POLICY_OPTIONS.filter((option) => {
    if (configRequirements?.allowedApprovalPolicies == null || configRequirements.allowedApprovalPolicies.length === 0) {
      return true;
    }
    return configRequirements.allowedApprovalPolicies.includes(option.value);
  });
  const filteredSandboxOptions = SANDBOX_MODE_OPTIONS.filter((option) => {
    if (configRequirements?.allowedSandboxModes == null || configRequirements.allowedSandboxModes.length === 0) {
      return true;
    }
    return configRequirements.allowedSandboxModes.includes(option.value);
  });
  const approvalLockReason = getControlLockReason({
    hasOptions: filteredApprovalOptions.length > 0,
    intl: t,
    originLayer: approvalOriginLayer,
    restrictedMessage: t("settings.agent.configuration.approval.restricted"),
    scopeLockReason: selectedScopeLockReason,
    selectedScope,
  });
  const sandboxLockReason = getControlLockReason({
    hasOptions: filteredSandboxOptions.length > 0,
    intl: t,
    originLayer: sandboxOriginLayer,
    restrictedMessage: t("settings.agent.configuration.sandbox.restricted"),
    scopeLockReason: selectedScopeLockReason,
    selectedScope,
  });
  const networkLockReason = getControlLockReason({
    hasOptions: true,
    intl: t,
    originLayer: networkOriginLayer,
    restrictedMessage: "",
    scopeLockReason: selectedScopeLockReason,
    selectedScope,
  });
  const disableControls = isConfigLoading || pendingControlKey !== null || selectedScope?.disabledReason != null;
  const showWorkspaceDependencies =
    isLocalHost &&
    defaultFeatures.workspace_dependencies === true;
  const configTomlPath = buildConfigTomlPath(codexHome);
  const configTomlButtonLabel =
    runCodexInWsl && isWindows && hasWsl
      ? t("settings.agent.openConfigTomlWsl")
      : t("settings.agent.openConfigToml");

  const handleOpenSelectedConfig = async () => {
    if (selectedScope?.filePath == null) {
      return;
    }

    try {
      const preferredTargetCwd = selectedScope.workspaceRoot ?? (isLocalHost ? settingsWorkspaceRoot : null);
      const openTargetsResponse = await readOpenInTargets({
        cwd: preferredTargetCwd,
        hostId,
      }).catch(() => null);
      await openFile({
        hostId,
        path: selectedScope.filePath,
        cwd: selectedScope.workspaceRoot ?? null,
        target: openTargetsResponse?.preferredTarget ?? null,
      });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpenConfigToml = async () => {
    if (configTomlPath == null) {
      return;
    }

    try {
      const openTargetsResponse = await readOpenInTargets({
        cwd: null,
        hostId,
      }).catch(() => null);
      await openFile({
        hostId,
        path: configTomlPath,
        target: openTargetsResponse?.preferredTarget ?? null,
      });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const writeConfigValue = async (
    controlKey: AgentConfigControlErrorKey,
    keyPath: string,
    value: string | boolean,
  ) => {
    if (selectedScope?.filePath == null || pendingControlKey !== null) {
      return;
    }

    setPendingControlKey(controlKey);
    setConfigError(null);
    setAgentConfigControlErrors((current) => {
      if (!(controlKey in current)) {
        return current;
      }
      const next = { ...current };
      delete next[controlKey];
      return next;
    });

    try {
      await writeAgentConfigValue({
        expectedVersion: selectedScope.expectedVersion ?? null,
        filePath: selectedScope.filePath,
        hostId,
        keyPath,
        kind: selectedScope.kind,
        value,
      });
      await loadConfigState();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentConfigControlErrors((current) => ({
        ...current,
        [controlKey]: message,
      }));
    } finally {
      setPendingControlKey((current) => (current === controlKey ? null : current));
    }
  };

  return (
    <SettingsContentLayout
      title={<SettingsSectionTitle slug="agent" />}
      subtitle={renderInlineLinkMessage(
        t("settings.agent.configuration.subtitle.summary"),
        AGENT_SETTINGS_DOCS_URL,
        "inline-flex text-token-text-link-foreground",
      )}
      subtitleClassName="whitespace-normal"
    >
      <SettingsGroup className="gap-2">
        <SettingsGroup.Header title={t("settings.agent.customConfig.sectionTitle")} />
        <SettingsGroup.Content>
          {notices.map((notice, index) => (
            <AgentSettingsNoticeCard
              key={`${index}:${notice.kind}:${notice.summary}:${notice.path ?? ""}`}
              hostId={hostId}
              locale={locale}
              notice={notice}
              total={notices.length}
              index={index}
            />
          ))}
          <ConfigSettingsSection
            approvalError={agentConfigControlErrors.approval ?? null}
            approvalLockReason={approvalLockReason}
            approvalOptions={filteredApprovalOptions.map((option) => ({
              description: option.description,
              label: t(option.labelKey),
              value: option.value,
            }))}
            approvalValue={selectedApprovalPolicy}
            configError={configError}
            disabled={disableControls}
            managedScope={managedScope}
            networkAccess={selectedNetworkAccess}
            networkError={agentConfigControlErrors.network ?? null}
            networkLockReason={networkLockReason}
            onOpenSelectedConfig={handleOpenSelectedConfig}
            onSelectScope={(key) => {
              setSelectedConfigScopeKey(key);
              setAgentConfigControlErrors({});
              setConfigError(null);
            }}
            onUpdateApprovalPolicy={(value) => void writeConfigValue("approval", "approval_policy", value)}
            onUpdateNetworkAccess={(value) =>
              void writeConfigValue("network", "sandbox_workspace_write.network_access", value)
            }
            onUpdateSandboxMode={(value) => void writeConfigValue("sandbox", "sandbox_mode", value)}
            projectScopeOptions={projectScopeOptions}
            sandboxError={agentConfigControlErrors.sandbox ?? null}
            sandboxLockReason={sandboxLockReason}
            sandboxOptions={filteredSandboxOptions.map((option) => ({
              description: option.description,
              label: t(option.labelKey),
              value: option.value,
            }))}
            sandboxValue={selectedSandboxMode}
            selectedScope={selectedScope}
            showNetworkAccess={showNetworkAccess}
            t={t}
            userScope={userScope}
          />
          <DesktopOnlySection>
            <SettingsSurface>
              <SettingsRow
                label={t("settings.agent.configuration.configToml")}
                description={renderConfigTomlDescription(t)}
                control={
                  <Button
                    color="secondary"
                    size="toolbar"
                    className="inline-flex w-fit"
                    disabled={configTomlPath == null}
                    onClick={() => void handleOpenConfigToml()}
                  >
                    {configTomlButtonLabel}
                  </Button>
                }
              />
              <SettingsRow
                label={t("settings.openSourceLicenses.rowLabel")}
                description={t("settings.openSourceLicenses.rowDescription")}
                control={
                  <Button
                    color="secondary"
                    size="toolbar"
                    onClick={onNavigateToOpenSourceLicenses}
                  >
                    {t("settings.openSourceLicenses.view")}
                  </Button>
                }
              />
            </SettingsSurface>
          </DesktopOnlySection>
        </SettingsGroup.Content>
      </SettingsGroup>
      <DesktopOnlySection>
        {showExperimentalFeatures ? <AgentExperimentalFeaturesSettings hostId={hostId} /> : null}
      </DesktopOnlySection>
      <DesktopOnlySection>
        {showWorkspaceDependencies ? (
          <WorkspaceDependenciesSettings hostId={hostId} onShowToast={onShowToast} />
        ) : null}
      </DesktopOnlySection>
    </SettingsContentLayout>
  );
}

function ConfigSettingsSection({
  approvalError,
  approvalLockReason,
  approvalOptions,
  approvalValue,
  configError,
  disabled,
  managedScope,
  networkAccess,
  networkError,
  networkLockReason,
  onOpenSelectedConfig,
  onSelectScope,
  onUpdateApprovalPolicy,
  onUpdateNetworkAccess,
  onUpdateSandboxMode,
  projectScopeOptions,
  sandboxError,
  sandboxLockReason,
  sandboxOptions,
  sandboxValue,
  selectedScope,
  showNetworkAccess,
  t,
  userScope,
}: {
  approvalError: string | null;
  approvalLockReason: string | null;
  approvalOptions: Array<{ description: string; label: string; value: string }>;
  approvalValue: string;
  configError: string | null;
  disabled: boolean;
  managedScope: ConfigScopeOption | null;
  networkAccess: boolean;
  networkError: string | null;
  networkLockReason: string | null;
  onOpenSelectedConfig: () => void;
  onSelectScope: (key: string) => void;
  onUpdateApprovalPolicy: (value: string) => void;
  onUpdateNetworkAccess: (value: boolean) => void;
  onUpdateSandboxMode: (value: string) => void;
  projectScopeOptions: ConfigScopeOption[];
  sandboxError: string | null;
  sandboxLockReason: string | null;
  sandboxOptions: Array<{ description: string; label: string; value: string }>;
  sandboxValue: string;
  selectedScope: ConfigScopeOption | null;
  showNetworkAccess: boolean;
  t: Translate;
  userScope: ConfigScopeOption;
}) {
  return (
    <SettingsGroup className="gap-2">
      <SettingsGroup.Header
        title={
          <AgentConfigScopeSelector
            globalScopeOptions={[userScope, ...(managedScope == null ? [] : [managedScope])]}
            projectScopeOptions={projectScopeOptions}
            selectedScope={selectedScope}
            t={t}
            onSelect={onSelectScope}
          />
        }
        actions={
          <Button
            color="ghost"
            size="toolbar"
            disabled={selectedScope?.filePath == null}
            onClick={onOpenSelectedConfig}
          >
            {t("settings.agent.configuration.scope.open")}
            <ArrowTopRightIcon className="icon-2xs" />
          </Button>
        }
      />
      <SettingsGroup.Content>
        <SettingsSurface>
          {selectedScope?.disabledReason ? (
            <div className="flex items-start gap-2 p-3">
              <WarningIcon className="icon-xs mt-0.5 shrink-0 text-token-editor-warning-foreground" />
              <div className="text-sm text-token-text-secondary">{selectedScope.disabledReason}</div>
            </div>
          ) : null}
          <SettingsRow
            label={t("settings.agent.configuration.approval.label")}
            description={
              <SettingsRowDescription error={approvalError} lockReason={approvalLockReason}>
                {t("settings.agent.configuration.approval.definition")}
              </SettingsRowDescription>
            }
            control={
              <ChoiceMenu
                disabled={disabled || approvalLockReason != null}
                options={approvalOptions}
                value={approvalValue}
                onChange={onUpdateApprovalPolicy}
              />
            }
          />
          <SettingsRow
            label={t("settings.agent.configuration.sandbox.label")}
            description={
              <SettingsRowDescription error={sandboxError} lockReason={sandboxLockReason}>
                {t("settings.agent.configuration.sandbox.definition")}
              </SettingsRowDescription>
            }
            control={
              <ChoiceMenu
                disabled={disabled || sandboxLockReason != null}
                options={sandboxOptions}
                value={sandboxValue}
                onChange={onUpdateSandboxMode}
              />
            }
          />
          {showNetworkAccess ? (
            <SettingsRow
              label={t("settings.agent.configuration.network.label")}
              description={
                <SettingsRowDescription error={networkError} lockReason={networkLockReason}>
                  {t("settings.agent.configuration.network.definition")}
                </SettingsRowDescription>
              }
              control={
                <ToggleSwitch
                  ariaLabel={t("settings.agent.configuration.network.ariaLabel")}
                  checked={networkAccess}
                  disabled={disabled || networkLockReason != null}
                  onChange={onUpdateNetworkAccess}
                />
              }
            />
          ) : null}
          {configError ? (
            <div className="px-3 pb-3 text-sm text-token-error-foreground">{configError}</div>
          ) : null}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function AgentSettingsNoticeCard({
  hostId,
  index,
  locale,
  notice,
  total,
}: {
  hostId: string;
  index: number;
  locale: LocaleCode;
  notice: AgentSettingsNotice;
  total: number;
}) {
  const { t } = useI18n();
  const handleOpenNoticeFile = async () => {
    if (notice.path == null) {
      return;
    }

    const openTargetsResponse = await readOpenInTargets({
      cwd: null,
      hostId,
    }).catch(() => null);
    await openFile({
      hostId,
      path: notice.path,
      cwd: null,
      target: openTargetsResponse?.preferredTarget ?? null,
      ...(notice.range == null
        ? {}
        : {
            column: notice.range.start.column,
            line: notice.range.start.line,
          }),
    });
  };

  return (
    <Alert
      className={index === total - 1 ? "mb-3" : "mb-2"}
      fullWidth
      icon={AlertWarningIcon}
      level={notice.level}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="min-w-0 text-sm text-token-text-primary">
              <MarkdownPreview className="[&>p]:my-0" cwd={null} hostId={hostId} text={notice.summary} />
            </div>
            {notice.details ? (
              <div className="min-w-0 text-sm text-token-text-secondary">
                <MarkdownPreview className="[&>p]:my-0" cwd={null} hostId={hostId} text={notice.details} />
              </div>
            ) : null}
            {notice.path ? (
              <div className="min-w-0 text-sm text-token-text-secondary">
                {renderNoticeFileContext(locale, t, notice)}
              </div>
            ) : null}
          </div>
          {notice.path ? (
            <Button
              className="inline-flex w-fit shrink-0"
              color="secondary"
              size="toolbar"
              onClick={() => void handleOpenNoticeFile()}
            >
              {t("settings.agent.configuration.notice.openFile")}
            </Button>
          ) : null}
        </div>
      </div>
    </Alert>
  );
}

function AgentConfigScopeSelector({
  globalScopeOptions,
  projectScopeOptions,
  selectedScope,
  t,
  onSelect,
}: {
  globalScopeOptions: ConfigScopeOption[];
  projectScopeOptions: ConfigScopeOption[];
  selectedScope: ConfigScopeOption | null;
  t: Translate;
  onSelect: (key: string) => void;
}) {
  const menuSections = [
    ...(projectScopeOptions.length > 0
      ? [
          {
            label: t("settings.agent.configuration.scope.projectGroup"),
            options: projectScopeOptions.map((scope) => ({
              value: scope.key,
              label: scope.label,
              title: scope.filePath ?? undefined,
            })),
          },
        ]
      : []),
    {
      label: t("settings.agent.configuration.scope.globalGroup"),
      options: globalScopeOptions.map((scope) => ({
        value: scope.key,
        label:
          scope.kind === "user"
            ? t("settings.agent.configuration.scope.user")
            : scope.kind === "managed"
              ? t("settings.agent.configuration.scope.managed")
              : scope.label,
        title:
          scope.kind === "managed"
            ? t("settings.agent.configuration.scope.managedDescription")
            : scope.filePath ?? undefined,
      })),
    },
  ];

  return (
    <SettingsChoiceMenu
      className="w-[240px]"
      disabled={globalScopeOptions.length + projectScopeOptions.length === 0}
      menuClassName="w-[240px]"
      onChange={onSelect}
      options={menuSections.flatMap((section) => section.options)}
      sections={menuSections}
      triggerLabel={selectedScope?.label ?? t("settings.agent.configuration.scope.loading")}
      value={selectedScope?.key ?? "user"}
    />
  );
}

function ChoiceMenu({
  disabled,
  options,
  value,
  onChange,
}: {
  disabled: boolean;
  options: Array<{ description: string; label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <SettingsChoiceMenu
      disabled={disabled}
      onChange={onChange}
      options={options}
      value={value}
    />
  );
}

function SettingsRowDescription({
  children,
  error,
  lockReason,
}: {
  children: ReactNode;
  error: string | null;
  lockReason: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div>{children}</div>
      {lockReason ? (
        <div className="inline-flex items-center gap-1 text-sm text-token-editor-warning-foreground">
          <WarningIcon className="icon-2xs" />
          <span>{lockReason}</span>
        </div>
      ) : null}
      {error ? <div className="text-sm text-token-error-foreground">{error}</div> : null}
    </div>
  );
}

function DesktopOnlySection({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function normalizeApprovalPolicy(value: ConfigSnapshot["approvalPolicy"]): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeSandboxMode(value: ConfigSnapshot["sandboxMode"]): string | null {
  return value === "read-only" || value === "workspace-write" || value === "danger-full-access"
    ? value
    : null;
}

function parseConfigLayerConfig(config: ConfigSnapshot | null) {
  return {
    approvalPolicy: normalizeApprovalPolicy(config?.approvalPolicy ?? null),
    networkAccess: config?.sandboxWorkspaceWrite?.networkAccess ?? null,
    sandboxMode: normalizeSandboxMode(config?.sandboxMode ?? null),
  };
}

function getScopeLockReason(scope: ConfigScopeOption | null, t: Translate) {
  if (scope == null) {
    return t("settings.agent.configuration.scope.unavailable");
  }
  if (scope.filePath == null) {
    return t("settings.agent.configuration.scope.readOnly");
  }
  return null;
}

function getControlLockReason({
  hasOptions,
  intl,
  originLayer,
  restrictedMessage,
  scopeLockReason,
  selectedScope,
}: {
  hasOptions: boolean;
  intl: Translate;
  originLayer: ConfigLayer | ConfigLayerMetadata | null;
  restrictedMessage: string;
  scopeLockReason: string | null;
  selectedScope: ConfigScopeOption | null;
}) {
  if (scopeLockReason != null) {
    return scopeLockReason;
  }
  if (!hasOptions) {
    return restrictedMessage;
  }
  if (selectedScope?.kind !== "managed" && originLayer != null && isManagedLayer(originLayer)) {
    return intl("settings.agent.configuration.control.managed");
  }
  return null;
}

function isManagedLayer(layer: ConfigLayer | ConfigLayerMetadata) {
  return (
    layer.name.type === "system" ||
    layer.name.type === "mdm" ||
    layer.name.type === "legacyManagedConfigTomlFromFile" ||
    layer.name.type === "legacyManagedConfigTomlFromMdm"
  );
}

function renderConfigTomlDescription(t: Translate) {
  return (
    <>
      {t("settings.agent.configuration.configToml.description")} <span className="block" />
      {t("settings.agent.configuration.configToml.restartNote")}{" "}
      <a
        className="inline-flex items-center gap-1 text-token-text-secondary hover:text-token-text-primary"
        href={CONFIG_TOML_DOCS_URL}
        rel="noreferrer"
        target="_blank"
      >
        {t("settings.agent.configuration.configToml.docs")}
        <LinkExternalIcon className="icon-xxs" />
      </a>
    </>
  );
}

function renderNoticeFileContext(
  locale: LocaleCode,
  t: Translate,
  notice: AgentSettingsNotice,
) {
  if (notice.path == null) {
    return null;
  }

  const location =
    notice.range == null
      ? ""
      : t("settings.agent.configuration.notice.fileLocationSuffix", {
          column: notice.range.start.column,
          line: notice.range.start.line,
        });
  const template = MESSAGES[getMessageLocale(locale)]["settings.agent.configuration.notice.fileContext"];
  return renderMessageWithCodePlaceholder(template, {
    location,
    path: <code>{notice.path}</code>,
  });
}

function renderMessageWithCodePlaceholder(
  template: string,
  values: { location: string; path: ReactNode },
) {
  const pathToken = "{path}";
  const locationToken = "{location}";
  const pathIndex = template.indexOf(pathToken);
  if (pathIndex === -1) {
    return template.replaceAll(locationToken, values.location);
  }

  const prefix = template.slice(0, pathIndex);
  const suffixTemplate = template.slice(pathIndex + pathToken.length);
  const locationIndex = suffixTemplate.indexOf(locationToken);
  if (locationIndex === -1) {
    return (
      <>
        {prefix}
        {values.path}
        {suffixTemplate}
      </>
    );
  }

  const between = suffixTemplate.slice(0, locationIndex);
  const suffix = suffixTemplate.slice(locationIndex + locationToken.length);
  return (
    <>
      {prefix}
      {values.path}
      {between}
      {values.location}
      {suffix}
    </>
  );
}

async function writeAgentConfigValue(params: {
  expectedVersion: string | null;
  filePath: string;
  hostId: string;
  keyPath: string;
  kind: ConfigWriteTargetKind;
  value: string | boolean;
}) {
  if (params.kind === "project") {
    await writeProjectConfigValue({
      filePath: params.filePath,
      hostId: params.hostId,
      keyPath: params.keyPath,
      value: params.value,
    });
    return;
  }

  const writeParams: ConfigWriteForHostParams = {
    expectedVersion: params.expectedVersion,
    filePath: params.filePath,
    hostId: params.hostId,
    keyPath: params.keyPath,
    mergeStrategy: "upsert",
    value: params.value,
  };
  await writeConfigValueForHost(writeParams);
}

type ConfigWriteTargetKind = ConfigScopeOption["kind"];

function buildConfigTomlPath(codexHome: string | null) {
  if (codexHome == null || codexHome.trim().length === 0) {
    return null;
  }
  const trimmed = codexHome.replace(/[\\/]+$/, "");
  const separator = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${separator}config.toml`;
}
