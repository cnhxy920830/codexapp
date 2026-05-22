import { useEffect, useId, useMemo, useState } from "react";
import type { AppToast } from "../AppToastRegion";
import { useI18n } from "../../i18n/i18n";
import { ChevronDownIcon } from "../AppShellIcons";
import {
  onGlobalStateUpdated,
  readSelectedAvatarId,
  setSelectedAvatarId,
} from "../../services/settings";
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
import { installRecommendedSkill, readRecommendedSkills } from "../../services/recommendedSkills";
import { readSkillsSnapshot } from "../../services/skills";
import { LOCAL_SETTINGS_HOST_ID } from "../../services/settingsHosts";
import { AvatarSprite } from "./AvatarSprite";
import {
  DEFAULT_AVATAR_ID,
  buildAvatarOptions,
  resolveAvatarOption,
  type AvatarOption,
} from "./avatarData";
import { Button } from "../Button";
import { SettingsGroup } from "../SettingsGroup";
import { SettingsRow } from "../SettingsRow";
import { SettingsSurface } from "../SettingsSurface";
import { Spinner } from "../Spinner";

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
  const contentId = useId();

  useEffect(() => {
    let cancelled = false;
    let unlistenGlobalStateUpdated: (() => void) | null = null;

    const syncSelectedAvatarId = async () => {
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

    void syncSelectedAvatarId();

    void onGlobalStateUpdated((notification) => {
      if (!notification.keys.includes("selected-avatar-id")) {
        return;
      }

      void syncSelectedAvatarId();
    }).then((dispose) => {
      if (cancelled) {
        void dispose();
        return;
      }

      unlistenGlobalStateUpdated = () => {
        void dispose();
      };
    });

    return () => {
      cancelled = true;
      unlistenGlobalStateUpdated?.();
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
    <section className="flex flex-col gap-[var(--padding-panel)]">
      <SettingsGroup>
        <SettingsGroup.Content>
          <SettingsSurface>
            <button
              type="button"
              aria-controls={contentId}
              aria-expanded={isExpanded}
              onClick={() => setIsExpanded((value) => !value)}
              className={[
                "flex w-full cursor-interaction items-center justify-between gap-4 p-3 text-left hover:bg-token-list-hover-background",
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
                  "icon-2xs shrink-0 text-token-input-placeholder-foreground transition-transform",
                  isExpanded ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>

            {isExpanded ? (
              <div id={contentId} className="flex flex-col divide-y divide-token-border bg-token-bg-secondary/20">
                <div className="flex justify-end gap-2 p-3">
                  {onOpenChatWithPrompt ? (
                    <Button
                      color="secondary"
                      loading={isCreatingCustomAvatar}
                      onClick={() => void handleCreateCustomAvatar()}
                      size="toolbar"
                    >
                      {t("settings.pets.custom.create.title")}
                    </Button>
                  ) : null}
                  <Button color="secondary" onClick={() => void handleRefreshCustomAvatars()} size="toolbar">
                    {t("settings.pets.refresh")}
                  </Button>
                  <Button color="secondary" onClick={() => void handleToggleAvatarOverlay()} size="toolbar">
                    {t(
                      isOverlayOpen
                        ? "settings.personalization.pets.tuckAwayPet"
                        : "settings.personalization.pets.openPet",
                    )}
                  </Button>
                </div>

                {customAvatarsSnapshot.isLoading ? (
                  <div className="flex items-center gap-2 p-3 text-sm text-token-text-secondary">
                    <Spinner className="icon-xs" />
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
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>
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
    <SettingsRow
      label={t("settings.pets.custom.title")}
      description={<span className="font-mono text-xs break-all">{avatarDirectory}</span>}
      control={
        <Button color="ghost" onClick={onOpenFolder} size="toolbar">
          <span>{t("settings.pets.custom.openFolder")}</span>
          <ArrowTopRightIcon className="icon-2xs" />
        </Button>
      }
    />
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
    <SettingsRow
      icon={<AvatarSprite avatar={avatar} size="sm" />}
      label={avatar.displayName}
      description={avatar.description}
      control={
        <Button
          color="secondary"
          disabled={disabled || isSelected}
          onClick={onSelect}
          size="toolbar"
        >
          {t(isSelected ? "settings.personalization.avatars.selected" : "settings.personalization.avatars.select")}
        </Button>
      }
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
  const skillMention = await resolveHatchPetSkillMention();
  return `${skillMention} create a pet based on what you know about me`;
}

async function resolveHatchPetSkillMention() {
  try {
    const installedSkill = await findInstalledSkillByName(HATCH_PET_SKILL_NAME);
    if (installedSkill) {
      return buildSkillMention(installedSkill.name, installedSkill.path);
    }
  } catch {
    // Ignore and continue to the curated skill install path.
  }

  try {
    const response = await readRecommendedSkills({
      hostId: LOCAL_SETTINGS_HOST_ID,
      refresh: false,
    });
    const curatedSkill = response.skills.find((skill) => skill.name === HATCH_PET_SKILL_NAME);
    if (curatedSkill) {
      const installResult = await installRecommendedSkill({
        hostId: LOCAL_SETTINGS_HOST_ID,
        installRoot: null,
        repoPath: curatedSkill.repoPath,
        skillId: curatedSkill.id,
      });
      const reloadedSkill = await findInstalledSkillByName(HATCH_PET_SKILL_NAME, true);
      if (reloadedSkill) {
        return buildSkillMention(reloadedSkill.name, reloadedSkill.path);
      }
      return buildSkillMention(HATCH_PET_SKILL_NAME, joinPath(installResult.installedPath, "SKILL.md"));
    }
  } catch {
    // Ignore and fall through to the bundled path.
  }

  try {
    const codexHome = await getCodexHomePath();
    return buildSkillMention(
      HATCH_PET_SKILL_NAME,
      joinPath(
        codexHome,
        "vendor_imports",
        "skills",
        "skills",
        ".curated",
        HATCH_PET_SKILL_NAME,
        "SKILL.md",
      ),
    );
  } catch {
    return buildSkillMention(HATCH_PET_SKILL_NAME, HATCH_PET_FALLBACK_SKILL_PATH);
  }
}

async function findInstalledSkillByName(name: string, forceReload = false) {
  const skills = await readSkillsSnapshot(null, {
    forceReload,
    hostId: LOCAL_SETTINGS_HOST_ID,
  });
  const normalizedName = name.toLowerCase();
  const exactMatch = skills.find((skill) => skill.name.toLowerCase() === normalizedName) ?? null;
  if (exactMatch) {
    return exactMatch;
  }

  const suffixMatches = skills.filter((skill) =>
    skill.name.toLowerCase().endsWith(`:${normalizedName}`),
  );
  return suffixMatches.length === 1 ? suffixMatches[0] : null;
}

function buildSkillMention(name: string, path: string) {
  const normalizedSkillPath = encodeURI(path.replace(/\\/g, "/"));
  return `[$${name}](${normalizedSkillPath})`;
}

function joinPath(base: string, ...segments: string[]) {
  const separator = base.includes("\\") ? "\\" : "/";
  return [base.replace(/[\\/]+$/, ""), ...segments.map((segment) => segment.replace(/^[\\/]+|[\\/]+$/g, ""))].join(
    separator,
  );
}
