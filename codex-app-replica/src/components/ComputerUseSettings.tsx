import { useI18n } from "../i18n/i18n";
import { FilteredPluginSettings } from "./FilteredPluginSettings";

export function ComputerUseSettings({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t } = useI18n();

  return (
    <FilteredPluginSettings
      workspaceRoot={workspaceRoot}
      pageTitle={t("settings.nav.computer-use")}
      installButtonLabel={t("settings.computerUse.install.button")}
      sectionTitle={t("settings.computerUse.install.title")}
      emptyState={t("settings.computerUse.install.empty")}
      pluginNames={["computer-use"]}
    />
  );
}
