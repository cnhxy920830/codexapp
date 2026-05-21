import { useEffect, useEffectEvent, useState } from "react";
import {
  REPLICA_STATSIG_GATES,
  useReplicaStatsigGateValue,
} from "../features/statsig/replicaStatsig";
import { useI18n } from "../i18n/i18n";
import type { MessageKey } from "../i18n/messages";
import {
  listExperimentalFeaturesForHost,
  setExperimentalFeatureForHost,
  type ExperimentalFeature,
} from "../services/personalization";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";

type ExperimentalFeatureRow = {
  key: string;
  featureName: string;
  label: string;
  description: string | null;
  enabled: boolean;
  showRestartNoteOnSuccess: boolean;
};

const REMOTE_CONTROL_FEATURE_NAME = "remote_control";
const EXCLUDED_BETA_EXPERIMENTAL_FEATURE_NAMES = new Set([
  "memories",
  "multi_agent",
  "plugins",
  "plugin",
  "realtime_conversation",
  REMOTE_CONTROL_FEATURE_NAME,
  "chronicle",
  "workspace_dependencies",
]);

export function AgentExperimentalFeaturesSettings({
  hostId,
}: {
  hostId: string;
}) {
  const { t } = useI18n();
  const experimentalFeaturesGate = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.agentExperimentalFeatures,
  );
  const remoteControlVisibilityGate = useReplicaStatsigGateValue(
    REPLICA_STATSIG_GATES.remoteControlVisibility,
  );
  const [features, setFeatures] = useState<ExperimentalFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showRestartNote, setShowRestartNote] = useState(false);

  const refreshFeatures = useEffectEvent(async () => {
    if (!experimentalFeaturesGate) {
      setFeatures([]);
      setIsLoading(false);
      setShowRestartNote(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextFeatures = await listExperimentalFeaturesForHost(hostId).catch(
        () => [] as ExperimentalFeature[],
      );
      setFeatures(nextFeatures);
    } finally {
      setIsLoading(false);
    }
  });

  useEffect(() => {
    setShowRestartNote(false);
    void refreshFeatures();
  }, [experimentalFeaturesGate, hostId, refreshFeatures]);

  useEffect(() => {
    if (!experimentalFeaturesGate) {
      return;
    }

    const handleFocus = () => {
      void refreshFeatures();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [experimentalFeaturesGate, refreshFeatures]);

  if (!experimentalFeaturesGate) {
    return null;
  }

  const remoteControlFeature = resolveRemoteControlExperimentalFeature(features);
  const rows = buildExperimentalFeatureRows({
    features,
    remoteControlFeature,
    remoteControlVisibilityGate,
    t,
  });

  const updateFeatureEnablement = async (row: ExperimentalFeatureRow, enabled: boolean) => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await setExperimentalFeatureForHost(hostId, row.featureName, enabled);
      setFeatures((current) => applyExperimentalFeatureEnablement(current, row.featureName, enabled));
      if (row.showRestartNoteOnSuccess) {
        setShowRestartNote(true);
      }
    } catch {
      // Keep the previous UI state when the host rejects the toggle update.
    } finally {
      setIsSaving(false);
    }
  };

  const hasRows = rows.length > 0;

  return (
    <SettingsGroup>
      <SettingsGroup.Header
        title={t("settings.general.experimentalFeatures")}
        subtitle={
          showRestartNote ? t("settings.general.experimentalFeatures.restartNote") : undefined
        }
      />
      <SettingsGroup.Content>
        <SettingsSurface>
          {isLoading ? (
            <SettingsRow
              label={t("settings.general.experimentalFeatures.loading")}
              control={<span className="h-5 w-8 shrink-0" aria-hidden="true" />}
            />
          ) : null}
          {!isLoading && !hasRows ? (
            <SettingsRow
              label={t("settings.general.experimentalFeatures.empty")}
              control={<span className="h-5 w-8 shrink-0" aria-hidden="true" />}
            />
          ) : null}
          {rows.map((row) => (
            <SettingsRow
              key={row.key}
              label={row.label}
              description={row.description}
              control={
                <ToggleSwitch
                  checked={row.enabled}
                  disabled={isSaving}
                  onChange={(enabled) => void updateFeatureEnablement(row, enabled)}
                  ariaLabel={t("settings.general.experimentalFeatures.toggle", {
                    featureName: row.label,
                  })}
                />
              }
            />
          ))}
        </SettingsSurface>
      </SettingsGroup.Content>
    </SettingsGroup>
  );
}

function buildExperimentalFeatureRows({
  features,
  remoteControlFeature,
  remoteControlVisibilityGate,
  t,
}: {
  features: ExperimentalFeature[];
  remoteControlFeature: ExperimentalFeature | null;
  remoteControlVisibilityGate: boolean;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  const rows: ExperimentalFeatureRow[] = [];
  const appsFeatureEnabled = features.some(
    (feature) => feature.name === "apps" && feature.enabled,
  );
  const pluginsFeature =
    features.find((feature) => feature.name === "plugins") ?? null;

  if (remoteControlVisibilityGate && remoteControlFeature !== null) {
    rows.push({
      key: remoteControlFeature.name,
      featureName: remoteControlFeature.name,
      label: t("settings.remoteControlConnections.localRemoteControl.label"),
      description: t(
        "settings.remoteControlConnections.localRemoteControl.description",
      ),
      enabled: remoteControlFeature.enabled,
      showRestartNoteOnSuccess: false,
    });
  }

  if (appsFeatureEnabled) {
    rows.push({
      key: "plugins",
      featureName: "plugins",
      label: t("settings.general.experimentalFeatures.plugins.label"),
      description:
        pluginsFeature?.description ??
        t("settings.general.experimentalFeatures.plugins.description"),
      enabled: pluginsFeature?.enabled ?? true,
      showRestartNoteOnSuccess: true,
    });
  }

  for (const feature of features) {
    if (!isEligibleBetaExperimentalFeature(feature)) {
      continue;
    }

    rows.push({
      key: feature.name,
      featureName: feature.name,
      label: feature.displayName ?? feature.name,
      description: feature.description,
      enabled: feature.enabled,
      showRestartNoteOnSuccess: true,
    });
  }

  return rows;
}

function isEligibleBetaExperimentalFeature(feature: ExperimentalFeature) {
  return (
    feature.stage === "beta" &&
    !EXCLUDED_BETA_EXPERIMENTAL_FEATURE_NAMES.has(feature.name)
  );
}

function resolveRemoteControlExperimentalFeature(
  features: ExperimentalFeature[],
) {
  return (
    features.find(
      (feature) => feature.name === REMOTE_CONTROL_FEATURE_NAME,
    ) ?? null
  );
}

function applyExperimentalFeatureEnablement(
  features: ExperimentalFeature[],
  featureName: string,
  enabled: boolean,
) {
  const nextFeatures = features.map((feature) =>
    feature.name === featureName
      ? {
          ...feature,
          enabled,
        }
      : feature,
  );

  if (nextFeatures.some((feature) => feature.name === featureName)) {
    return nextFeatures;
  }

  return [
    ...nextFeatures,
    {
      name: featureName,
      stage: "beta",
      displayName: null,
      description: null,
      announcement: null,
      enabled,
      defaultEnabled: enabled,
    },
  ];
}
