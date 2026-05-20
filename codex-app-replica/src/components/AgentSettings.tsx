import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { ArrowTopRightIcon, CheckIcon, ChevronDownIcon, WarningIcon } from "./AppShellIcons";
import type { AppToast } from "./AppToastRegion";
import { AgentExperimentalFeaturesSettings } from "./AgentExperimentalFeaturesSettings";
import { Button } from "./Button";
import { MarkdownPreview } from "./MarkdownPreview";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import { WorkspaceDependenciesSettings } from "./WorkspaceDependenciesSettings";
import { useReplicaStatsigDefaultFeatures, useReplicaStatsigGateValue } from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import type { MessageKey, MessageValues } from "../i18n/messages";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import { getCodexHomePath } from "../services/codexHome";
import { openFile } from "../services/hostFiles";
import { readOpenInTargets } from "../services/openTargets";
import {
  buildConfigScopeOptions,
  chooseDefaultConfigScopeKey,
  getConfigurationValue,
  getConfigRequirementsForHost,
  onAgentSettingsNoticesChanged,
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
  writeConfigValueForHost,
} from "../services/settings";
import { LOCAL_SETTINGS_HOST_ID } from "../services/settingsHosts";

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
  hostId,
  onNavigateToOpenSourceLicenses,
  onShowToast,
  settingsCwd = null,
  settingsWorkspaceRoot = null,
}: {
  hostId: string;
  onNavigateToOpenSourceLicenses: () => void;
  onShowToast?: (toast: AppToast) => void;
  settingsCwd?: string | null;
  settingsWorkspaceRoot?: string | null;
}) {
  const { t } = useI18n();
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
  const [preferredOpenTarget, setPreferredOpenTarget] = useState<string | null>(null);
  const [preferredConfigTomlOpenTarget, setPreferredConfigTomlOpenTarget] = useState<string | null>(null);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [pendingControlKey, setPendingControlKey] = useState<AgentConfigControlErrorKey | null>(null);
  const [codexHome, setCodexHome] = useState<string | null>(null);
  const [runCodexInWsl, setRunCodexInWsl] = useState(false);
  const lastLoadRequestIdRef = useRef(0);

  const loadConfigState = useEffectEvent(async () => {
    const requestId = ++lastLoadRequestIdRef.current;
    setIsConfigLoading(true);
    try {
      const [configResponse, requirementsResponse, noticesResponse, openTargetsResponse] = await Promise.all([
        readConfigForHost({
          hostId,
          cwd: settingsWorkspaceRoot,
          includeLayers: true,
        }),
        getConfigRequirementsForHost({ hostId }),
        readAgentSettingsNotices(hostId),
        readOpenInTargets({
          cwd: settingsWorkspaceRoot ?? settingsCwd,
          hostId,
        }).catch(() => null),
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
      setPreferredOpenTarget(openTargetsResponse?.preferredTarget ?? null);
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
      setPreferredOpenTarget(null);
      setPreferredConfigTomlOpenTarget(null);
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
  }, [hostId, loadConfigState, settingsCwd, settingsWorkspaceRoot]);

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
    if (!isLocalHost) {
      setCodexHome(null);
      setRunCodexInWsl(false);
      return;
    }

    let cancelled = false;

    void Promise.all([
      getCodexHomePath().catch(() => null),
      getConfigurationValue(RUN_CODEX_IN_WSL_KEY).catch(() => ({ value: null })),
      readOpenInTargets({
        cwd: null,
        hostId,
      }).catch(() => null),
    ]).then(([nextCodexHome, configuration, openTargetsResponse]) => {
      if (cancelled) {
        return;
      }
      setCodexHome(nextCodexHome);
      setRunCodexInWsl(configuration.value === true);
      setPreferredConfigTomlOpenTarget(openTargetsResponse?.preferredTarget ?? null);
    });

    return () => {
      cancelled = true;
    };
  }, [hostId, isLocalHost]);

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
  const configTomlPath = codexHome == null ? null : `${codexHome.replace(/[\\/]+$/, "")}\\config.toml`;
  const configTomlButtonLabel = runCodexInWsl
    ? t("settings.agent.openConfigTomlWsl")
    : t("settings.agent.openConfigToml");

  const handleOpenSelectedConfig = async () => {
    if (selectedScope?.filePath == null) {
      return;
    }

    try {
      await openFile({
        hostId,
        path: selectedScope.filePath,
        cwd: selectedScope.workspaceRoot ?? settingsWorkspaceRoot ?? settingsCwd,
        target: preferredOpenTarget,
      });
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleOpenConfigToml = async () => {
    if (!isLocalHost || configTomlPath == null) {
      return;
    }

    try {
      await openFile({
        hostId,
        path: configTomlPath,
        target: preferredConfigTomlOpenTarget,
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
      const params: ConfigWriteForHostParams = {
        expectedVersion: selectedScope.expectedVersion ?? null,
        filePath: selectedScope.filePath,
        hostId,
        keyPath,
        mergeStrategy: "upsert",
        value,
      };
      await writeConfigValueForHost(params);
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
                    disabled={!isLocalHost || configTomlPath == null}
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
  notice,
  total,
}: {
  hostId: string;
  index: number;
  notice: AgentSettingsNotice;
  total: number;
}) {
  const { t } = useI18n();

  return (
    <div className={index === total - 1 ? "mb-3" : "mb-2"}>
      <div className="rounded-xl border border-token-status-warning-foreground/30 bg-token-status-warning-background/30 px-3 py-3">
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
                  {t("settings.agent.configuration.notice.fileContext", {
                    location:
                      notice.range == null
                        ? ""
                        : t("settings.agent.configuration.notice.fileLocationSuffix", {
                            column: notice.range.start.column,
                            line: notice.range.start.line,
                          }),
                    path: notice.path,
                  })}
                </div>
              ) : null}
            </div>
            {notice.path ? (
              <Button
                className="inline-flex w-fit shrink-0"
                color="secondary"
                size="toolbar"
                    onClick={() =>
                      void openFile({
                        hostId,
                        path: notice.path!,
                        ...(notice.range == null
                          ? {}
                          : {
                              column: notice.range.start.column,
                              line: notice.range.start.line,
                            }),
                      })
                    }
              >
                {t("settings.agent.configuration.notice.openFile")}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  return (
    <div className="relative w-[240px] max-w-full" ref={containerRef}>
      <Button
        className="w-[240px] justify-between"
        color="secondary"
        disabled={globalScopeOptions.length + projectScopeOptions.length === 0}
        size="toolbar"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">
          {selectedScope?.label ?? t("settings.agent.configuration.scope.loading")}
        </span>
        <ChevronDownIcon className="icon-2xs shrink-0 text-token-input-placeholder-foreground" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-[240px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          {projectScopeOptions.length > 0 ? (
            <>
              <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
                {t("settings.agent.configuration.scope.projectGroup")}
              </div>
              {projectScopeOptions.map((scope) => (
                <ScopeMenuItem
                  key={scope.key}
                  selected={scope.key === selectedScope?.key}
                  title={scope.filePath ?? undefined}
                  onSelect={() => {
                    setIsOpen(false);
                    onSelect(scope.key);
                  }}
                >
                  {scope.label}
                </ScopeMenuItem>
              ))}
              <div className="my-2 h-px bg-token-border" />
            </>
          ) : null}
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--app-shell-subtle)]">
            {t("settings.agent.configuration.scope.globalGroup")}
          </div>
          {globalScopeOptions.map((scope) => (
            <ScopeMenuItem
              key={scope.key}
              selected={scope.key === selectedScope?.key}
              title={
                scope.kind === "managed"
                  ? t("settings.agent.configuration.scope.managedDescription")
                  : scope.filePath ?? undefined
              }
              onSelect={() => {
                setIsOpen(false);
                onSelect(scope.key);
              }}
            >
              {scope.kind === "user"
                ? t("settings.agent.configuration.scope.user")
                : scope.kind === "managed"
                  ? t("settings.agent.configuration.scope.managed")
                  : scope.label}
            </ScopeMenuItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScopeMenuItem({
  children,
  onSelect,
  selected,
  title,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  selected: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className={[
        "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-left text-[13px]",
        selected ? "app-nav-item-active" : "app-nav-item-idle",
      ].join(" ")}
      onClick={onSelect}
    >
      <span className="truncate text-sm">{children}</span>
      {selected ? <CheckIcon className="icon-2xs shrink-0 text-token-text-secondary" /> : null}
    </button>
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <div className="relative w-[280px] max-w-full" ref={containerRef}>
      <Button
        className="w-full justify-between"
        color="secondary"
        disabled={disabled}
        size="toolbar"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate text-left">{selectedOption?.label ?? value}</span>
        <ChevronDownIcon className="icon-2xs shrink-0 text-token-text-secondary" />
      </Button>
      {isOpen ? (
        <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
          <div className="max-h-80 overflow-y-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={[
                  "flex w-full items-start justify-between gap-3 rounded-[10px] px-3 py-2 text-left",
                  option.value === value ? "app-nav-item-active" : "app-nav-item-idle",
                ].join(" ")}
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{option.label}</span>
                  <span className="mt-1 block text-sm text-token-text-secondary">{option.description}</span>
                </span>
                {option.value === value ? <CheckIcon className="icon-2xs shrink-0 text-token-text-secondary" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsRowDescription({
  children,
  error,
  lockReason,
}: {
  children: React.ReactNode;
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

function DesktopOnlySection({ children }: { children: React.ReactNode }) {
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
        <ArrowTopRightIcon className="icon-xxs" />
      </a>
    </>
  );
}
