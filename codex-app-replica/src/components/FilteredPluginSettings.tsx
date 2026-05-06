import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import { selectPluginCandidatesByName, type PluginCandidate } from "../lib/pluginSelectors";
import {
  installPlugin,
  readPlugin,
  readPluginsSnapshot,
  uninstallPlugin,
  type PluginDetail,
  type PluginListSnapshot,
  type PluginReadParams,
} from "../services/plugins";

export type FilteredPluginSettingsRenderContext = {
  selectedPlugins: PluginCandidate[];
  isLoading: boolean;
  loadError: string | null;
};

export function FilteredPluginSettings({
  emptyState,
  installButtonLabel,
  pageTitle,
  pluginNames,
  renderAfterSections,
  sectionTitle,
  workspaceRoot,
}: {
  emptyState: string;
  installButtonLabel: string;
  pageTitle: string;
  pluginNames: readonly string[];
  renderAfterSections?: (context: FilteredPluginSettingsRenderContext) => ReactNode;
  sectionTitle: string;
  workspaceRoot: string | null;
}) {
  const { t } = useI18n();
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activePlugin, setActivePlugin] = useState<PluginCandidate | null>(null);
  const [pluginDetail, setPluginDetail] = useState<PluginDetail | null>(null);
  const [detailLoadError, setDetailLoadError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pendingPluginId, setPendingPluginId] = useState<string | null>(null);

  const refreshPlugins = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPluginsSnapshot(await readPluginsSnapshot(workspaceRoot));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      setPluginsSnapshot(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshPlugins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceRoot]);

  useEffect(() => {
    if (activePlugin == null) {
      setPluginDetail(null);
      setDetailLoadError(null);
      setDetailLoading(false);
      return;
    }

    let cancelled = false;
    setPluginDetail(null);
    setDetailLoadError(null);
    setDetailLoading(true);

    void readPlugin(buildPluginParams(activePlugin))
      .then((response) => {
        if (!cancelled) {
          setPluginDetail(response.plugin);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDetailLoadError(error instanceof Error ? error.message : String(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activePlugin]);

  const selectedPlugins = useMemo(
    () => selectPluginCandidatesByName(pluginsSnapshot, pluginNames),
    [pluginNames, pluginsSnapshot],
  );

  const retryLoad = () => {
    void refreshPlugins();
  };
  const afterSections = renderAfterSections?.({
    selectedPlugins,
    isLoading,
    loadError,
  });

  const handleInstall = async (candidate: PluginCandidate) => {
    if (pendingPluginId != null) {
      return;
    }
    setPendingPluginId(candidate.plugin.id);
    try {
      await installPlugin(buildPluginParams(candidate));
      await refreshPlugins();
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setActivePlugin(null);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setDetailLoadError(message);
      } else {
        setLoadError(message);
      }
    } finally {
      setPendingPluginId(null);
    }
  };

  const handleUninstall = async (candidate: PluginCandidate) => {
    if (pendingPluginId != null) {
      return;
    }
    setPendingPluginId(candidate.plugin.id);
    try {
      await uninstallPlugin({ pluginId: candidate.plugin.id });
      await refreshPlugins();
      if (activePlugin?.plugin.id === candidate.plugin.id) {
        setActivePlugin(null);
      }
    } catch (error) {
      setDetailLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setPendingPluginId(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{pageTitle}</div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{sectionTitle}</div>
        <div className="mt-3">
          {isLoading ? (
            <div className="flex min-h-[72px] items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-shell-subtle)] border-t-transparent" />
            </div>
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
          ) : selectedPlugins.length === 0 ? (
            <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">{emptyState}</div>
          ) : (
            <div className="space-y-3">
              {selectedPlugins.map((candidate) => (
                <div
                  key={candidate.plugin.id}
                  onClick={() => setActivePlugin(candidate)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setActivePlugin(candidate);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className="w-full cursor-pointer rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3 text-left transition hover:bg-[var(--app-shell-hover-surface)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[14px] leading-6">{getPluginTitle(candidate)}</div>
                      <div className="app-text-muted mt-1 text-[12px] leading-5">
                        {getPluginDescription(candidate)}
                      </div>
                      <div className="app-text-muted mt-1 truncate text-[11px] leading-5">
                        {candidate.marketplaceLabel}
                        {candidate.marketplacePath ? ` · ${candidate.marketplacePath}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {candidate.plugin.installed ? (
                        <div className="text-[12px] text-[var(--app-shell-subtle)]">
                          {candidate.plugin.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={pendingPluginId === candidate.plugin.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleInstall(candidate);
                          }}
                          className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
                        >
                          {pendingPluginId === candidate.plugin.id
                            ? t("plugins.installModal.installing", { pluginName: getPluginTitle(candidate) })
                            : installButtonLabel}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {afterSections}

      {activePlugin != null ? (
        <PluginDetailDialog
          candidate={activePlugin}
          detail={pluginDetail}
          error={detailLoadError}
          isLoading={detailLoading}
          onClose={() => setActivePlugin(null)}
          onInstall={() => void handleInstall(activePlugin)}
          onUninstall={() => void handleUninstall(activePlugin)}
          pendingPluginId={pendingPluginId}
          onRetry={() => {
            setActivePlugin({ ...activePlugin });
          }}
        />
      ) : null}
    </div>
  );
}

function PluginDetailDialog({
  candidate,
  detail,
  error,
  isLoading,
  onClose,
  onInstall,
  onRetry,
  onUninstall,
  pendingPluginId,
}: {
  candidate: PluginCandidate;
  detail: PluginDetail | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  onInstall: () => void;
  onRetry: () => void;
  onUninstall: () => void;
  pendingPluginId: string | null;
}) {
  const { t } = useI18n();
  const title = getPluginTitle(candidate, detail);
  const description = getPluginDescription(candidate, detail);
  const isPending = pendingPluginId === candidate.plugin.id;
  const headerTitle = candidate.plugin.installed
    ? title
    : t("plugins.installModal.title", { pluginName: title });
  const interfaceInfo = detail?.summary.interface ?? null;
  const capabilities = interfaceInfo?.capabilities ?? [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4 py-6">
      <div
        aria-label={headerTitle}
        aria-modal="true"
        className="app-card w-full max-w-[760px] rounded-[20px] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[18px] font-medium leading-7">{headerTitle}</div>
            <div className="app-text-muted mt-1 text-[12px] leading-5">{candidate.marketplaceLabel}</div>
          </div>
          <button
            type="button"
            aria-label={t("codex.alert.closeAriaLabel")}
            onClick={onClose}
            className="app-control rounded-full px-2 py-1 text-[12px]"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex min-h-[120px] items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-shell-subtle)] border-t-transparent" />
            </div>
          ) : error ? (
            <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">
              <div className="font-medium">{t("skills.appsPage.loadError.title")}</div>
              <div className="app-text-muted mt-1 text-[12px]">{error}</div>
              <button
                type="button"
                onClick={onRetry}
                className="app-control mt-3 rounded-[11px] px-3 py-1.5 text-[12px]"
              >
                {t("skills.appsPage.loadError.retry")}
              </button>
            </div>
          ) : detail == null ? null : (
            <div className="space-y-4">
              <SectionCard title={t("plugins.installModal.about")}>
                <div className="text-[13px] leading-6">{description}</div>
                {interfaceInfo?.developerName ? (
                  <div className="app-text-muted mt-2 text-[12px]">
                    {t("plugins.installModal.developedBy", {
                      developerName: interfaceInfo.developerName,
                    })}
                  </div>
                ) : null}
                {interfaceInfo?.category ? (
                  <div className="app-text-muted mt-1 text-[12px]">
                    {t("plugins.installModal.metadata.category", {
                      category: interfaceInfo.category,
                    })}
                  </div>
                ) : null}
              </SectionCard>

              {capabilities.length > 0 ? (
                <SectionCard title={t("plugins.installModal.capabilities")}>
                  <div className="flex flex-wrap gap-2">
                    {capabilities.map((capability) => (
                      <span
                        key={capability}
                        className="rounded-full border border-[var(--app-shell-border)] px-2 py-1 text-[12px] text-[var(--app-shell-subtle)]"
                      >
                        {capability}
                      </span>
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              <SectionCard title={t("plugins.installModal.includes")}>
                <div className="space-y-3">
                  {detail.apps.length > 0 ? (
                    <DetailList
                      title={t("plugins.installModal.includes.apps")}
                      items={detail.apps.map((app) => ({
                        key: app.id,
                        title: app.name,
                        description: app.description,
                      }))}
                    />
                  ) : null}

                  {detail.skills.length > 0 ? (
                    <DetailList
                      title={t("plugins.installModal.includes.skills")}
                      items={detail.skills.map((skill) => ({
                        key: skill.name,
                        title: skill.name,
                        description: skill.shortDescription ?? skill.description,
                        status: skill.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus"),
                      }))}
                    />
                  ) : null}

                  {detail.mcpServers.length > 0 ? (
                    <DetailList
                      title={t("plugins.installModal.includes.mcpServers")}
                      items={detail.mcpServers.map((server) => ({
                        key: server,
                        title: server,
                        description: null,
                      }))}
                    />
                  ) : null}
                </div>
              </SectionCard>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          {candidate.plugin.installed ? (
            <button
              type="button"
              disabled={isPending}
              onClick={onUninstall}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {t("settings.mcp.detail.uninstall")}
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={onInstall}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
            >
              {isPending ? t("plugins.installModal.installing", { pluginName: title }) : t("plugins.installModal.install", { pluginName: title })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailList({
  items,
  title,
}: {
  items: Array<{ key: string; title: string; description: string | null; status?: string | null }>;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">{title}</div>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[13px] leading-6">{item.title}</div>
              {item.description ? (
                <div className="app-text-muted mt-1 text-[12px] leading-5">{item.description}</div>
              ) : null}
            </div>
            {item.status ? <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">{item.status}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-3">
      <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function buildPluginParams(candidate: PluginCandidate): PluginReadParams {
  return candidate.marketplacePath == null
    ? { pluginName: candidate.plugin.name, remoteMarketplaceName: candidate.marketplaceName }
    : { marketplacePath: candidate.marketplacePath, pluginName: candidate.plugin.name };
}

function getPluginTitle(candidate: PluginCandidate, detail?: PluginDetail | null) {
  return (
    detail?.summary.interface?.displayName ??
    candidate.plugin.interface?.displayName ??
    candidate.plugin.name
  );
}

function getPluginDescription(candidate: PluginCandidate, detail?: PluginDetail | null) {
  return (
    detail?.summary.interface?.longDescription ??
    detail?.summary.interface?.shortDescription ??
    candidate.plugin.interface?.longDescription ??
    candidate.plugin.interface?.shortDescription ??
    candidate.plugin.name
  );
}
