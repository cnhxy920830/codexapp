import { PluginsSettings } from "../../components/PluginsSettings";
import { SkillsSettings } from "../../components/SkillsSettings";
import { useI18n } from "../../i18n/i18n";

type SkillsRoutePageProps = {
  authMethod: string | null;
  isPluginsRouteEnabled: boolean;
  workspaceRoot: string | null;
};

export function SkillsRoutePage({
  authMethod,
  isPluginsRouteEnabled,
  workspaceRoot,
}: SkillsRoutePageProps) {
  const { t } = useI18n();

  if (authMethod !== "chatgpt") {
    return <SkillsSettings workspaceRoot={workspaceRoot} />;
  }

  if (!isPluginsRouteEnabled) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center py-8">
        <div className="w-full max-w-md text-center">
          <div className="app-title text-[18px] font-medium">
            {t("skills.appsPage.pluginsUnsupportedHost.title")}
          </div>
          <div className="app-text-muted mt-3 text-[14px] leading-6">
            {t("skills.appsPage.pluginsUnsupportedHost.description")}
          </div>
        </div>
      </div>
    );
  }

  return <PluginsSettings workspaceRoot={workspaceRoot} />;
}
