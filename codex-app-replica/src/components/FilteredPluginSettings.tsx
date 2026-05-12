import { useEffect, useEffectEvent, useMemo, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { ToggleSwitch } from "./ToggleSwitch";
import { useI18n } from "../i18n/i18n";
import { selectPluginCandidatesByName, type PluginCandidate } from "../lib/pluginSelectors";
import {
  onQueryCacheInvalidated,
  queryKeyMatchesPrefix,
  type QueryCacheInvalidateNotification,
} from "../services/queryCache";
import {
  installPlugin,
  readPlugin,
  readPluginsSnapshot,
  setPluginEnabled,
  uninstallPlugin,
  type PluginDetail,
  type PluginListSnapshot,
  type PluginReadParams,
} from "../services/plugins";

const PLUGIN_QUERY_KEY = ["plugins"] as const;

export type FilteredPluginSettingsRenderContext = {
  selectedPlugins: PluginCandidate[];
  isLoading: boolean;
  loadError: string | null;
};

type FilteredPluginSettingsItemPresentation = {
  controlLabel?: string;
  description?: ReactNode;
  icon?: ReactNode;
  showIconBorder?: boolean;
  title?: ReactNode;
};

export function FilteredPluginSettings({
  emptyState,
  getItemPresentation,
  hostId,
  installButtonLabel,
  pluginNames,
  renderAfterSections,
  workspaceRoot,
}: {
  emptyState: string;
  getItemPresentation?: (candidate: PluginCandidate) => FilteredPluginSettingsItemPresentation;
  hostId?: string | null;
  installButtonLabel: string;
  pluginNames: readonly string[];
  renderAfterSections?: (context: FilteredPluginSettingsRenderContext) => ReactNode;
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
      setPluginsSnapshot(await readPluginsSnapshot(workspaceRoot, hostId));
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
  }, [hostId, workspaceRoot]);

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

    void readPlugin(buildPluginParams(activePlugin, hostId))
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
  }, [activePlugin, hostId]);

  const selectedPlugins = useMemo(
    () => selectPluginCandidatesByName(pluginsSnapshot, pluginNames),
    [pluginNames, pluginsSnapshot],
  );

  useEffect(() => {
    if (activePlugin == null) {
      return;
    }

    const nextActivePlugin =
      selectedPlugins.find((candidate) => candidate.plugin.id === activePlugin.plugin.id) ?? null;
    if (nextActivePlugin === activePlugin) {
      return;
    }

    setActivePlugin(nextActivePlugin);
  }, [activePlugin, selectedPlugins]);

  const handleQueryCacheInvalidate = useEffectEvent((notification: QueryCacheInvalidateNotification) => {
    if (!queryKeyMatchesPrefix(notification.queryKey, PLUGIN_QUERY_KEY)) {
      return;
    }

    void refreshPlugins();
  });

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void onQueryCacheInvalidated((notification) => {
      if (!disposed) {
        handleQueryCacheInvalidate(notification);
      }
    }).then((dispose) => {
      if (disposed) {
        void dispose();
        return;
      }

      unlisten = dispose;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

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
      await installPlugin(buildPluginParams(candidate, hostId));
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

  const handleToggleEnabled = async (candidate: PluginCandidate, enabled: boolean) => {
    if (pendingPluginId != null || !candidate.plugin.installed || candidate.plugin.enabled === enabled) {
      return;
    }

    setPendingPluginId(candidate.plugin.id);
    try {
      await setPluginEnabled({
        hostId,
        pluginId: candidate.plugin.id,
        enabled,
      });
      await refreshPlugins();
      setDetailLoadError(null);
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
      await uninstallPlugin({ hostId, pluginId: candidate.plugin.id });
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
    <>
      {isLoading ? (
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="flex min-h-[72px] items-center justify-center">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--app-shell-subtle)] border-t-transparent" />
          </div>
        </div>
      ) : loadError ? (
        <div className="app-card rounded-[18px] px-5 py-4">
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
        </div>
      ) : selectedPlugins.length === 0 ? (
        <div className="app-card rounded-[18px] px-5 py-4">
          <div className="app-card-muted rounded-[12px] px-3 py-2 text-[13px] leading-6">{emptyState}</div>
        </div>
      ) : (
        <div className="app-card overflow-hidden rounded-[18px] px-2 py-2">
          {selectedPlugins.map((candidate) => {
            const presentation = getItemPresentation?.(candidate);
            const title = presentation?.title ?? getPluginTitle(candidate);
            const description = presentation?.description ?? getPluginDescription(candidate);
            const controlLabel = presentation?.controlLabel ?? getPluginTitle(candidate);
            const isPending = pendingPluginId === candidate.plugin.id;
            const iconBorderClass =
              presentation?.showIconBorder === false
                ? "border-transparent bg-transparent"
                : "border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]";
            const toggleTooltip = candidate.plugin.enabled
              ? t("settings.pluginControls.disableToggleTooltip", { pluginName: controlLabel })
              : t("settings.pluginControls.enableToggleTooltip", { pluginName: controlLabel });

            return (
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
                className="group flex min-h-[60px] cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[var(--app-shell-hover-surface)] max-sm:flex-wrap"
              >
                {presentation?.icon ? (
                  <div className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px]", iconBorderClass].join(" ")}>
                    {presentation.icon}
                  </div>
                ) : null}

                <div className="min-w-0 flex-1">
                  <div className="text-[14px] leading-6">{title}</div>
                  <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
                </div>

                <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                  {candidate.plugin.installed ? (
                    <div title={toggleTooltip}>
                      <ToggleSwitch
                        ariaLabel={t("settings.pluginControls.toggleAria", { pluginName: controlLabel })}
                        checked={candidate.plugin.enabled}
                        disabled={isPending}
                        onChange={(checked) => {
                          void handleToggleEnabled(candidate, checked);
                        }}
                      />
                    </div>
                  ) : (
                    <Button
                      color="secondary"
                      size="toolbar"
                      title={t("settings.pluginControls.installTooltip", { pluginName: controlLabel })}
                      disabled={isPending}
                      loading={isPending}
                      onClick={() => {
                        void handleInstall(candidate);
                      }}
                    >
                      {installButtonLabel}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
    </>
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

function buildPluginParams(candidate: PluginCandidate, hostId?: string | null): PluginReadParams {
  return candidate.marketplacePath == null
    ? { hostId, pluginName: candidate.plugin.name, remoteMarketplaceName: candidate.marketplaceName }
    : { hostId, marketplacePath: candidate.marketplacePath, pluginName: candidate.plugin.name };
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
