import { useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    if (!experimentalFeaturesGate) {
      setFeatures([]);
      setIsLoading(false);
      setShowRestartNote(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setShowRestartNote(false);

    void listExperimentalFeaturesForHost(hostId)
      .then((nextFeatures) => {
        if (cancelled) {
          return;
        }
        setFeatures(nextFeatures);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setFeatures([]);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [experimentalFeaturesGate, hostId]);

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
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
        {t("settings.general.experimentalFeatures")}
      </div>
      {showRestartNote ? (
        <div className="mt-2 text-[12px] font-medium leading-5 text-[var(--app-shell-error-text)]">
          {t("settings.general.experimentalFeatures.restartNote")}
        </div>
      ) : null}
      <div className="mt-4 space-y-5">
        {isLoading ? (
          <ExperimentalFeatureRowView
            label={t("settings.general.experimentalFeatures.loading")}
            description={null}
            control={<span className="h-5 w-8 shrink-0" aria-hidden="true" />}
          />
        ) : null}
        {!isLoading && !hasRows ? (
          <ExperimentalFeatureRowView
            label={t("settings.general.experimentalFeatures.empty")}
            description={null}
            control={<span className="h-5 w-8 shrink-0" aria-hidden="true" />}
          />
        ) : null}
        {rows.map((row) => (
          <ExperimentalFeatureRowView
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
      </div>
    </div>
  );
}

function ExperimentalFeatureRowView({
  label,
  description,
  control,
}: {
  label: string;
  description: string | null;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] leading-6">{label}</div>
        {description ? (
          <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
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
