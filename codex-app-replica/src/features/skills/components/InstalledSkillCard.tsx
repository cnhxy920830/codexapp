import { useEffect, useMemo, useRef, useState } from "react";
import type { AppToast } from "../../../components/AppToastRegion";
import { MoreActionsIcon } from "../../../components/AppShellIcons";
import { ToggleSwitch } from "../../../components/ToggleSwitch";
import { useI18n } from "../../../i18n/i18n";
import { openFile, readFileText } from "../../../services/hostFiles";
import { removeSkill } from "../../../services/recommendedSkills";
import { setSkillEnabled, type SkillSummary } from "../../../services/skills";
import { LOCAL_SETTINGS_HOST_ID } from "../../../services/settingsHosts";
import { SkillMarkdownPreview } from "./SkillMarkdownPreview";
import type { SkillsChatRequest } from "../types";

type InstalledSkillCardProps = {
  hostId: string;
  onOpenChatWithPrompt: (request: SkillsChatRequest) => void;
  onShowToast: (toast: AppToast) => void;
  onSkillsUpdated: () => Promise<void>;
  scopeBadges: string[];
  skill: SkillSummary;
};

export function InstalledSkillCard({
  hostId,
  onOpenChatWithPrompt,
  onShowToast,
  onSkillsUpdated,
  scopeBadges,
  skill,
}: InstalledSkillCardProps) {
  const { t } = useI18n();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [previewContents, setPreviewContents] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewHasError, setPreviewHasError] = useState(false);
  const isMountedRef = useRef(true);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = getInstalledSkillDisplayName(skill);
  const description = skill.shortDescription ?? skill.description;
  const isLocalHost = hostId === LOCAL_SETTINGS_HOST_ID;
  const normalizedScope = normalizeSkillScope(skill.scope);
  const canOpenSourceFile = isLocalHost;
  const canUninstall = isLocalHost && normalizedScope !== "admin";
  const tryInChatDisabled = !skill.enabled || isToggling || isRemoving;
  const toggleAriaLabel = skill.enabled ? t("skills.card.disableSkill") : t("skills.card.enableSkill");
  const prefillCwd =
    isLocalHost && normalizedScope === "repo" && skill.cwd.trim().length > 0 ? skill.cwd : null;
  const previewText = useMemo(
    () => stripDuplicatedSkillHeading(stripFrontmatter(previewContents), skill.path, displayName),
    [displayName, previewContents, skill.path],
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isDetailOpen) {
      return;
    }

    let cancelled = false;
    setIsPreviewLoading(true);
    setPreviewHasError(false);

    void readFileText({
      hostId,
      path: skill.path,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        setPreviewContents(response.contents.replace(/\r\n/g, "\n"));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setPreviewHasError(true);
      })
      .finally(() => {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [displayName, hostId, isDetailOpen, skill.path]);

  const handleToggleEnabled = async (enabled: boolean) => {
    if (isToggling || skill.enabled === enabled) {
      return;
    }

    setIsToggling(true);
    try {
      await setSkillEnabled(buildSkillSetEnabledParams(skill, hostId, enabled));
      await onSkillsUpdated();
      onShowToast({
        tone: "success",
        message: t(enabled ? "skills.card.enableSuccess" : "skills.card.disableSuccess", {
          skillName: displayName,
        }),
      });
    } catch {
      onShowToast({
        tone: "error",
        message: t("skills.card.toggleEnabledError"),
      });
    } finally {
      if (isMountedRef.current) {
        setIsToggling(false);
      }
    }
  };

  const handleRemoveSkill = async () => {
    if (!canUninstall || isRemoving) {
      return;
    }

    setIsRemoving(true);
    try {
      await removeSkill({
        hostId,
        skillPath: skill.path,
      });
      setIsDetailOpen(false);
      await onSkillsUpdated();
      onShowToast({
        tone: "success",
        message: t("skills.card.removeSuccess", {
          skillName: displayName,
        }),
      });
    } catch {
      onShowToast({
        tone: "error",
        message: t("skills.card.removeFailed"),
      });
    } finally {
      if (isMountedRef.current) {
        setIsRemoving(false);
      }
    }
  };

  const handleOpenSourceFile = async () => {
    if (!canOpenSourceFile) {
      return;
    }

    try {
      await openFile({
        hostId,
        path: skill.path,
      });
      setIsMenuOpen(false);
    } catch (error) {
      onShowToast({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleTryInChat = () => {
    if (tryInChatDisabled) {
      return;
    }

    const request: SkillsChatRequest = {
      prompt: buildSkillTryInChatPrompt(skill),
    };
    if (prefillCwd != null) {
      request.cwd = prefillCwd;
    }
    onOpenChatWithPrompt(request);
    setIsDetailOpen(false);
  };

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={() => setIsDetailOpen(true)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }
          event.preventDefault();
          setIsDetailOpen(true);
        }}
        className="rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-surface)] px-4 py-3 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-[14px] leading-6">{displayName}</div>
              {scopeBadges.map((badge) => (
                <span
                  key={`${skill.path}:${badge}`}
                  className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]"
                >
                  {badge}
                </span>
              ))}
              {!skill.enabled ? (
                <span className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]">
                  {t("skills.card.disabledBadge")}
                </span>
              ) : null}
            </div>
            <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div>
            <div className="app-text-muted mt-1 truncate text-[11px] leading-5" title={skill.path}>
              {skill.path}
            </div>
          </div>

          <div
            className="flex shrink-0 items-center gap-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <div title={toggleAriaLabel}>
              <ToggleSwitch
                ariaLabel={toggleAriaLabel}
                checked={skill.enabled}
                disabled={isToggling || isRemoving}
                onChange={(enabled) => {
                  void handleToggleEnabled(enabled);
                }}
              />
            </div>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-expanded={isMenuOpen}
                aria-label={t("skills.card.moreActions")}
                onClick={() => setIsMenuOpen((open) => !open)}
                className="app-control-weak flex size-8 items-center justify-center rounded-full"
              >
                <MoreActionsIcon className="h-4 w-4" />
              </button>

              {isMenuOpen ? (
                <div className="app-card absolute top-[calc(100%+8px)] right-0 z-10 w-[190px] rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <button
                    type="button"
                    disabled={!canOpenSourceFile}
                    onClick={() => {
                      void handleOpenSourceFile();
                    }}
                    className="app-nav-item-idle w-full rounded-[10px] px-3 py-2 text-left text-[13px] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("skills.card.open")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsDetailOpen(true);
                    }}
                    className="app-nav-item-idle mt-1 w-full rounded-[10px] px-3 py-2 text-left text-[13px]"
                  >
                    {t("skills.card.details")}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </article>

      {isDetailOpen ? (
        <InstalledSkillDetailDialog
          canUninstall={canUninstall}
          description={description}
          displayName={displayName}
          isOpen={isDetailOpen}
          isPreviewLoading={isPreviewLoading}
          isRemoving={isRemoving}
          isToggling={isToggling}
          onClose={() => setIsDetailOpen(false)}
          onRemove={() => {
            void handleRemoveSkill();
          }}
          onToggleEnabled={(enabled) => {
            void handleToggleEnabled(enabled);
          }}
          onTryInChat={handleTryInChat}
          path={skill.path}
          previewHasError={previewHasError}
          previewText={previewText}
          scopeBadges={scopeBadges}
          skill={skill}
          toggleAriaLabel={toggleAriaLabel}
        />
      ) : null}
    </>
  );
}

function InstalledSkillDetailDialog({
  canUninstall,
  description,
  displayName,
  isOpen,
  isPreviewLoading,
  isRemoving,
  isToggling,
  onClose,
  onRemove,
  onToggleEnabled,
  onTryInChat,
  path,
  previewHasError,
  previewText,
  scopeBadges,
  skill,
  toggleAriaLabel,
}: {
  canUninstall: boolean;
  description: string;
  displayName: string;
  isOpen: boolean;
  isPreviewLoading: boolean;
  isRemoving: boolean;
  isToggling: boolean;
  onClose: () => void;
  onRemove: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onTryInChat: () => void;
  path: string;
  previewHasError: boolean;
  previewText: string;
  scopeBadges: string[];
  skill: SkillSummary;
  toggleAriaLabel: string;
}) {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={displayName}
        onClick={(event) => event.stopPropagation()}
        className="app-card flex max-h-[min(82vh,760px)] w-full max-w-[860px] flex-col overflow-hidden rounded-[20px] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <div className="truncate text-[18px] font-medium leading-7">{displayName}</div>
              {scopeBadges.map((badge) => (
                <span
                  key={`${path}:${badge}:detail`}
                  className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]"
                >
                  {badge}
                </span>
              ))}
              {!skill.enabled ? (
                <span className="rounded-full border border-[var(--app-shell-border)] px-2 py-0.5 text-[11px] text-[var(--app-shell-subtle)]">
                  {t("skills.card.disabledBadge")}
                </span>
              ) : null}
            </div>
            <div className="app-text-muted mt-1 text-[13px] leading-6">{description}</div>
            <div className="app-text-muted mt-1 truncate text-[11px] leading-5" title={path}>
              {path}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div title={toggleAriaLabel}>
              <ToggleSwitch
                ariaLabel={toggleAriaLabel}
                checked={skill.enabled}
                disabled={isToggling || isRemoving}
                onChange={onToggleEnabled}
              />
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
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-[16px] border border-[var(--app-shell-border)] bg-[var(--app-shell-main-surface)]">
          {isPreviewLoading ? (
            <SkillDialogState title={t("skills.card.loadingContents")} />
          ) : previewHasError ? (
            <SkillDialogState title={t("skills.card.contentsError")} />
          ) : (
            <SkillMarkdownPreview text={previewText} />
          )}
        </div>

        <div
          className={[
            "mt-4 flex items-center gap-3",
            canUninstall ? "justify-between" : "justify-end",
          ].join(" ")}
        >
          {canUninstall ? (
            <button
              type="button"
              disabled={isRemoving || isToggling}
              onClick={onRemove}
              className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("skills.card.uninstall")}
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            disabled={!skill.enabled || isRemoving || isToggling}
            onClick={onTryInChat}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("skills.card.try")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SkillDialogState({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center px-6 text-center">
      <div className="app-text-muted text-[13px]">{title}</div>
    </div>
  );
}

function buildSkillSetEnabledParams(skill: SkillSummary, hostId: string, enabled: boolean) {
  if (skill.name.includes(":")) {
    return {
      enabled,
      hostId,
      name: skill.name,
    };
  }

  return {
    enabled,
    hostId,
    path: skill.path,
  };
}

function buildSkillTryInChatPrompt(skill: SkillSummary) {
  const defaultPrompt = normalizeDefaultPrompt(skill.defaultPrompt);
  const mention = buildSkillMention(skill.name, skill.path);

  if (defaultPrompt == null) {
    return ensureTrailingSpace(mention);
  }

  const normalizedDefaultPrompt = defaultPrompt.toLowerCase();
  const linkedMentionPrefix = `[$${skill.name.toLowerCase()}](`;
  if (normalizedDefaultPrompt.includes(linkedMentionPrefix)) {
    return ensureTrailingSpace(defaultPrompt);
  }

  const plainMention = `$${skill.name.toLowerCase()}`;
  if (!skill.path && normalizedDefaultPrompt.includes(plainMention)) {
    return ensureTrailingSpace(defaultPrompt);
  }

  return ensureTrailingSpace(`${defaultPrompt} ${mention}`);
}

function buildSkillMention(skillName: string, path: string | null) {
  if (!path) {
    return `$${skillName}`;
  }

  return `[$${skillName}](${encodeURI(path.replace(/\\/g, "/"))})`;
}

function normalizeDefaultPrompt(defaultPrompt: string | null) {
  if (defaultPrompt == null) {
    return null;
  }

  const trimmed = defaultPrompt.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function ensureTrailingSpace(value: string) {
  return value.endsWith(" ") ? value : `${value} `;
}

function stripFrontmatter(value: string) {
  if (!value.startsWith("---\n")) {
    return value;
  }

  const frontmatterEnd = value.indexOf("\n---", 4);
  if (frontmatterEnd === -1) {
    return value;
  }

  const remainder = value.slice(frontmatterEnd + 4);
  return remainder.startsWith("\n") ? remainder.slice(1) : remainder;
}

function stripDuplicatedSkillHeading(value: string, skillPath: string, expectedTitle: string) {
  const expectedTitles = buildExpectedSkillTitles(skillPath, expectedTitle);
  if (expectedTitles.length === 0) {
    return value;
  }

  const lines = value.split("\n");
  let lineIndex = 0;
  while (lineIndex < lines.length && lines[lineIndex].trim().length === 0) {
    lineIndex += 1;
  }

  if (lineIndex >= lines.length) {
    return value;
  }

  const heading = lines[lineIndex].trim();
  if (!heading.startsWith("# ")) {
    return value;
  }

  if (!expectedTitles.includes(normalizeSkillTitle(heading))) {
    return value;
  }

  lineIndex += 1;
  while (lineIndex < lines.length && lines[lineIndex].trim().length === 0) {
    lineIndex += 1;
  }

  return lines.slice(lineIndex).join("\n");
}

function buildExpectedSkillTitles(skillPath: string, expectedTitle: string) {
  const titles = new Set<string>();
  if (expectedTitle.trim().length > 0) {
    titles.add(normalizeSkillTitle(expectedTitle));
  }

  const derivedTitle = deriveSkillTitleFromPath(skillPath);
  if (derivedTitle) {
    titles.add(normalizeSkillTitle(derivedTitle));
  }

  return Array.from(titles);
}

function deriveSkillTitleFromPath(skillPath: string) {
  if (!skillPath) {
    return null;
  }

  const pathParts = skillPath.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean);
  const fileName = pathParts[pathParts.length - 1];
  if (!fileName) {
    return null;
  }

  if (fileName.toLowerCase() === "skill.md" && pathParts.length > 1) {
    return prettifySkillName(pathParts[pathParts.length - 2]);
  }

  const withoutExtension = fileName.replace(/\.[^/.]+$/, "");
  return withoutExtension.length > 0 ? prettifySkillName(withoutExtension) : null;
}

function prettifySkillName(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSkillTitle(value: string) {
  return value
    .replace(/^#+\s*/, "")
    .replace(/\s*#+\s*$/, "")
    .replace(/[\\`*_~]/g, "")
    .replace(/^\$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function getInstalledSkillDisplayName(skill: SkillSummary) {
  return skill.displayName ?? skill.name;
}

function normalizeSkillScope(scope: string) {
  return scope.trim().toLowerCase().replace(/[\s_-]+/g, "");
}
