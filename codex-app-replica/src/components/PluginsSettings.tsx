import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n";
import {
  readPluginsSnapshot,
  type PluginListSnapshot,
  type PluginMarketplaceEntry,
  type PluginSummary,
} from "../services/plugins";

type MarketplaceGroup = PluginMarketplaceEntry & {
  plugins: PluginSummary[];
};

export function PluginsSettings({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t } = useI18n();
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadPlugins = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextSnapshot = await readPluginsSnapshot(workspaceRoot);
        if (!cancelled) {
          setPluginsSnapshot(nextSnapshot);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setPluginsSnapshot(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPlugins();

    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  const filteredMarketplaces = useMemo<MarketplaceGroup[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const marketplaces = pluginsSnapshot?.marketplaces ?? [];

    return marketplaces
      .map((marketplace) => {
        const installedPlugins = marketplace.plugins
          .filter((plugin) => plugin.installed)
          .filter((plugin) => {
            if (!query) {
              return true;
            }
            return buildPluginSearchText(marketplace, plugin).includes(query);
          })
          .sort(comparePlugins);

        return {
          ...marketplace,
          plugins: installedPlugins,
        };
      })
      .filter((marketplace) => marketplace.plugins.length > 0)
      .sort(compareMarketplaces);
  }, [pluginsSnapshot, searchQuery]);

  const retryLoad = () => {
    setLoadError(null);
    setIsLoading(true);
    void readPluginsSnapshot(workspaceRoot)
      .then((nextSnapshot) => {
        setPluginsSnapshot(nextSnapshot);
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : String(error));
        setPluginsSnapshot(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("skills.appsPage.heading.plugins")}</div>
        <div className="app-text-muted mt-1 text-[13px] leading-6">
          {t("skills.appsPage.subheading.plugins")}
        </div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <input
          aria-label={t("skills.appsPage.search.plugins.label")}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t("skills.appsPage.search.plugins")}
          className="app-control app-text-input min-w-0 w-full rounded-[12px] px-3 py-2 text-[13px] outline-none"
        />
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        {isLoading ? (
          <div className="app-text-muted py-6 text-[13px]">{t("skills.appsPage.loading")}</div>
        ) : loadError ? (
          <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
            <div className="font-medium">{t("skills.appsPage.loadError.title")}</div>
            <div className="app-text-muted mt-1 text-[12px]">{loadError}</div>
            <button
              type="button"
              onClick={() => void retryLoad()}
              className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t("skills.appsPage.loadError.retry")}
            </button>
          </div>
        ) : filteredMarketplaces.length === 0 ? (
          <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
            <div>{t("skills.appsPage.empty.plugins")}</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMarketplaces.map((marketplace) => (
              <section
                key={marketplace.name}
                className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
                      {marketplace.interface?.displayName ?? marketplace.name}
                    </div>
                    {marketplace.path ? (
                      <div className="app-text-muted mt-1 truncate text-[11px] leading-5">{marketplace.path}</div>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
                    {marketplace.plugins.length}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {marketplace.plugins.map((plugin) => {
                    const title = plugin.interface?.displayName ?? plugin.name;
                    const description =
                      plugin.interface?.shortDescription ?? plugin.interface?.longDescription ?? plugin.name;

                    return (
                      <div
                        key={plugin.id}
                        className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[14px] leading-6">{title}</div>
                            <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
                            <div className="app-text-muted mt-1 truncate text-[11px] leading-5">{plugin.id}</div>
                          </div>
                          <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
                            {plugin.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function compareMarketplaces(left: MarketplaceGroup, right: MarketplaceGroup) {
  return getMarketplaceLabel(left).localeCompare(getMarketplaceLabel(right));
}

function comparePlugins(left: PluginSummary, right: PluginSummary) {
  return getPluginLabel(left).localeCompare(getPluginLabel(right));
}

function getMarketplaceLabel(marketplace: PluginMarketplaceEntry) {
  return (marketplace.interface?.displayName ?? marketplace.name).toLowerCase();
}

function getPluginLabel(plugin: PluginSummary) {
  return (plugin.interface?.displayName ?? plugin.name).toLowerCase();
}

function buildPluginSearchText(marketplace: PluginMarketplaceEntry, plugin: PluginSummary) {
  return [
    marketplace.name,
    marketplace.interface?.displayName ?? "",
    marketplace.path ?? "",
    plugin.id,
    plugin.name,
    plugin.interface?.displayName ?? "",
    plugin.interface?.shortDescription ?? "",
    plugin.interface?.longDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
}
