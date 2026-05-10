export type BuiltInAvatarId =
  | "codex"
  | "dewey"
  | "fireball"
  | "rocky"
  | "seedy"
  | "stacky"
  | "bsod"
  | "null-signal";

export type AvatarOption = {
  assetRef: BuiltInAvatarId;
  description: string;
  displayName: string;
  id: string;
  spritesheetUrl: string;
};

export type CustomAvatarRecord = {
  id: string;
  description: string;
  displayName: string;
  spritesheetDataUrl: string;
};

export const DEFAULT_AVATAR_ID: BuiltInAvatarId = "codex";

export const BUILTIN_AVATARS: AvatarOption[] = [
  {
    assetRef: "codex",
    description: "The original Codex companion.",
    displayName: "Codex",
    id: "codex",
    spritesheetUrl: new URL("../../assets/avatars/codex-spritesheet-v4-Bl6P89d_.webp", import.meta.url).href,
  },
  {
    assetRef: "dewey",
    description: "A tidy duck for calm workspace days.",
    displayName: "Dewey",
    id: "dewey",
    spritesheetUrl: new URL("../../assets/avatars/dewey-spritesheet-v4-gAYk_M9g.webp", import.meta.url).href,
  },
  {
    assetRef: "fireball",
    description: "Hot path energy for fast iteration.",
    displayName: "Fireball",
    id: "fireball",
    spritesheetUrl: new URL("../../assets/avatars/fireball-spritesheet-v4-BtU8R9Qp.webp", import.meta.url).href,
  },
  {
    assetRef: "rocky",
    description: "A steady rock when the diff gets large.",
    displayName: "Rocky",
    id: "rocky",
    spritesheetUrl: new URL("../../assets/avatars/rocky-spritesheet-v4-3RlTi26B.webp", import.meta.url).href,
  },
  {
    assetRef: "seedy",
    description: "Small green shoots for new ideas.",
    displayName: "Seedy",
    id: "seedy",
    spritesheetUrl: new URL("../../assets/avatars/seedy-spritesheet-v4-CdlE_fn9.webp", import.meta.url).href,
  },
  {
    assetRef: "stacky",
    description: "A balanced stack for deep work.",
    displayName: "Stacky",
    id: "stacky",
    spritesheetUrl: new URL("../../assets/avatars/stacky-spritesheet-v4-CaUJd4fY.webp", import.meta.url).href,
  },
  {
    assetRef: "bsod",
    description: "A tiny blue-screen gremlin.",
    displayName: "BSOD",
    id: "bsod",
    spritesheetUrl: new URL("../../assets/avatars/bsod-spritesheet-v4-BRrRVy1T.webp", import.meta.url).href,
  },
  {
    assetRef: "null-signal",
    description: "Quiet signal from the void.",
    displayName: "Null Signal",
    id: "null-signal",
    spritesheetUrl: new URL("../../assets/avatars/null-signal-spritesheet-v4-CCoTR-8t.webp", import.meta.url).href,
  },
];

export function buildAvatarOptions(customAvatars: CustomAvatarRecord[] | null | undefined) {
  if (customAvatars == null || customAvatars.length === 0) {
    return BUILTIN_AVATARS;
  }

  return [
    ...BUILTIN_AVATARS,
    ...customAvatars.map((avatar) => ({
      assetRef: "codex" as const,
      description: avatar.description,
      displayName: avatar.displayName,
      id: avatar.id,
      spritesheetUrl: avatar.spritesheetDataUrl,
    })),
  ];
}

export function resolveAvatarOption(id: string, avatarOptions: AvatarOption[] = BUILTIN_AVATARS) {
  return avatarOptions.find((avatar) => avatar.id === id) ?? avatarOptions.find((avatar) => avatar.id === DEFAULT_AVATAR_ID) ?? avatarOptions[0] ?? BUILTIN_AVATARS[0];
}
