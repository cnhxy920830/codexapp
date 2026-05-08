import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import { ChevronDownIcon } from "../AppShellIcons";
import { readSelectedAvatarId, setSelectedAvatarId } from "../../services/settings";
import { AvatarSprite } from "./AvatarSprite";
import { BUILTIN_AVATARS, DEFAULT_AVATAR_ID, type AvatarOption, type BuiltInAvatarId } from "./avatarData";

export function PetsSection({ defaultExpanded = false }: { defaultExpanded?: boolean }) {
  const { t } = useI18n();
  const [selectedAvatarId, setSelectedAvatarIdState] = useState<BuiltInAvatarId>(DEFAULT_AVATAR_ID);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedAvatar = async () => {
      try {
        const value = await readSelectedAvatarId();
        if (!cancelled) {
          setSelectedAvatarIdState(normalizeAvatarId(value));
        }
      } catch {
        if (cancelled) {
          return;
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSelectedAvatar();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAvatar = useMemo(
    () => BUILTIN_AVATARS.find((avatar) => avatar.id === selectedAvatarId) ?? BUILTIN_AVATARS[0],
    [selectedAvatarId],
  );

  const handleSelectAvatar = async (avatar: AvatarOption) => {
    try {
      await setSelectedAvatarId(avatar.id);
      setSelectedAvatarIdState(avatar.id);
    } catch {
      return;
    }
  };

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
              {t("settings.personalization.pets.current", { petName: selectedAvatar.displayName })}
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
            {BUILTIN_AVATARS.map((avatar) => (
              <PetRow
                key={avatar.id}
                avatar={avatar}
                disabled={isLoading}
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

function normalizeAvatarId(value: string): BuiltInAvatarId {
  return BUILTIN_AVATARS.some((avatar) => avatar.id === value) ? (value as BuiltInAvatarId) : DEFAULT_AVATAR_ID;
}
