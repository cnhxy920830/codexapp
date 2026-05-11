import { useEffect, useMemo, useState } from "react";
import {
  BUILTIN_AVATARS,
  DEFAULT_AVATAR_ID,
  resolveAvatarOption,
  type AvatarOption,
} from "../../components/appearance/avatarData";
import { readSelectedAvatarId } from "../../services/settings";
import { AvatarOverlayView } from "./AvatarOverlayView";

type AvatarOverlayPageProps = {
  initialAvatarId?: string | null;
};

export function AvatarOverlayPage({ initialAvatarId }: AvatarOverlayPageProps) {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>(
    initialAvatarId ?? DEFAULT_AVATAR_ID,
  );
  const [isTrayOpen, setIsTrayOpen] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let cancelled = false;
    void (async () => {
      try {
        const stored = await readSelectedAvatarId();
        if (!cancelled && typeof stored === "string" && stored.length > 0) {
          setSelectedAvatarId(stored);
        }
      } catch {
        // ignore; fallback to default
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedAvatar: AvatarOption = useMemo(
    () => resolveAvatarOption(selectedAvatarId, BUILTIN_AVATARS),
    [selectedAvatarId],
  );

  return (
    <AvatarOverlayView
      selectedAvatar={selectedAvatar}
      notificationCount={0}
      isTrayOpen={isTrayOpen}
      onToggleTray={() => setIsTrayOpen((current) => !current)}
      onCollapseTray={() => setIsTrayOpen(false)}
    />
  );
}
