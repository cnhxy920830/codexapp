import { useState } from "react";
import { HomepageLogo } from "../../components/HomepageLogo";
import { useI18n } from "../../i18n/i18n";
import type { ComposerEnterBehavior } from "../../services/settings";
import type { PendingWorktreeStartingState } from "../../services/pendingWorktrees";
import type { TurnStartPermissionOverrides } from "../../services/history";
import { HotkeyWindowDetailLayout } from "./HotkeyWindowDetailLayout";
import { HotkeyWindowNewThreadComposerOwner } from "./HotkeyWindowNewThreadComposerOwner";
import {
  HotkeyWindowProjectMenuControl,
  type HotkeyWindowProjectSelection,
} from "./HotkeyWindowProjectMenuControl";

export function HotkeyWindowNewThreadPage({
  codexHome,
  composerEnterBehavior,
  guardianApprovalEnabledByStatsig,
  initialProjectSelection,
  onOpenCreateRemoteProject,
  onOpenLocalEnvironmentsSettings,
  onStartCloudConversation,
  onStartLocalConversation,
  onStartWorktreeConversation,
}: {
  codexHome: string | null;
  composerEnterBehavior: ComposerEnterBehavior;
  guardianApprovalEnabledByStatsig: boolean;
  initialProjectSelection: HotkeyWindowProjectSelection | null;
  onOpenCreateRemoteProject: () => void;
  onOpenLocalEnvironmentsSettings: (params: {
    configPath: string | null;
    hostId: string | null;
    workspaceRoot: string;
  }) => void;
  onStartCloudConversation: (params: {
    draft: string;
    hostId: string | null;
    cwd: string;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoots: string[];
  }) => Promise<void>;
  onStartLocalConversation: (params: {
    draft: string;
    hostId: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    workspaceRoot: string | null;
    workspaceRoots: string[];
  }) => Promise<void>;
  onStartWorktreeConversation: (params: {
    hostId: string;
    id: string;
    localEnvironmentConfigPath: string | null;
    permissionOverrides: TurnStartPermissionOverrides;
    prompt: string;
    startingState: PendingWorktreeStartingState;
    workspaceRoot: string;
  }) => Promise<void>;
}) {
  const { t } = useI18n();
  const [selectedProject, setSelectedProject] = useState<HotkeyWindowProjectSelection>(
    initialProjectSelection ?? { kind: "projectless" },
  );

  return (
    <main aria-label={t("threadPage.newThread")} className="h-full p-1" role="main">
      <HotkeyWindowDetailLayout canCollapseToHome={false} mainWindowPath="/" title={t("threadPage.newThread")}>
        <div className="h-full [--padding-panel:calc(var(--padding-panel-base)/2)]">
          <div className="relative h-full overflow-y-auto [scrollbar-gutter:stable_both-edges]">
            <div className="flex min-h-full shrink-0 flex-col justify-start">
              <div className="flex flex-1 items-center justify-center px-panel py-10">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div aria-hidden="true">
                    <HomepageLogo className="h-12 w-12 text-token-foreground/20" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div className="heading-xl mt-2 font-normal text-token-foreground select-none">
                      {t("home.hero.letsBuild")}
                    </div>
                    <HotkeyWindowProjectMenuControl
                      codexHome={codexHome}
                      initialSelection={initialProjectSelection}
                      onAddRemoteProject={onOpenCreateRemoteProject}
                      onSelectedProjectChange={setSelectedProject}
                      variant="hero"
                    />
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 z-10 mt-auto w-full pb-2">
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-full w-full justify-center pt-4">
                  <div className="h-full w-full bg-gradient-to-t from-token-main-surface-primary via-token-main-surface-primary" />
                </div>
                <div className="relative z-10 flex flex-col">
                  <HotkeyWindowNewThreadComposerOwner
                    codexHome={codexHome}
                    composerEnterBehavior={composerEnterBehavior}
                    guardianApprovalEnabledByStatsig={guardianApprovalEnabledByStatsig}
                    selectedProject={selectedProject}
                    onOpenLocalEnvironmentsSettings={onOpenLocalEnvironmentsSettings}
                    onStartCloudConversation={onStartCloudConversation}
                    onStartLocalConversation={onStartLocalConversation}
                    onStartWorktreeConversation={onStartWorktreeConversation}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </HotkeyWindowDetailLayout>
    </main>
  );
}
