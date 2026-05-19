import type { AppToast } from "./AppToastRegion";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { PluginsPage } from "../features/skills/PluginsPage";
import type { SkillsChatRequest } from "../features/skills/types";
import type { RemoteConnection } from "../services/settingsHosts";

export function PluginsSettings({
  codexHome,
  connectedRemoteConnections,
  onOpenChatWithPrompt,
  onSelectHost,
  onShowToast,
  remoteConnectionHostIds,
  selectedHostId,
  workspaceRoot,
}: {
  codexHome: string | null;
  connectedRemoteConnections: RemoteConnection[];
  onOpenChatWithPrompt?: (request: SkillsChatRequest) => void;
  onSelectHost: (hostId: string) => void;
  onShowToast?: (toast: AppToast) => void;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  return (
    <SettingsContentLayout>
      <PluginsPage
        codexHome={codexHome}
        connectedRemoteConnections={connectedRemoteConnections}
        onOpenChatWithPrompt={onOpenChatWithPrompt}
        onSelectHost={onSelectHost}
        onShowToast={onShowToast}
        remoteConnectionHostIds={remoteConnectionHostIds}
        selectedHostId={selectedHostId}
        workspaceRoot={workspaceRoot}
      />
    </SettingsContentLayout>
  );
}
