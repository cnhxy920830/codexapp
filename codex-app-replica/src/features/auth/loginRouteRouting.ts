import type { AuthState } from "../../services/auth";

export type LoginOnboardingRouteTarget = "app" | "login" | "select-workspace" | "welcome";

type ResolveLoginOnboardingRouteTargetParams = {
  activeWorkspaceRootCount: number | null;
  authState: Pick<AuthState, "authMethod" | "requiresAuth">;
  forcedOverride: string | null;
  isActiveWorkspaceRootsLoading: boolean;
  isAuthLoading: boolean;
  postLoginWelcomePending: boolean;
  projectlessOnboardingCompleted: boolean;
};

export function resolveLoginOnboardingRouteTarget({
  activeWorkspaceRootCount,
  authState,
  forcedOverride,
  isActiveWorkspaceRootsLoading,
  isAuthLoading,
  postLoginWelcomePending,
  projectlessOnboardingCompleted,
}: ResolveLoginOnboardingRouteTargetParams): LoginOnboardingRouteTarget | null {
  if (isAuthLoading) {
    return null;
  }

  if (!authState.authMethod && authState.requiresAuth) {
    return "login";
  }

  const normalizedOverride = normalizeLoginOnboardingOverride(forcedOverride);
  if (normalizedOverride !== null) {
    return normalizedOverride;
  }

  if (projectlessOnboardingCompleted) {
    return "app";
  }

  if (isActiveWorkspaceRootsLoading || activeWorkspaceRootCount === null) {
    return null;
  }

  if (postLoginWelcomePending && activeWorkspaceRootCount === 0) {
    return "welcome";
  }

  return activeWorkspaceRootCount === 0 ? "select-workspace" : "app";
}

export function isLoginOnboardingRoute(pathname: string) {
  return pathname === "/login" || pathname === "/welcome" || pathname === "/select-workspace";
}

function normalizeLoginOnboardingOverride(
  value: string | null,
): LoginOnboardingRouteTarget | null {
  if (value == null) {
    return null;
  }

  switch (value.trim().toLowerCase()) {
    case "":
    case "auto":
      return null;
    case "app":
      return "app";
    case "login":
      return "login";
    case "select-workspace":
    case "workspace":
      return "select-workspace";
    case "welcome":
      return "welcome";
    default:
      return null;
  }
}
