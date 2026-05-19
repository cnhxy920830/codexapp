export function buildCreatorPrefillPrompt({
  creatorPath,
  isFirstOpen,
  kind,
}: {
  creatorPath: string;
  isFirstOpen: boolean;
  kind: "plugin" | "skill";
}) {
  const promptContent =
    kind === "plugin"
      ? { firstUsePrompt: "help me create a plugin", skillName: "plugin-creator" }
      : { firstUsePrompt: "help me create a skill", skillName: "skill-creator" };
  const normalizedCreatorPath = encodeURI(creatorPath.replace(/\\/g, "/"));
  const mention = `[$${promptContent.skillName}](${normalizedCreatorPath})`;
  return isFirstOpen ? `${mention} ${promptContent.firstUsePrompt}` : `${mention} `;
}

export function readStoredBoolean(storageKey: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(storageKey) === "true";
  } catch {
    return false;
  }
}

export function writeStoredBoolean(storageKey: string, value: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, value ? "true" : "false");
  } catch {
    // Ignore persistence failures; the prompt still works for the current session.
  }
}
