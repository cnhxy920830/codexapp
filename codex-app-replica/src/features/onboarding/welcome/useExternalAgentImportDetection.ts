import { useEffect, useState } from "react";
import type { ExternalAgentImportItem } from "../../../services/externalAgentImport";
import { detectExternalAgentImports } from "../../../services/externalAgentImport";
import { getAvailableExternalAgentProviders } from "./importModel";
import { EXTERNAL_AGENT_PROVIDER_IDS, type ExternalAgentProviderId } from "./types";

type UseExternalAgentImportDetectionParams = {
  enabled: boolean;
  isCoworkMigrationEnabled: boolean;
};

export function useExternalAgentImportDetection({
  enabled,
  isCoworkMigrationEnabled,
}: UseExternalAgentImportDetectionParams) {
  const [detectedItems, setDetectedItems] = useState<ExternalAgentImportItem[]>([]);
  const [providerIds, setProviderIds] = useState<ExternalAgentProviderId[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<ExternalAgentProviderId[]>([]);
  const [isDetectingImports, setIsDetectingImports] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDetectedItems([]);
      setProviderIds([]);
      setSelectedProviders([]);
      setIsDetectingImports(false);
      return;
    }

    let cancelled = false;

    const loadDetectedImports = async () => {
      const providers = isCoworkMigrationEnabled
        ? [...EXTERNAL_AGENT_PROVIDER_IDS]
        : EXTERNAL_AGENT_PROVIDER_IDS.filter((providerId) => providerId === "claude-code");
      setIsDetectingImports(true);
      try {
        const response = await detectExternalAgentImports({
          includeHome: true,
          providers,
          workspaceRoots: null,
        });
        if (cancelled) {
          return;
        }

        setDetectedItems(response.items);
        const nextProviderIds = getAvailableExternalAgentProviders(response.items);
        setProviderIds(nextProviderIds);
        setSelectedProviders(nextProviderIds);
      } catch {
        if (!cancelled) {
          setDetectedItems([]);
          setProviderIds([]);
          setSelectedProviders([]);
        }
      } finally {
        if (!cancelled) {
          setIsDetectingImports(false);
        }
      }
    };

    void loadDetectedImports();

    return () => {
      cancelled = true;
    };
  }, [enabled, isCoworkMigrationEnabled]);

  return {
    detectedItems,
    isDetectingImports,
    providerIds,
    selectedProviders,
    setSelectedProviders,
  };
}
