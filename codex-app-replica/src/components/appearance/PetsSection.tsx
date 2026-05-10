import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppToast } from "../AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import { ChevronDownIcon } from "../AppShellIcons";
import { readSelectedAvatarId, setSelectedAvatarId } from "../../services/settings";
import { getCodexHomePath } from "../../services/codexHome";
import {
  ensureCustomAvatarsLoaded,
  getCustomAvatarsSnapshot,
  refreshCustomAvatars,
  subscribeCustomAvatars,
  type CustomAvatarsSnapshot,
} from "../../services/customAvatars";
import { openFile } from "../../services/hostFiles";
import {
  onAvatarOverlayOpenStateChanged,
  readAvatarOverlayOpenState,
  toggleAvatarOverlay,
} from "../../services/avatarOverlay";
import { readSkillsSnapshot } from "../../services/skills";
import { AvatarSprite } from "./AvatarSprite";
import {
  DEFAULT_AVATAR_ID,
  buildAvatarOptions,
  resolveAvatarOption,
  type AvatarOption,
} from "./avatarData";

const HATCH_PET_SKILL_NAME = "hatch-pet";
const HATCH_PET_FALLBACK_SKILL_PATH =
  "https://github.com/openai/skills/blob/main/skills/.curated/hatch-pet/SKILL.md";

export function PetsSection({
  defaultExpanded = false,
  onOpenChatWithPrompt,
  onShowToast,
}: {
  defaultExpanded?: boolean;
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [customAvatarsSnapshot, setCustomAvatarsSnapshot] =
    useState<CustomAvatarsSnapshot>(getCustomAvatarsSnapshot());
  const [isCreatingCustomAvatar, setIsCreatingCustomAvatar] = useState(false);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [selectedAvatarId, setSelectedAvatarIdState] = useState<string>(DEFAULT_AVATAR_ID);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedAvatar = async () => {
      try {
        const value = await readSelectedAvatarId();
        if (!cancelled) {
          setSelectedAvatarIdState(value);
        }
      } catch {
        if (!cancelled) {
          setSelectedAvatarIdState(DEFAULT_AVATAR_ID);
        }
      }
    };

    void loadSelectedAvatar();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeCustomAvatars((nextSnapshot) => {
      setCustomAvatarsSnapshot(nextSnapshot);
    });

    void ensureCustomAvatarsLoaded();

    return unsubscribe;
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unlistenOverlayState: (() => void) | null = null;

    void readAvatarOverlayOpenState()
      .then((value) => {
        if (!cancelled) {
          setIsOverlayOpen(value);
        }
      })
      .catch(() => undefined);

    void onAvatarOverlayOpenStateChanged((notification) => {
      if (!cancelled) {
        setIsOverlayOpen(notification.isOpen);
      }
    }).then((dispose) => {
      if (cancelled) {
        void dispose();
        return;
      }
      unlistenOverlayState = () => {
        void dispose();
      };
    });

    return () => {
      cancelled = true;
      unlistenOverlayState?.();
    };
  }, []);

  const avatarOptions = useMemo(
    () => buildAvatarOptions(customAvatarsSnapshot.avatars),
    [customAvatarsSnapshot.avatars],
  );
  const selectedAvatar = useMemo(
    () => resolveAvatarOption(selectedAvatarId, avatarOptions),
    [avatarOptions, selectedAvatarId],
  );

  const handleSelectAvatar = async (avatar: AvatarOption) => {
    try {
      await setSelectedAvatarId(avatar.id);
      setSelectedAvatarIdState(avatar.id);
    } catch {
      return;
    }
  };

  const handleOpenAvatarDirectory = async () => {
    if (!customAvatarsSnapshot.avatarDirectory) {
      return;
    }

    try {
      await openFile({
        path: customAvatarsSnapshot.avatarDirectory,
        cwd: null,
        target: "fileManager",
        openMode: "workspace",
      });
    } catch {
      onShowToast?.({
        tone: "error",
        message: t("settings.pets.custom.openFolderError"),
      });
    }
  };

  const handleRefreshCustomAvatars = async () => {
    try {
      await refreshCustomAvatars();
    } catch {
      return;
    }
  };

  const handleToggleAvatarOverlay = async () => {
    try {
      await toggleAvatarOverlay();
    } catch {
      return;
    }
  };

  const handleCreateCustomAvatar = async () => {
    if (!onOpenChatWithPrompt) {
      return;
    }

    setIsCreatingCustomAvatar(true);
    try {
      const prompt = await buildCreatePetPrompt();
      onOpenChatWithPrompt(prompt);
    } finally {
      setIsCreatingCustomAvatar(false);
    }
  };

  const builtInAvatars = avatarOptions.filter((avatar) => !isCustomAvatar(avatar));
  const customAvatars = avatarOptions.filter(isCustomAvatar);

  return (
    <section className="flex flex-col">
      <div
        className="border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border"
        style={{
          backgroundColor: "var(--color-background-panel, var(--color-token-bg-fog))",
        }}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((value) => !value)}
          className={[
            "flex w-full items-center justify-between gap-4 p-3 text-left hover:bg-token-list-hover-background",
            isExpanded ? "rounded-t-lg" : "rounded-lg",
          ].join(" ")}
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="min-w-0 text-sm text-token-text-primary">{t("settings.personalization.pets.title")}</span>
            <span className="min-w-0 text-sm text-token-text-secondary">
              {customAvatarsSnapshot.isError
                ? t("settings.pets.loadCustomError")
                : t("settings.personalization.pets.current", { petName: selectedAvatar.displayName })}
            </span>
          </span>
          <ChevronDownIcon
            className={[
              "h-4 w-4 shrink-0 text-token-text-secondary transition-transform",
              isExpanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {isExpanded ? (
          <div className="flex flex-col divide-y divide-token-border bg-token-bg-secondary/20">
            <div className="flex justify-end gap-2 p-3">
              {onOpenChatWithPrompt ? (
                <ToolbarButton disabled={isCreatingCustomAvatar} onClick={() => void handleCreateCustomAvatar()}>
                  {isCreatingCustomAvatar ? (
                    <>
                      <InlineSpinner />
                      <span>{t("settings.pets.custom.create.title")}</span>
                    </>
                  ) : (
                    t("settings.pets.custom.create.title")
                  )}
                </ToolbarButton>
              ) : null}
              <ToolbarButton onClick={() => void handleRefreshCustomAvatars()}>
                {t("settings.pets.refresh")}
              </ToolbarButton>
              <ToolbarButton onClick={() => void handleToggleAvatarOverlay()}>
                {t(
                  isOverlayOpen
                    ? "settings.personalization.pets.tuckAwayPet"
                    : "settings.personalization.pets.openPet",
                )}
              </ToolbarButton>
            </div>

            {customAvatarsSnapshot.isLoading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-token-text-secondary">
                <InlineSpinner />
                <span>{t("settings.pets.loadingCustom")}</span>
              </div>
            ) : null}

            {customAvatarsSnapshot.isError ? (
              <div className="p-3 text-sm text-token-text-secondary">{t("settings.pets.loadCustomError")}</div>
            ) : null}

            {builtInAvatars.map((avatar) => (
              <PetRow
                key={avatar.id}
                avatar={avatar}
                disabled={false}
                isSelected={avatar.id === selectedAvatarId}
                onSelect={() => void handleSelectAvatar(avatar)}
              />
            ))}

            {customAvatarsSnapshot.avatarDirectory ? (
              <CustomPetsDirectoryRow
                avatarDirectory={customAvatarsSnapshot.avatarDirectory}
                onOpenFolder={() => void handleOpenAvatarDirectory()}
              />
            ) : null}

            {customAvatars.map((avatar) => (
              <PetRow
                key={avatar.id}
                avatar={avatar}
                disabled={false}
                isSelected={avatar.id === selectedAvatarId}
                onSelect={() => void handleSelectAvatar(avatar)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CustomPetsDirectoryRow({
  avatarDirectory,
  onOpenFolder,
}: {
  avatarDirectory: string;
  onOpenFolder: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="min-w-0 text-sm text-token-text-primary">{t("settings.pets.custom.title")}</div>
        <div className="font-mono text-xs break-all text-token-text-secondary">{avatarDirectory}</div>
      </div>

      <div className="flex shrink-0 items-center gap-2 max-sm:justify-end">
        <ToolbarButton onClick={onOpenFolder}>
          <span>{t("settings.pets.custom.openFolder")}</span>
          <ArrowTopRightIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
    </div>
  );
}

function PetRow({
  avatar,
  disabled,
  isSelected,
  onSelect,
}: {
  avatar: AvatarOption;
  disabled: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between gap-4 p-3 max-sm:flex-col max-sm:items-stretch">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0">
          <AvatarSprite avatar={avatar} size="sm" />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="min-w-0 text-sm text-token-text-primary">{avatar.displayName}</div>
          <div className="min-w-0 text-sm text-token-text-secondary">{avatar.description}</div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 max-sm:justify-end">
        <button
          type="button"
          disabled={disabled || isSelected}
          onClick={onSelect}
          className={[
            "rounded-[10px] px-3 py-1.5 text-[12px] transition",
            isSelected ? "app-control" : "app-control-weak",
          ].join(" ")}
        >
          {t(isSelected ? "settings.personalization.avatars.selected" : "settings.personalization.avatars.select")}
        </button>
      </div>
    </div>
  );
}

function ToolbarButton({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="app-control-weak inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[12px] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function InlineSpinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent"
    />
  );
}

function ArrowTopRightIcon({ className }: { className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M14.3349 13.3301V6.60645L5.47065 15.4707C5.21095 15.7304 4.78895 15.7304 4.52925 15.4707C4.26955 15.211 4.26955 14.789 4.52925 14.5293L13.3935 5.66504H6.66011C6.29284 5.66504 5.99507 5.36727 5.99507 5C5.99507 4.63273 6.29284 4.33496 6.66011 4.33496H14.9999L15.1337 4.34863C15.4369 4.41057 15.665 4.67857 15.665 5V13.3301C15.6649 13.6973 15.3672 13.9951 14.9999 13.9951C14.6327 13.9951 14.335 13.6973 14.3349 13.3301Z"
        fill="currentColor"
      />
    </svg>
  );
}

function isCustomAvatar(avatar: AvatarOption) {
  return avatar.id.startsWith("custom:");
}

async function buildCreatePetPrompt() {
  const skillPath = await resolveHatchPetSkillPath();
  const normalizedSkillPath = encodeURI(skillPath.replace(/\\/g, "/"));
  const skillMention = `[$${HATCH_PET_SKILL_NAME}](${normalizedSkillPath})`;
  return `${skillMention} create a pet based on what you know about me`;
}

async function resolveHatchPetSkillPath() {
  try {
    const skills = await readSkillsSnapshot(null, false);
    const installedSkill = skills.find((skill) => skill.name === HATCH_PET_SKILL_NAME);
    if (installedSkill) {
      return installedSkill.path;
    }
  } catch {
    // Ignore and fall through to the upstream bundled skill path.
  }

  try {
    const codexHome = await getCodexHomePath();
    return joinPath(
      codexHome,
      "vendor_imports",
      "skills",
      "skills",
      ".curated",
      HATCH_PET_SKILL_NAME,
      "SKILL.md",
    );
  } catch {
    return HATCH_PET_FALLBACK_SKILL_PATH;
  }
}

function joinPath(base: string, ...segments: string[]) {
  const separator = base.includes("\\") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""))].join(
    separator,
  );
}
