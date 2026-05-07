import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n/i18n";
import { readSelectedAvatarId, setSelectedAvatarId } from "../../services/settings";
import { AvatarSprite } from "./AvatarSprite";
import { BUILTIN_AVATARS, DEFAULT_AVATAR_ID, type AvatarOption, type BuiltInAvatarId } from "./avatarData";

export function PetsSection() {
  const { t } = useI18n();
  const [selectedAvatarId, setSelectedAvatarIdState] = useState<BuiltInAvatarId>(DEFAULT_AVATAR_ID);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedAvatar = async () => {
      try {
        const value = await readSelectedAvatarId();
        if (!cancelled) {
          setSelectedAvatarIdState(normalizeAvatarId(value));
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
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
    setError(null);
    try {
      await setSelectedAvatarId(avatar.id);
      setSelectedAvatarIdState(avatar.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="app-card rounded-[18px] px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="app-title text-[14px] font-medium">{t("settings.personalization.pets.title")}</div>
          <div className="app-text-muted mt-1 text-[12px] leading-5">
            {t("settings.personalization.pets.current", { petName: selectedAvatar.displayName })}
          </div>
        </div>
        {error ? <div className="app-card-error rounded-[12px] px-3 py-2 text-[12px]">{error}</div> : null}
      </div>

      <div className="mt-4 space-y-2">
        {BUILTIN_AVATARS.map((avatar) => {
          const isSelected = avatar.id === selectedAvatarId;
          return (
            <div
              key={avatar.id}
              className="flex items-start justify-between gap-3 rounded-[12px] px-3 py-3 transition hover:bg-token-list-hover-background"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <AvatarSprite avatar={avatar} size="sm" />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium text-token-text-primary">{avatar.displayName}</div>
                  <div className="app-text-muted mt-0.5 text-[12px] leading-5">{avatar.description}</div>
                </div>
              </div>
              <button
                type="button"
                disabled={isLoading || isSelected}
                onClick={() => void handleSelectAvatar(avatar)}
                className={[
                  "mt-0.5 rounded-[10px] px-3 py-1.5 text-[12px] transition",
                  isSelected ? "app-control" : "app-control-weak",
                ].join(" ")}
              >
                {t(isSelected ? "settings.personalization.avatars.selected" : "settings.personalization.avatars.select")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function normalizeAvatarId(value: string): BuiltInAvatarId {
  return BUILTIN_AVATARS.some((avatar) => avatar.id === value) ? (value as BuiltInAvatarId) : DEFAULT_AVATAR_ID;
}
