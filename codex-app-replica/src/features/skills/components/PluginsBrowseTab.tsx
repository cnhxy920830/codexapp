import { useEffect, useState, type ReactNode } from "react";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useI18n } from "../../../i18n/i18n";
import type { MessageKey } from "../../../i18n/messages";
import type { PluginBrowseSection, PluginCandidate, ImportedPluginCandidate } from "../../../lib/pluginSelectors";
import {
  getPluginCandidateDefaultPrompt,
  getPluginCandidateDescription,
  getPluginCandidateDisplayName,
  getPluginHeroSlug,
} from "../../../lib/pluginSelectors";

type PluginCardCandidate = PluginCandidate | ImportedPluginCandidate;

export function PluginsBrowseTab({
  errorMessage,
  heroPlugins,
  importedPlugins,
  isLoading,
  onInstallPlugin,
  onOpenPluginDetails,
  onToggleInstalledPluginEnabled,
  onTryInChat,
  pendingPluginId,
  pendingTogglePluginId,
  sections,
}: {
  errorMessage: string | null;
  heroPlugins: PluginCandidate[];
  importedPlugins: ImportedPluginCandidate[];
  isLoading: boolean;
  onInstallPlugin: (candidate: PluginCandidate) => Promise<void>;
  onOpenPluginDetails: (candidate: PluginCandidate) => void;
  onToggleInstalledPluginEnabled: (candidate: PluginCandidate, enabled: boolean) => Promise<void>;
  onTryInChat: (candidate: PluginCandidate) => Promise<void>;
  pendingPluginId: string | null;
  pendingTogglePluginId: string | null;
  sections: PluginBrowseSection[];
}) {
  const { t } = useI18n();

  if (isLoading) {
    return <CenteredState title={t("skills.appsPage.loading")} />;
  }

  if (errorMessage) {
    return <CenteredState description={errorMessage} title={t("skills.appsPage.loadError.title")} />;
  }

  if (heroPlugins.length === 0 && importedPlugins.length === 0 && sections.length === 0) {
    return <CenteredState title={t("skills.appsPage.empty.plugins")} />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-8 pb-6">
      {heroPlugins.length > 0 ? (
        <HeroCarousel
          heroPlugins={heroPlugins}
          onActivate={onTryInChat}
          onToggleInstalledPluginEnabled={onToggleInstalledPluginEnabled}
          pendingPluginId={pendingPluginId}
          pendingTogglePluginId={pendingTogglePluginId}
        />
      ) : null}

      {importedPlugins.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[16px] font-medium">{t("plugins.importedConnectors.title")}</h2>
          <PluginCardGrid>
            {importedPlugins.map((candidate) => (
              <PluginCard
                key={`imported:${candidate.plugin.id}`}
                candidate={candidate}
                installButtonLabel={t("plugins.importedConnectors.finishSetup")}
                onInstallPlugin={onInstallPlugin}
                onOpenPluginDetails={onOpenPluginDetails}
                onToggleInstalledPluginEnabled={onToggleInstalledPluginEnabled}
                onTryInChat={onTryInChat}
                pendingPluginId={pendingPluginId}
                pendingTogglePluginId={pendingTogglePluginId}
              />
            ))}
          </PluginCardGrid>
        </section>
      ) : null}

      {sections.map((section) => (
        <section key={section.section.id} className="flex flex-col gap-3">
          <h2 className="text-[16px] font-medium">{section.section.title}</h2>
          <PluginCardGrid>
            {section.plugins.map((candidate) => (
              <PluginCard
                key={`${section.section.id}:${candidate.plugin.id}`}
                candidate={candidate}
                installButtonLabel={t("plugins.installModal.install", {
                  pluginName: getPluginCandidateDisplayName(candidate),
                })}
                onInstallPlugin={onInstallPlugin}
                onOpenPluginDetails={onOpenPluginDetails}
                onToggleInstalledPluginEnabled={onToggleInstalledPluginEnabled}
                onTryInChat={onTryInChat}
                pendingPluginId={pendingPluginId}
                pendingTogglePluginId={pendingTogglePluginId}
              />
            ))}
          </PluginCardGrid>
        </section>
      ))}
    </div>
  );
}

function HeroCarousel({
  heroPlugins,
  onActivate,
  onToggleInstalledPluginEnabled,
  pendingPluginId,
  pendingTogglePluginId,
}: {
  heroPlugins: PluginCandidate[];
  onActivate: (candidate: PluginCandidate) => Promise<void>;
  onToggleInstalledPluginEnabled: (candidate: PluginCandidate, enabled: boolean) => Promise<void>;
  pendingPluginId: string | null;
  pendingTogglePluginId: string | null;
}) {
  const { t } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (heroPlugins.length <= 1) {
      return;
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroPlugins.length);
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [heroPlugins.length]);

  useEffect(() => {
    setActiveIndex((current) => {
      if (heroPlugins.length === 0) {
        return 0;
      }
      return current % heroPlugins.length;
    });
  }, [heroPlugins.length]);

  if (heroPlugins.length === 0) {
    return null;
  }

  const activeCandidate = heroPlugins[activeIndex] ?? heroPlugins[0];
  const isInstalling = pendingPluginId === activeCandidate.plugin.id;
  const isToggling = pendingTogglePluginId === activeCandidate.plugin.id;

  return (
    <section className="w-full">
      <div className="relative isolate overflow-hidden rounded-[24px] border border-[var(--app-shell-border)] bg-[linear-gradient(135deg,#efe5d7_0%,#f7f1e8_48%,#dfe9f3_100%)] px-6 py-6 shadow-[0_12px_40px_rgba(15,23,42,0.08)] md:px-10 md:py-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.72),transparent_44%)]" />
        <div className="relative flex min-h-[220px] flex-col justify-between gap-6">
          <div className="max-w-[640px] rounded-[18px] bg-white/70 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.06)] backdrop-blur-sm">
            <div className="text-[20px] font-medium leading-8 text-[var(--app-shell-text)]">
              {getPluginCandidateDisplayName(activeCandidate)}
            </div>
            <div className="mt-3 text-[15px] leading-7 text-[var(--app-shell-text)]/80">
              {getHeroCopy(activeCandidate, t)}
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isInstalling || isToggling}
                onClick={() => void onActivate(activeCandidate)}
                className="app-control rounded-[12px] px-4 py-2 text-[13px] font-medium disabled:opacity-60"
              >
                {t("plugins.hero.tryInChat")}
              </button>

              {activeCandidate.plugin.installed ? (
                <div className="flex items-center gap-2 rounded-[12px] border border-[var(--app-shell-border)] bg-white/70 px-3 py-2">
                  <span className="text-[12px] text-[var(--app-shell-subtle)]">
                    {activeCandidate.plugin.enabled
                      ? t("plugins.card.enabledStatus")
                      : t("plugins.card.disabledStatus")}
                  </span>
                  <ToggleSwitch
                    ariaLabel={t("plugins.card.toggleAria")}
                    checked={activeCandidate.plugin.enabled}
                    disabled={isToggling}
                    onChange={(checked) =>
                      void onToggleInstalledPluginEnabled(activeCandidate, checked)
                    }
                  />
                </div>
              ) : null}
            </div>

            {heroPlugins.length > 1 ? (
              <div className="flex items-center gap-2 self-center md:self-auto">
                {heroPlugins.map((candidate, index) => (
                  <button
                    key={`hero-dot:${candidate.plugin.id}`}
                    type="button"
                    aria-label={t("plugins.hero.dotLabel", { index: index + 1 })}
                    onClick={() => setActiveIndex(index)}
                    className={[
                      "h-[6px] w-[6px] rounded-full transition-colors",
                      index === activeIndex ? "bg-black" : "bg-black/25 hover:bg-black/45",
                    ].join(" ")}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function PluginCard({
  candidate,
  installButtonLabel,
  onInstallPlugin,
  onOpenPluginDetails,
  onToggleInstalledPluginEnabled,
  onTryInChat,
  pendingPluginId,
  pendingTogglePluginId,
}: {
  candidate: PluginCardCandidate;
  installButtonLabel: string;
  onInstallPlugin: (candidate: PluginCandidate) => Promise<void>;
  onOpenPluginDetails: (candidate: PluginCandidate) => void;
  onToggleInstalledPluginEnabled: (candidate: PluginCandidate, enabled: boolean) => Promise<void>;
  onTryInChat: (candidate: PluginCandidate) => Promise<void>;
  pendingPluginId: string | null;
  pendingTogglePluginId: string | null;
}) {
  const { t } = useI18n();
  const isInstalling = pendingPluginId === candidate.plugin.id;
  const isToggling = pendingTogglePluginId === candidate.plugin.id;

  return (
    <article
      onClick={() => onOpenPluginDetails(candidate)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenPluginDetails(candidate);
        }
      }}
      role="button"
      tabIndex={0}
      className="rounded-[18px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] px-4 py-4 text-left transition hover:bg-[var(--app-shell-hover-surface)]"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="min-w-0">
          <div className="text-[15px] font-medium leading-6">{getPluginCandidateDisplayName(candidate)}</div>
          <div className="app-text-muted mt-2 text-[13px] leading-6">
            {getPluginCandidateDescription(candidate)}
          </div>
          <div
            className="app-text-muted mt-3 truncate text-[11px] leading-5"
            title={formatMarketplacePath(candidate)}
          >
            {formatMarketplacePath(candidate)}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
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
                  onChange={(checked) =>
                    void onToggleInstalledPluginEnabled(candidate, checked)
                  }
                />
              </div>

              <button
                type="button"
                disabled={!candidate.plugin.enabled || isInstalling || isToggling}
                onClick={(event) => {
                  event.stopPropagation();
                  void onTryInChat(candidate);
                }}
                className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {t("plugins.card.tryInChat")}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isInstalling}
              onClick={(event) => {
                event.stopPropagation();
                void onInstallPlugin(candidate);
              }}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {isInstalling ? t("plugins.installModal.installing", { pluginName: getPluginCandidateDisplayName(candidate) }) : installButtonLabel}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function PluginCardGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 lg:grid-cols-2">{children}</div>;
}

function CenteredState({
  description,
  title,
}: {
  description?: string | null;
  title: string;
}) {
  return (
    <div className="flex min-h-[180px] items-center justify-center">
      <div className="max-w-md text-center">
        <div className="text-[14px] leading-6">{title}</div>
        {description ? <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div> : null}
      </div>
    </div>
  );
}

function getHeroCopy(
  candidate: PluginCandidate,
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const heroSlug = getPluginHeroSlug(candidate);
  if (heroSlug != null) {
    switch (heroSlug) {
      case "computer-use":
        return t("plugins.hero.copy.computerUse");
      case "gmail":
        return t("plugins.hero.copy.gmail");
      case "slack":
        return t("plugins.hero.copy.slack");
      case "google-calendar":
        return t("plugins.hero.copy.googleCalendar");
      case "google-drive":
        return t("plugins.hero.copy.googleDrive");
      case "linear":
        return t("plugins.hero.copy.linear");
    }
  }

  return getPluginCandidateDefaultPrompt(candidate) ?? getPluginCandidateDescription(candidate);
}

function formatMarketplacePath(candidate: PluginCardCandidate) {
  return candidate.marketplacePath
    ? `${candidate.marketplaceLabel} · ${candidate.marketplacePath}`
    : candidate.marketplaceLabel;
}
