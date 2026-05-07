import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/i18n";
import { renderInlineLinkMessage } from "../i18n/renderInlineLinkMessage";
import { readSkillsSnapshot, type SkillSummary } from "../services/skills";

const SKILLS_DOCS_URL = "https://developers.openai.com/codex/skills/";

export function SkillsSettings({ workspaceRoot }: { workspaceRoot: string | null }) {
  const { t } = useI18n();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSkills = async (forceReload: boolean) => {
      if (forceReload) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setLoadError(null);
      try {
        const nextSkills = await readSkillsSnapshot(workspaceRoot, forceReload);
        if (!cancelled) {
          setSkills(nextSkills);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
          setSkills([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    void loadSkills(false);

    return () => {
      cancelled = true;
    };
  }, [workspaceRoot]);

  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return skills;
    }
    return skills.filter((skill) => {
      const displayName = skill.displayName?.toLowerCase() ?? "";
      return [skill.name, displayName, skill.description, skill.shortDescription ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [searchQuery, skills]);

  const refreshSkills = async () => {
    setIsRefreshing(true);
    try {
      const nextSkills = await readSkillsSnapshot(workspaceRoot, true);
      setSkills(nextSkills);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[14px] font-medium">{t("settings.section.skills-settings")}</div>
        <div className="app-text-muted mt-1 text-[13px] leading-6">
          {renderInlineLinkMessage(t("skills.page.subheading"), SKILLS_DOCS_URL)}
        </div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label={t("skills.page.search.label")}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t("skills.page.search")}
            className="app-control app-text-input min-w-0 flex-1 rounded-[12px] px-3 py-2 text-[13px] outline-none"
          />
          <button
            type="button"
            onClick={() => void refreshSkills()}
            disabled={isLoading || isRefreshing}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {isRefreshing ? t("skills.page.loading") : t("skills.page.refreshSkills")}
          </button>
        </div>
      </div>

      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">
          {t("skills.section.installed")}
        </div>

        {isLoading ? (
          <div className="app-text-muted py-6 text-[13px]">{t("skills.page.loading")}</div>
        ) : loadError ? (
          <div className="app-card-muted mt-3 rounded-[12px] px-3 py-2 text-[13px] leading-6">
            <div>{t("skills.page.refreshFailed")}</div>
            <div className="app-text-muted mt-1 text-[12px]">{loadError}</div>
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="app-card-muted mt-3 rounded-[12px] px-3 py-2 text-[13px] leading-6">
            <div>{searchQuery.trim() ? t("skills.page.filteredEmpty") : t("skills.page.empty")}</div>
            {searchQuery.trim() ? (
              <div className="app-text-muted mt-1 text-[12px]">{t("skills.page.filteredEmptyDescription")}</div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {filteredSkills.map((skill) => (
              <div
                key={`${skill.cwd}:${skill.path}`}
                className="rounded-[14px] border border-[var(--app-shell-border)] bg-[var(--app-shell-card)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[14px] leading-6">{skill.displayName ?? skill.name}</div>
                    <div className="app-text-muted mt-1 text-[12px] leading-5">
                      {skill.shortDescription ?? skill.description}
                    </div>
                    <div className="app-text-muted mt-1 truncate text-[11px] leading-5">{skill.path}</div>
                  </div>
                  <div className="shrink-0 text-[12px] text-[var(--app-shell-subtle)]">
                    {skill.enabled ? t("skills.card.enabledStatus") : t("skills.card.disabledStatus")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
