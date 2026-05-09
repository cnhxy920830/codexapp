import type { ReactNode } from "react";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useI18n } from "../../../i18n/i18n";
import type { PluginCandidate } from "../../../lib/pluginSelectors";
import { getPluginCandidateDescription, getPluginCandidateDisplayName } from "../../../lib/pluginSelectors";
import type { PluginDetail } from "../../../services/plugins";

export function PluginDetailDialog({
  candidate,
  detail,
  error,
  isLoading,
  onClose,
  onInstall,
  onRetry,
  onToggleInstalledPluginEnabled,
  onTryInChat,
  pendingPluginId,
  pendingTogglePluginId,
}: {
  candidate: PluginCandidate;
  detail: PluginDetail | null;
  error: string | null;
  isLoading: boolean;
  onClose: () => void;
  onInstall: () => void;
  onRetry: () => void;
  onToggleInstalledPluginEnabled: (enabled: boolean) => void;
  onTryInChat: () => void;
  pendingPluginId: string | null;
  pendingTogglePluginId: string | null;
}) {
  const { t } = useI18n();
  const title = detail?.summary.interface?.displayName ?? getPluginCandidateDisplayName(candidate);
  const description =
    detail?.description ??
    detail?.summary.interface?.longDescription ??
    detail?.summary.interface?.shortDescription ??
    getPluginCandidateDescription(candidate);
  const interfaceInfo = detail?.summary.interface ?? candidate.plugin.interface ?? null;
  const capabilities = interfaceInfo?.capabilities ?? [];
  const isInstalling = pendingPluginId === candidate.plugin.id;
  const isToggling = pendingTogglePluginId === candidate.plugin.id;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4 py-6">
      <div
        aria-label={title}
        aria-modal="true"
        role="dialog"
        className="app-card w-full max-w-[820px] rounded-[20px] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[18px] font-medium leading-7">{title}</div>
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
            <div className="flex min-h-[140px] items-center justify-center">
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
          ) : (
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

              {detail != null ? (
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
                          title: skill.interface?.displayName ?? skill.name,
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
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {candidate.plugin.installed ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[var(--app-shell-subtle)]">
                  {candidate.plugin.enabled
                    ? t("plugins.card.enabledStatus")
                    : t("plugins.card.disabledStatus")}
                </span>
                <ToggleSwitch
                  ariaLabel={t("plugins.card.toggleAria")}
                  checked={candidate.plugin.enabled}
                  disabled={isToggling}
                  onChange={onToggleInstalledPluginEnabled}
                />
              </div>
              <button
                type="button"
                disabled={!candidate.plugin.enabled || isInstalling || isToggling}
                onClick={onTryInChat}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("plugins.card.tryInChat")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isInstalling}
              onClick={onInstall}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {isInstalling
                ? t("plugins.installModal.installing", { pluginName: title })
                : t("plugins.installModal.install", { pluginName: title })}
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
            {item.status ? (
              <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">{item.status}</div>
            ) : null}
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
