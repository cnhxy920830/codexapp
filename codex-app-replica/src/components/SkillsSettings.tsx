import { SettingsContentLayout } from "./SettingsContentLayout";
import type { AppToast } from "./AppToastRegion";
import { SkillsRoutePage } from "../features/skills/SkillsRoutePage";
import type { SkillsChatRequest } from "../features/skills/types";
import type { RemoteConnection } from "../services/settingsHosts";

export function SkillsSettings({
  authMethod,
  codexHome,
  connectedRemoteConnections,
  onOpenChatWithPrompt,
  onSelectHost,
  onShowToast,
  remoteConnectionHostIds,
  selectedHostId,
  workspaceRoot,
}: {
  authMethod: string | null;
  codexHome: string | null;
  connectedRemoteConnections: RemoteConnection[];
  onOpenChatWithPrompt: (request: SkillsChatRequest) => void;
  onSelectHost: (hostId: string) => void;
  onShowToast: (toast: AppToast) => void;
  remoteConnectionHostIds: string[];
  selectedHostId: string;
  workspaceRoot: string | null;
}) {
  return (
    <SettingsContentLayout fullWidth contentClassName="max-w-none">
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkillsRoutePage
          authMethod={authMethod}
          codexHome={codexHome}
          connectedRemoteConnections={connectedRemoteConnections}
          initialTab="skills"
          isPluginsRouteEnabled={false}
          onConsumeInitialState={() => undefined}
          onOpenChatWithPrompt={onOpenChatWithPrompt}
          onSelectHost={onSelectHost}
          onShowToast={onShowToast}
          remoteConnectionHostIds={remoteConnectionHostIds}
          selectedHostId={selectedHostId}
          workspaceRoot={workspaceRoot}
        />
      </div>
    </SettingsContentLayout>
  );
}
