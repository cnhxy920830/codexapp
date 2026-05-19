export function isExplicitWelcomeOnboardingOverride(value: string | null | undefined) {
  return normalizeWelcomeOnboardingOverride(value) === "welcome";
}

export function shouldClearActiveWorkspaceRootOnWelcomeCompletion(
  value: string | null | undefined,
) {
  return !isExplicitWelcomeOnboardingOverride(value);
}

function normalizeWelcomeOnboardingOverride(value: string | null | undefined) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
