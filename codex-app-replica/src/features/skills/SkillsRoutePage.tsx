import { useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { SearchIcon } from "../../components/AppShellIcons";
import { useI18n } from "../../i18n/i18n";
import type { MessageKey } from "../../i18n/messages";
import { renderInlineLinkMessage } from "../../i18n/renderInlineLinkMessage";
import { selectPluginCandidatesByName, type PluginCandidate } from "../../lib/pluginSelectors";
import {
  installPlugin,
  readPluginsSnapshot,
  type PluginListSnapshot,
  type PluginReadParams,
} from "../../services/plugins";
import { readSkillsSnapshot, type SkillSummary } from "../../services/skills";

const SKILLS_DOCS_URL = "https://developers.openai.com/codex/skills/";

const SCOPE_PRIORITY: Record<string, number> = {
  repo: 0,
  user: 1,
  personal: 1,
  system: 2,
  "built-in": 2,
  builtin: 2,
  admin: 3,
  admininstalled: 3,
};

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
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [pluginsSnapshot, setPluginsSnapshot] = useState<PluginListSnapshot | null>(null);
  const [skillsLoadError, setSkillsLoadError] = useState<string | null>(null);
  const [recommendedLoadError, setRecommendedLoadError] = useState<string | null>(null);
  const [isSkillsLoading, setIsSkillsLoading] = useState(true);
  const [isRecommendedLoading, setIsRecommendedLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasPendingSkillRefresh, setHasPendingSkillRefresh] = useState(false);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const skillsRequestIdRef = useRef(0);
  const pluginsRequestIdRef = useRef(0);

  useEffect(() => {
    setHasPendingSkillRefresh(false);
    void loadSkills({
      forceReload: false,
      onError: setSkillsLoadError,
      onLoaded: setSkills,
      onLoading: setIsSkillsLoading,
      requestIdRef: skillsRequestIdRef,
      workspaceRoot,
    });
    void loadPlugins({
      onError: setRecommendedLoadError,
      onLoaded: setPluginsSnapshot,
      onLoading: setIsRecommendedLoading,
      requestIdRef: pluginsRequestIdRef,
      workspaceRoot,
    });
  }, [workspaceRoot]);

  const installedSkills = useMemo(() => dedupeSkills(skills), [skills]);
  const workspaceRoots = useMemo(() => collectWorkspaceRoots(installedSkills), [installedSkills]);

  const filteredSkills = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (query.length === 0) {
      return installedSkills;
    }
    return installedSkills.filter((skill) => buildInstalledSkillSearchText(skill).includes(query));
  }, [installedSkills, searchQuery]);

  const allRecommendedCandidates = useMemo(() => {
    if (pluginsSnapshot == null) {
      return [];
    }
    return selectPluginCandidatesByName(pluginsSnapshot, pluginsSnapshot.featuredPluginIds)
      .filter(({ plugin }) => !plugin.installed);
  }, [pluginsSnapshot]);

  const recommendedCandidates = useMemo(() => {
    const query = normalizeText(searchQuery);
    if (query.length === 0) {
      return allRecommendedCandidates;
    }
    return allRecommendedCandidates.filter((candidate) => buildRecommendedPluginSearchText(candidate).includes(query));
  }, [allRecommendedCandidates, searchQuery]);

  const canInstallRecommendedSkills = authMethod === "chatgpt";

  const refreshAll = async () => {
    setIsRefreshing(true);
    const [skillsResult] = await Promise.allSettled([
      loadSkills({
        forceReload: true,
        onError: setSkillsLoadError,
        onLoaded: setSkills,
        onLoading: setIsSkillsLoading,
        requestIdRef: skillsRequestIdRef,
        workspaceRoot,
      }),
      loadPlugins({
        onError: setRecommendedLoadError,
        onLoaded: setPluginsSnapshot,
        onLoading: setIsRecommendedLoading,
        requestIdRef: pluginsRequestIdRef,
        workspaceRoot,
      }),
    ]);
    if (skillsResult.status === "fulfilled" && skillsResult.value) {
      setHasPendingSkillRefresh(false);
    }
    setIsRefreshing(false);
  };

  const handleInstallRecommended = async (candidate: PluginCandidate) => {
    if (installingPluginId != null || !canInstallRecommendedSkills) {
      return;
    }

    setInstallingPluginId(candidate.plugin.id);
    setRecommendedLoadError(null);

    try {
      await installPlugin(buildPluginParams(candidate));
      setHasPendingSkillRefresh(true);
      await loadPlugins({
        onError: setRecommendedLoadError,
        onLoaded: setPluginsSnapshot,
        onLoading: setIsRecommendedLoading,
        requestIdRef: pluginsRequestIdRef,
        workspaceRoot,
      });
    } catch (error) {
      setRecommendedLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setInstallingPluginId(null);
    }
  };

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

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[var(--thread-content-max-width)] flex-col gap-8 px-5 py-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="app-title text-[26px] font-normal">{t("skills.page.heading")}</div>
            <div className="app-text-muted mt-1 text-[15px] leading-6">
              {renderInlineLinkMessage(t("skills.page.subheading"), SKILLS_DOCS_URL)}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={isRefreshing || isSkillsLoading || isRecommendedLoading}
              className="app-control flex h-10 items-center justify-center gap-2 rounded-[12px] px-3 text-[13px] disabled:opacity-60"
            >
              <RegenerateIcon className={["h-4 w-4", isRefreshing ? "animate-spin" : ""].join(" ")} />
              <span>{hasPendingSkillRefresh ? t("skills.page.refreshSkillsToUseNew") : t("skills.page.refreshSkills")}</span>
            </button>

            <SearchInput
              ariaLabel={t("skills.page.search.label")}
              onChange={setSearchQuery}
              placeholder={t("skills.page.search")}
              value={searchQuery}
            />
          </div>
        </div>
      </div>

      <PageSection title={t("skills.section.installed")}>
        <InstalledSkillsSection
          getScopeLabel={(skill) => getSkillScopeLabel(skill, workspaceRoots, t)}
          isLoading={isSkillsLoading}
          loadError={skillsLoadError}
          skills={filteredSkills}
          totalSkills={installedSkills.length}
          t={t}
        />
      </PageSection>

      <PageSection title={t("skills.section.recommended")}>
        <RecommendedSkillsSection
          canInstall={canInstallRecommendedSkills}
          candidates={recommendedCandidates}
          errorMessage={recommendedLoadError}
          installingPluginId={installingPluginId}
          isLoading={isRecommendedLoading}
          onInstall={handleInstallRecommended}
          totalCandidates={allRecommendedCandidates.length}
          t={t}
        />
      </PageSection>
    </div>
  );
}

function PageSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="px-2 text-[16px] font-medium text-[var(--app-shell-text)]/75">{title}</div>
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)] p-4">
        {children}
      </div>
    </section>
  );
}

function SearchInput({
  ariaLabel,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="app-control flex h-10 min-w-0 items-center gap-2 rounded-[12px] px-3 sm:min-w-[260px]">
      <SearchIcon className="h-4 w-4 shrink-0 text-[var(--app-shell-subtle)]" />
      <span className="sr-only">{ariaLabel}</span>
      <input
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="app-text-input min-w-0 flex-1 bg-transparent text-[13px] outline-none"
      />
    </label>
  );
}

function InstalledSkillsSection({
  getScopeLabel,
  isLoading,
  loadError,
  skills,
  totalSkills,
  t,
}: {
  getScopeLabel: (skill: SkillSummary) => string;
  isLoading: boolean;
  loadError: string | null;
  skills: SkillSummary[];
  totalSkills: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (loadError) {
    return <CenteredState description={loadError} title={t("skills.page.refreshFailed")} />;
  }

  if (totalSkills === 0) {
    return <CenteredState title={t("skills.page.empty")} />;
  }

  if (skills.length === 0) {
    return (
      <CenteredState
        description={t("skills.page.filteredEmptyDescription")}
        title={t("skills.page.filteredEmpty")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {skills.map((skill) => (
        <article
          key={`${skill.cwd}:${skill.path}`}
          className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[14px] leading-6">{getSkillDisplayName(skill)}</div>
                <ScopeBadge label={getScopeLabel(skill)} />
              </div>
              <div className="app-text-muted mt-1 text-[12px] leading-5">
                {skill.shortDescription ?? skill.description}
              </div>
              <div className="app-text-muted mt-1 truncate text-[11px] leading-5" title={skill.path}>
                {skill.path}
              </div>
            </div>
            <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
              {skill.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function RecommendedSkillsSection({
  canInstall,
  candidates,
  errorMessage,
  installingPluginId,
  isLoading,
  onInstall,
  totalCandidates,
  t,
}: {
  canInstall: boolean;
  candidates: PluginCandidate[];
  errorMessage: string | null;
  installingPluginId: string | null;
  isLoading: boolean;
  onInstall: (candidate: PluginCandidate) => Promise<void>;
  totalCandidates: number;
  t: (key: MessageKey, values?: Record<string, number | string>) => string;
}) {
  if (isLoading) {
    return <CenteredState title={t("skills.page.loading")} />;
  }

  if (errorMessage) {
    return <CenteredState description={errorMessage} title={t("skills.recommended.error")} />;
  }

  if (totalCandidates === 0) {
    return <CenteredState title={t("skills.page.empty")} />;
  }

  if (candidates.length === 0) {
    return (
      <CenteredState
        description={t("skills.page.filteredEmptyDescription")}
        title={t("skills.page.filteredEmpty")}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {candidates.map((candidate) => {
        const pluginName = getPluginDisplayName(candidate);
        const isInstalling = installingPluginId === candidate.plugin.id;

        return (
          <article
            key={candidate.plugin.id}
            className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] leading-6">{pluginName}</div>
                <div className="app-text-muted mt-1 text-[12px] leading-5">
                  {getPluginDescription(candidate)}
                </div>
                <div
                  className="app-text-muted mt-1 truncate text-[11px] leading-5"
                  title={formatMarketplacePath(candidate)}
                >
                  {formatMarketplacePath(candidate)}
                </div>
              </div>
              <button
                type="button"
                disabled={!canInstall || isInstalling}
                onClick={() => void onInstall(candidate)}
                className="app-control shrink-0 rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
              >
                {isInstalling
                  ? t("plugins.installModal.installing", { pluginName })
                  : t("plugins.installModal.install", { pluginName })}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
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

function ScopeBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]">
      {label}
    </span>
  );
}

function RegenerateIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M3.50205 16.6664V13.3333C3.50205 12.9661 3.79982 12.6683 4.16709 12.6683H7.5001L7.63389 12.682C7.93696 12.7439 8.16514 13.0119 8.16514 13.3333C8.16514 13.6547 7.93696 13.9227 7.63389 13.9847L7.5001 13.9984H5.47471C6.58687 15.2249 8.21848 16.0013 10.0001 16.0013C13.06 16.0013 15.586 13.711 15.9552 10.7513L15.9854 10.6195C16.0846 10.3266 16.3786 10.1335 16.6974 10.1732C17.0617 10.2186 17.3198 10.551 17.2745 10.9154L17.2247 11.2523C16.6301 14.7051 13.6225 17.3313 10.0001 17.3314C8.01108 17.3314 6.17193 16.5383 4.83213 15.2474V16.6664C4.83213 17.0335 4.53416 17.3312 4.16709 17.3314C3.79982 17.3314 3.50205 17.0336 3.50205 16.6664ZM4.04502 9.24936C3.99941 9.61354 3.66706 9.87179 3.30283 9.82651C2.93839 9.78106 2.67926 9.44877 2.72471 9.08432L4.04502 9.24936ZM10.0001 2.6683C11.994 2.66834 13.8372 3.46552 15.1778 4.76205V3.33334C15.1778 2.96617 15.4757 2.66846 15.8429 2.6683C16.2101 2.6683 16.5079 2.96607 16.5079 3.33334V6.66635C16.5079 7.03362 16.2101 7.33139 15.8429 7.33139H12.5099C12.1426 7.33139 11.8448 7.03362 11.8448 6.66635C11.845 6.29923 12.1427 6.00131 12.5099 6.00131H14.5255C13.4134 4.77489 11.7816 3.99842 10.0001 3.99838C6.94004 3.99838 4.41411 6.28948 4.04502 9.24936L3.38486 9.16635L2.72471 9.08432C3.1758 5.46703 6.26081 2.6683 10.0001 2.6683Z"
        fill="currentColor"
      />
    </svg>
  );
}

async function loadSkills({
  forceReload,
  onError,
  onLoaded,
  onLoading,
  requestIdRef,
  workspaceRoot,
}: {
  forceReload: boolean;
  onError: (value: string | null) => void;
  onLoaded: (value: SkillSummary[]) => void;
  onLoading: (value: boolean) => void;
  requestIdRef: MutableRefObject<number>;
  workspaceRoot: string | null;
}) {
  const requestId = ++requestIdRef.current;
  onLoading(true);
  onError(null);

  try {
    const nextSkills = await readSkillsSnapshot(workspaceRoot, forceReload);
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded(nextSkills);
    return true;
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded([]);
    onError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    if (requestId === requestIdRef.current) {
      onLoading(false);
    }
  }
}

async function loadPlugins({
  onError,
  onLoaded,
  onLoading,
  requestIdRef,
  workspaceRoot,
}: {
  onError: (value: string | null) => void;
  onLoaded: (value: PluginListSnapshot | null) => void;
  onLoading: (value: boolean) => void;
  requestIdRef: MutableRefObject<number>;
  workspaceRoot: string | null;
}) {
  const requestId = ++requestIdRef.current;
  onLoading(true);
  onError(null);

  try {
    const nextSnapshot = await readPluginsSnapshot(workspaceRoot);
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded(nextSnapshot);
    return true;
  } catch (error) {
    if (requestId !== requestIdRef.current) {
      return false;
    }
    onLoaded(null);
    onError(error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    if (requestId === requestIdRef.current) {
      onLoading(false);
    }
  }
}

function dedupeSkills(skills: SkillSummary[]) {
  const selectedByName = new Map<string, SkillSummary>();

  for (const skill of skills) {
    const existing = selectedByName.get(skill.name);
    if (existing == null) {
      selectedByName.set(skill.name, skill);
      continue;
    }

    const currentRank = getScopePriority(skill.scope);
    const existingRank = getScopePriority(existing.scope);
    if (currentRank < existingRank || (currentRank === existingRank && skill.path.localeCompare(existing.path) < 0)) {
      selectedByName.set(skill.name, skill);
    }
  }

  return Array.from(selectedByName.values()).sort((left, right) =>
    getSkillDisplayName(left).localeCompare(getSkillDisplayName(right)),
  );
}

function collectWorkspaceRoots(skills: SkillSummary[]) {
  return Array.from(new Set(skills.map((skill) => skill.cwd).filter((cwd) => cwd.trim().length > 0)));
}

function getSkillScopeLabel(
  skill: SkillSummary,
  workspaceRoots: string[],
  t: (key: MessageKey, values?: Record<string, number | string>) => string,
) {
  const normalizedScope = normalizeScope(skill.scope);
  if (normalizedScope === "repo") {
    const repoRoot = getBestMatchingRoot(skill.path, workspaceRoots);
    return repoRoot ? getPathBasename(repoRoot) : t("skills.scope.team");
  }
  if (normalizedScope === "user") {
    return t("skills.scope.personal");
  }
  if (normalizedScope === "admin") {
    return t("skills.scope.adminInstalled");
  }
  return t("skills.scope.builtIn");
}

function buildInstalledSkillSearchText(skill: SkillSummary) {
  return normalizeText(
    [skill.name, skill.displayName ?? "", skill.description, skill.shortDescription ?? "", skill.path].join(" "),
  );
}

function buildRecommendedPluginSearchText(candidate: PluginCandidate) {
  return normalizeText(
    [
      candidate.marketplaceName,
      candidate.marketplaceLabel,
      candidate.marketplacePath ?? "",
      candidate.plugin.id,
      candidate.plugin.name,
      candidate.plugin.interface?.displayName ?? "",
      candidate.plugin.interface?.shortDescription ?? "",
      candidate.plugin.interface?.longDescription ?? "",
    ].join(" "),
  );
}

function getSkillDisplayName(skill: SkillSummary) {
  return skill.displayName ?? skill.name;
}

function getPluginDisplayName(candidate: PluginCandidate) {
  return candidate.plugin.interface?.displayName ?? candidate.plugin.name;
}

function getPluginDescription(candidate: PluginCandidate) {
  return (
    candidate.plugin.interface?.longDescription ??
    candidate.plugin.interface?.shortDescription ??
    candidate.plugin.name
  );
}

function formatMarketplacePath(candidate: PluginCandidate) {
  return candidate.marketplacePath
    ? `${candidate.marketplaceLabel} · ${candidate.marketplacePath}`
    : candidate.marketplaceLabel;
}

function buildPluginParams(candidate: PluginCandidate): PluginReadParams {
  return candidate.marketplacePath == null
    ? {
        pluginName: candidate.plugin.name,
        remoteMarketplaceName: candidate.marketplaceName,
      }
    : {
        marketplacePath: candidate.marketplacePath,
        pluginName: candidate.plugin.name,
      };
}

function getScopePriority(scope: string) {
  return SCOPE_PRIORITY[normalizeScope(scope)] ?? Number.MAX_SAFE_INTEGER;
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function getBestMatchingRoot(path: string, roots: string[]) {
  let bestMatch: string | null = null;

  for (const root of roots) {
    if (!path.startsWith(root)) {
      continue;
    }
    if (bestMatch == null || root.length > bestMatch.length) {
      bestMatch = root;
    }
  }

  return bestMatch;
}

function getPathBasename(path: string) {
  const trimmedPath = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmedPath.lastIndexOf("/"), trimmedPath.lastIndexOf("\\"));
  return separatorIndex === -1 ? trimmedPath : trimmedPath.slice(separatorIndex + 1);
}
