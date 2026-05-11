import { useEffect, useState } from "react";
import type { ExternalAgentImportItem } from "../../../services/externalAgentImport";
import { detectExternalAgentImports } from "../../../services/externalAgentImport";
import { getAvailableExternalAgentProviders } from "./importModel";
import { EXTERNAL_AGENT_PROVIDER_IDS, type ExternalAgentProviderId } from "./types";

type UseExternalAgentImportDetectionParams = {
  enabled: boolean;
};

export function useExternalAgentImportDetection({ enabled }: UseExternalAgentImportDetectionParams) {
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
      setIsDetectingImports(true);
      try {
        const response = await detectExternalAgentImports({
          includeHome: true,
          providers: [...EXTERNAL_AGENT_PROVIDER_IDS],
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
  }, [enabled]);

  return {
    detectedItems,
    isDetectingImports,
    providerIds,
    selectedProviders,
    setSelectedProviders,
  };
}
