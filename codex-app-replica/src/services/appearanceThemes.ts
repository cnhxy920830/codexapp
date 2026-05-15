export type AppearanceVariant = "light" | "dark";
export type AppearanceCodeThemeId = string;

export type AppearanceThemeFonts = {
  code: string | null;
  ui: string | null;
};

export type AppearanceSemanticColors = {
  diffAdded: string;
  diffRemoved: string;
  skill: string;
};

export type AppearanceChromeTheme = {
  accent: string;
  contrast: number;
  fonts: AppearanceThemeFonts;
  ink: string;
  opaqueWindows: boolean;
  semanticColors: AppearanceSemanticColors;
  surface: string;
};

export type AppearanceChromeThemePatch = Partial<
  Omit<AppearanceChromeTheme, "fonts" | "semanticColors"> & {
    fonts: Partial<AppearanceThemeFonts>;
    semanticColors: Partial<AppearanceSemanticColors>;
  }
>;

export type AppearanceThemeSharePayload = {
  codeThemeId: AppearanceCodeThemeId;
  theme: AppearanceChromeTheme;
  variant: AppearanceVariant;
};

export type CodeThemeOption = {
  id: AppearanceCodeThemeId;
  label: string;
  registrations: Partial<Record<AppearanceVariant, CodeThemeRegistration>>;
};

export const DEFAULT_UI_FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const DEFAULT_CODE_FONT_STACK =
  'ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

type CodeThemeRegistration = {
  moduleFile: string;
  name: string;
};

type ThemeModule = {
  chromeTheme?: AppearanceChromeThemePatch;
  colors?: Record<string, string>;
  settings?: Array<{ settings?: { foreground?: string } }>;
  tokenColors?: Array<{ settings?: { foreground?: string } }>;
};

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

type ComputedAppearanceTheme = {
  accent: RgbColor;
  contrast: number;
  editorBackground: RgbColor;
  ink: RgbColor;
  surface: RgbColor;
  surfaceUnder: string;
  theme: AppearanceChromeTheme;
  variant: AppearanceVariant;
};

export const DEFAULT_APPEARANCE_CODE_THEME_ID: AppearanceCodeThemeId = "codex";

export const DEFAULT_CHROME_THEME_BY_VARIANT: Record<AppearanceVariant, AppearanceChromeTheme> = {
  dark: {
    accent: "#339cff",
    contrast: 60,
    fonts: { code: null, ui: null },
    ink: "#ffffff",
    opaqueWindows: false,
    semanticColors: {
      diffAdded: "#40c977",
      diffRemoved: "#fa423e",
      skill: "#ad7bf9",
    },
    surface: "#181818",
  },
  light: {
    accent: "#339cff",
    contrast: 45,
    fonts: { code: null, ui: null },
    ink: "#1a1c1f",
    opaqueWindows: false,
    semanticColors: {
      diffAdded: "#00a240",
      diffRemoved: "#ba2623",
      skill: "#924ff7",
    },
    surface: "#ffffff",
  },
};

const THEME_SHARE_PREFIX = "codex-theme-v1:";
const BLACK_RGB: RgbColor = { blue: 0, green: 0, red: 0 };
const WHITE_RGB: RgbColor = { blue: 255, green: 255, red: 255 };
const BASE_CONTRAST_BY_VARIANT: Record<AppearanceVariant, number> = {
  dark: DEFAULT_CHROME_THEME_BY_VARIANT.dark.contrast,
  light: DEFAULT_CHROME_THEME_BY_VARIANT.light.contrast,
};
const CONTRAST_CURVE_BASE = 0.7;
const CONTRAST_CURVE_EXPONENT = 2;
const SURFACE_UNDER_BASE_BY_VARIANT: Record<AppearanceVariant, number> = { dark: 0.16, light: 0.04 };
const SURFACE_UNDER_SCALE_BY_VARIANT: Record<AppearanceVariant, number> = { dark: 0.0015, light: 0.0012 };
const PANEL_BASE_BY_VARIANT: Record<AppearanceVariant, number> = { dark: 0.03, light: 0.18 };
const PANEL_SCALE_BY_VARIANT: Record<AppearanceVariant, number> = { dark: 0.03, light: 0.008 };
const ACCENT_COLOR_KEYS = [
  "activityBarBadge.background",
  "textLink.foreground",
  "editorCursor.foreground",
  "focusBorder",
  "button.background",
  "activityBar.activeBorder",
] as const;
const SURFACE_COLOR_KEYS = [
  "editor.background",
  "sideBar.background",
  "editorGroupHeader.tabsBackground",
  "panel.background",
  "activityBar.background",
] as const;
const INK_COLOR_KEYS = [
  "editor.foreground",
  "sideBarTitle.foreground",
  "sideBar.foreground",
  "foreground",
] as const;
const DIFF_ADDED_COLOR_KEYS = [
  "gitDecoration.addedResourceForeground",
  "gitDecoration.untrackedResourceForeground",
  "terminal.ansiGreen",
  "terminal.ansiBrightGreen",
] as const;
const DIFF_REMOVED_COLOR_KEYS = [
  "gitDecoration.deletedResourceForeground",
  "terminal.ansiRed",
  "terminal.ansiBrightRed",
] as const;
const SKILL_COLOR_KEYS = ["charts.purple", "terminal.ansiMagenta", "terminal.ansiBrightMagenta"] as const;
const MINIMUM_SEED_ALPHA = 0.45;
const MINIMUM_CHROMATIC_RANGE = 24;
const DIFF_ADDED_HUE_RANGE = { max: 170, min: 80 };
const DIFF_ADDED_FALLBACK_HUE = 125;
const DIFF_REMOVED_HUE_RANGE = { max: 15, min: 345 };
const DIFF_REMOVED_FALLBACK_HUE = 0;
const SKILL_HUE_RANGE = { max: 320, min: 210 };
const SKILL_FALLBACK_HUE = 265;
const CODE_THEME_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base" });

const themeModuleLoaders =
  typeof import.meta.glob === "function"
    ? import.meta.glob("../assets/upstream-code-themes/*.js")
    : {};

const CODE_THEME_OPTIONS: CodeThemeOption[] = [
  defineCodeTheme("ayu", "Ayu", { dark: registration("ayu-dark-drYq2dpB.js", "ayu-dark") }),
  defineCodeTheme("catppuccin", "Catppuccin", {
    dark: registration("catppuccin-mocha-MgJXGdBq.js", "catppuccin-mocha"),
    light: registration("catppuccin-latte-CvZ2Cw0z.js", "catppuccin-latte"),
  }),
  defineCodeTheme("absolutely", "Absolutely", {
    dark: registration("absolutely-dark-Cur1Poz1.js", "Absolutely Dark"),
    light: registration("absolutely-light-CkX71n25.js", "Absolutely Light"),
  }),
  defineCodeTheme("codex", "Codex", {
    dark: registration("codex-dark-CVCUxGMi.js", "Codex Dark"),
    light: registration("codex-light-aEGERiE0.js", "Codex Light"),
  }),
  defineCodeTheme("dracula", "Dracula", { dark: registration("dracula-DgicUThM.js", "dracula") }),
  defineCodeTheme("everforest", "Everforest", {
    dark: registration("everforest-dark-hAJMEK5o.js", "everforest-dark"),
    light: registration("everforest-light-xFeNHBfu.js", "everforest-light"),
  }),
  defineCodeTheme("github", "GitHub", {
    dark: registration("github-dark-default-CgYi4IZZ.js", "github-dark-default"),
    light: registration("github-light-default-Dug_Xjjw.js", "github-light-default"),
  }),
  defineCodeTheme("gruvbox", "Gruvbox", {
    dark: registration("gruvbox-dark-medium-BCoBcnwD.js", "gruvbox-dark-medium"),
    light: registration("gruvbox-light-medium-vOFJBKvy.js", "gruvbox-light-medium"),
  }),
  defineCodeTheme("linear", "Linear", {
    dark: registration("linear-dark-BQlfQBXn.js", "Linear Dark"),
    light: registration("linear-light-D-4qUW1e.js", "Linear Light"),
  }),
  defineCodeTheme("lobster", "Lobster", {
    dark: registration("lobster-dark-u47wPpwX.js", "Lobster Dark"),
  }),
  defineCodeTheme("material", "Material", {
    dark: registration("material-theme-darker-D0eYbRr7.js", "material-theme-darker"),
  }),
  defineCodeTheme("matrix", "Matrix", {
    dark: registration("matrix-dark-NxNY7VVP.js", "Matrix Dark"),
  }),
  defineCodeTheme("monokai", "Monokai", { dark: registration("monokai-C5MmHQEX.js", "monokai") }),
  defineCodeTheme("night-owl", "Night Owl", {
    dark: registration("night-owl-DG0Vzq83.js", "night-owl"),
  }),
  defineCodeTheme("nord", "Nord", { dark: registration("nord-CbLn2U4T.js", "nord") }),
  defineCodeTheme("notion", "Notion", {
    dark: registration("notion-dark-mHUWJrS2.js", "Notion Dark"),
    light: registration("notion-light-Bw6-TC-C.js", "Notion Light"),
  }),
  defineCodeTheme("oscurange", "Oscurange", {
    dark: registration("oscurange-CHhlMlGY.js", "Oscurange"),
  }),
  defineCodeTheme("one", "One", {
    dark: registration("one-dark-pro-C5nrzNEh.js", "one-dark-pro"),
    light: registration("one-light-DB6Ej749.js", "one-light"),
  }),
  defineCodeTheme("proof", "Proof", {
    light: registration("proof-light-BABRbO62.js", "Proof Light"),
  }),
  defineCodeTheme("raycast", "Raycast", {
    dark: registration("raycast-dark-DhzZs8sJ.js", "Raycast Dark"),
    light: registration("raycast-light-CcVxIyne.js", "Raycast Light"),
  }),
  defineCodeTheme("rose-pine", "Rose Pine", {
    dark: registration("rose-pine-moon-D66xAo56.js", "rose-pine-moon"),
    light: registration("rose-pine-dawn-DhuNe-Ny.js", "rose-pine-dawn"),
  }),
  defineCodeTheme("sentry", "Sentry", {
    dark: registration("sentry-dark-C6Yp5RKp.js", "Sentry Dark"),
  }),
  defineCodeTheme("solarized", "Solarized", {
    dark: registration("solarized-dark--hIa2bZf.js", "solarized-dark"),
    light: registration("solarized-light-MRBJirLV.js", "solarized-light"),
  }),
  defineCodeTheme("tokyo-night", "Tokyo Night", {
    dark: registration("tokyo-night-m-gSW_k0.js", "tokyo-night"),
  }),
  defineCodeTheme("temple", "Temple", {
    dark: registration("temple-dark-DCuRQ738.js", "Temple Dark"),
  }),
  defineCodeTheme("vercel", "Vercel", {
    dark: registration("vercel-dark-DTEbLU_R.js", "Vercel Dark"),
    light: registration("vercel-light-D27BxvrX.js", "Vercel Light"),
  }),
  defineCodeTheme("vscode-plus", "VS Code Plus", {
    dark: registration("dark-plus-B43ffgpX.js", "dark-plus"),
    light: registration("light-plus-BDRfEjjy.js", "light-plus"),
  }),
  defineCodeTheme("xcode", "Xcode", {
    dark: registration("xcode-dark-DbO7_XDO.js", "Xcode Dark"),
    light: registration("xcode-light-0KGXyaHG.js", "Xcode Light"),
  }),
];

export function cloneAppearanceChromeTheme(theme: AppearanceChromeTheme): AppearanceChromeTheme {
  return {
    accent: theme.accent,
    contrast: theme.contrast,
    fonts: { ...theme.fonts },
    ink: theme.ink,
    opaqueWindows: theme.opaqueWindows,
    semanticColors: { ...theme.semanticColors },
    surface: theme.surface,
  };
}

export function normalizeAppearanceChromeTheme(value: unknown, variant: AppearanceVariant): AppearanceChromeTheme {
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant];
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return cloneAppearanceChromeTheme(fallback);
  }

  const candidate = value as {
    accent?: unknown;
    contrast?: unknown;
    fonts?: { code?: unknown; ui?: unknown } | unknown;
    ink?: unknown;
    opaqueWindows?: unknown;
    semanticColors?: { diffAdded?: unknown; diffRemoved?: unknown; skill?: unknown } | unknown;
    surface?: unknown;
  };
  const fonts = normalizeThemeFonts(candidate.fonts);
  const semanticColors = normalizeSemanticColors(candidate.semanticColors, fallback.semanticColors);

  return {
    accent: normalizeThemeColor(candidate.accent) ?? fallback.accent,
    contrast: normalizeThemeContrast(candidate.contrast, fallback.contrast),
    fonts,
    ink: normalizeThemeColor(candidate.ink) ?? fallback.ink,
    opaqueWindows: typeof candidate.opaqueWindows === "boolean" ? candidate.opaqueWindows : fallback.opaqueWindows,
    semanticColors,
    surface: normalizeThemeColor(candidate.surface) ?? fallback.surface,
  };
}

export function mergeAppearanceChromeTheme(
  theme: AppearanceChromeTheme,
  patch: AppearanceChromeThemePatch,
): AppearanceChromeTheme {
  const normalizedFontPatch = normalizeThemeFontsPatch(patch.fonts);
  const normalizedSemanticPatch = normalizeSemanticColorsPatch(patch.semanticColors);
  return {
    ...theme,
    ...patch,
    accent: normalizeThemeColor(patch.accent) ?? theme.accent,
    contrast: normalizeThemeContrast(patch.contrast, theme.contrast),
    fonts: normalizedFontPatch ? { ...theme.fonts, ...normalizedFontPatch } : { ...theme.fonts },
    ink: normalizeThemeColor(patch.ink) ?? theme.ink,
    opaqueWindows: typeof patch.opaqueWindows === "boolean" ? patch.opaqueWindows : theme.opaqueWindows,
    semanticColors: normalizedSemanticPatch
      ? { ...theme.semanticColors, ...normalizedSemanticPatch }
      : { ...theme.semanticColors },
    surface: normalizeThemeColor(patch.surface) ?? theme.surface,
  };
}

export function getCodeThemeOptions(variant: AppearanceVariant) {
  return CODE_THEME_OPTIONS.filter((option) => option.registrations[variant]).sort((left, right) =>
    CODE_THEME_COLLATOR.compare(left.label, right.label),
  );
}

export function resolveCodeThemeOption(id: string | null | undefined, variant: AppearanceVariant) {
  const options = getCodeThemeOptions(variant);
  const selected = options.find((option) => option.id === id);
  return selected ?? options.find((option) => option.id === DEFAULT_APPEARANCE_CODE_THEME_ID) ?? options[0];
}

export function normalizeAppearanceCodeThemeId(value: unknown, variant: AppearanceVariant) {
  return resolveCodeThemeOption(typeof value === "string" ? value : null, variant)?.id ?? DEFAULT_APPEARANCE_CODE_THEME_ID;
}

export async function loadCodeThemeSeed(id: AppearanceCodeThemeId, variant: AppearanceVariant) {
  const registration = resolveCodeThemeRegistration(id, variant);
  const themeModule = await loadThemeModule(registration.moduleFile);
  return mergeCodeThemeSeedPatch(deriveChromeThemeSeed(themeModule, variant), themeModule.chromeTheme ?? {});
}

export async function loadCodeThemePreview(id: AppearanceCodeThemeId, variant: AppearanceVariant) {
  const seed = await loadCodeThemeSeed(id, variant);
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant];
  return {
    accent: normalizeThemeColor(seed.accent) ?? fallback.accent,
    ink: normalizeThemeColor(seed.ink) ?? fallback.ink,
    surface: normalizeThemeColor(seed.surface) ?? fallback.surface,
  };
}

export function encodeAppearanceThemeShare(payload: AppearanceThemeSharePayload) {
  return `${THEME_SHARE_PREFIX}${JSON.stringify(payload)}`;
}

export function decodeAppearanceThemeShare(value: string, expectedVariant: AppearanceVariant) {
  const trimmed = value.trim();
  if (!trimmed.startsWith(THEME_SHARE_PREFIX)) {
    throw new Error("Theme share string mismatch");
  }

  const encodedPayload = trimmed.slice(THEME_SHARE_PREFIX.length);
  const payloadText = encodedPayload.startsWith("{") ? encodedPayload : decodeURIComponent(encodedPayload);
  const rawPayload = JSON.parse(payloadText) as {
    codeThemeId?: unknown;
    theme?: unknown;
    variant?: unknown;
  };

  if (rawPayload.variant !== expectedVariant) {
    throw new Error("Theme variant mismatch");
  }

  const option = findCodeThemeOption(typeof rawPayload.codeThemeId === "string" ? rawPayload.codeThemeId : null, expectedVariant);
  if (!option) {
    throw new Error("Theme code theme mismatch");
  }

  return {
    codeThemeId: option.id,
    theme: normalizeAppearanceChromeTheme(rawPayload.theme, expectedVariant),
  };
}

export function canDecodeAppearanceThemeShare(value: string, expectedVariant: AppearanceVariant) {
  try {
    decodeAppearanceThemeShare(value, expectedVariant);
    return true;
  } catch {
    return false;
  }
}

export function applyAppearanceCssVariables(
  root: HTMLElement,
  variant: AppearanceVariant,
  theme: AppearanceChromeTheme,
) {
  root.classList.toggle("electron-dark", variant === "dark");
  root.classList.toggle("electron-light", variant === "light");

  const computedTheme = buildComputedAppearanceTheme(theme, variant);
  const palette = variant === "light" ? buildLightAppearancePalette(computedTheme) : buildDarkAppearancePalette(computedTheme);

  for (const [property, propertyValue] of Object.entries(buildAppearanceCssVariables(computedTheme, palette))) {
    root.style.setProperty(property, propertyValue);
  }

  setOptionalStyleProperty(root, "--app-shell-ui-font-family", theme.fonts.ui);
  setOptionalStyleProperty(root, "--vscode-font-family", theme.fonts.ui);
  setOptionalStyleProperty(root, "--app-shell-code-font-family", theme.fonts.code);
  setOptionalStyleProperty(root, "--vscode-editor-font-family", theme.fonts.code);
}

function defineCodeTheme(
  id: AppearanceCodeThemeId,
  label: string,
  registrations: Partial<Record<AppearanceVariant, CodeThemeRegistration>>,
): CodeThemeOption {
  return { id, label, registrations };
}

function registration(moduleFile: string, name: string): CodeThemeRegistration {
  return { moduleFile, name };
}

function normalizeThemeFonts(value: unknown): AppearanceThemeFonts {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { code: null, ui: null };
  }

  const fonts = value as { code?: unknown; ui?: unknown };
  return {
    code: normalizeFontFamily(fonts.code),
    ui: normalizeFontFamily(fonts.ui),
  };
}

function normalizeThemeFontsPatch(value: unknown): Partial<AppearanceThemeFonts> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const fonts = value as { code?: unknown; ui?: unknown };
  const patch: Partial<AppearanceThemeFonts> = {};
  const code = normalizeFontFamily(fonts.code);
  const ui = normalizeFontFamily(fonts.ui);

  if ("code" in fonts) {
    patch.code = code;
  }
  if ("ui" in fonts) {
    patch.ui = ui;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function normalizeFontFamily(value: unknown) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function normalizeSemanticColors(
  value: unknown,
  fallback: AppearanceSemanticColors,
): AppearanceSemanticColors {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return { ...fallback };
  }

  const semanticColors = value as { diffAdded?: unknown; diffRemoved?: unknown; skill?: unknown };
  return {
    diffAdded: normalizeThemeColor(semanticColors.diffAdded) ?? fallback.diffAdded,
    diffRemoved: normalizeThemeColor(semanticColors.diffRemoved) ?? fallback.diffRemoved,
    skill: normalizeThemeColor(semanticColors.skill) ?? fallback.skill,
  };
}

function normalizeSemanticColorsPatch(value: unknown): Partial<AppearanceSemanticColors> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }

  const semanticColors = value as { diffAdded?: unknown; diffRemoved?: unknown; skill?: unknown };
  const patch: Partial<AppearanceSemanticColors> = {};

  if ("diffAdded" in semanticColors) {
    const diffAdded = normalizeThemeColor(semanticColors.diffAdded);
    if (diffAdded) {
      patch.diffAdded = diffAdded;
    }
  }
  if ("diffRemoved" in semanticColors) {
    const diffRemoved = normalizeThemeColor(semanticColors.diffRemoved);
    if (diffRemoved) {
      patch.diffRemoved = diffRemoved;
    }
  }
  if ("skill" in semanticColors) {
    const skill = normalizeThemeColor(semanticColors.skill);
    if (skill) {
      patch.skill = skill;
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function normalizeThemeColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toLowerCase() : null;
}

function normalizeThemeContrast(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : fallback;
}

function resolveCodeThemeRegistration(id: AppearanceCodeThemeId, variant: AppearanceVariant) {
  const option = resolveCodeThemeOption(id, variant);
  const registration = option?.registrations[variant];
  if (!registration) {
    throw new Error(`Missing ${variant} code theme registration`);
  }
  return registration;
}

function findCodeThemeOption(id: string | null | undefined, variant: AppearanceVariant) {
  if (!id) {
    return null;
  }

  return getCodeThemeOptions(variant).find((option) => option.id === id) ?? null;
}

async function loadThemeModule(moduleFile: string) {
  const loaderKey = `../assets/upstream-code-themes/${moduleFile}`;
  const loader = themeModuleLoaders[loaderKey];
  if (!loader) {
    throw new Error(`Missing upstream theme module: ${moduleFile}`);
  }

  const loaded = await loader();
  return (loaded as { default?: ThemeModule }).default ?? (loaded as ThemeModule);
}

function deriveChromeThemeSeed(themeModule: ThemeModule, variant: AppearanceVariant): AppearanceChromeThemePatch {
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant];
  const surface = findFirstThemeColor(themeModule.colors, SURFACE_COLOR_KEYS) ?? fallback.surface;
  const ink = findFirstThemeColor(themeModule.colors, INK_COLOR_KEYS) ?? fallback.ink;
  const accent = findAccentThemeColor(themeModule, surface, ink) ?? fallback.accent;

  return {
    accent,
    ink,
    semanticColors: deriveSemanticThemeColors(themeModule, surface, ink, accent, variant),
    surface,
  };
}

function mergeCodeThemeSeedPatch(
  seed: AppearanceChromeThemePatch,
  patch: AppearanceChromeThemePatch,
): AppearanceChromeThemePatch {
  const merged: AppearanceChromeThemePatch = {
    accent: normalizeThemeColor(seed.accent) ?? undefined,
    contrast: typeof seed.contrast === "number" ? seed.contrast : undefined,
    fonts: seed.fonts ? { ...seed.fonts } : undefined,
    ink: normalizeThemeColor(seed.ink) ?? undefined,
    opaqueWindows: typeof seed.opaqueWindows === "boolean" ? seed.opaqueWindows : undefined,
    semanticColors: seed.semanticColors ? { ...seed.semanticColors } : undefined,
    surface: normalizeThemeColor(seed.surface) ?? undefined,
  };

  if (patch.accent !== undefined) {
    merged.accent = normalizeThemeColor(patch.accent) ?? merged.accent;
  }
  if (patch.contrast !== undefined) {
    merged.contrast = normalizeThemeContrast(patch.contrast, merged.contrast ?? 0);
  }
  if (patch.fonts !== undefined) {
    const normalizedFonts = normalizeThemeFontsPatch(patch.fonts);
    if (normalizedFonts) {
      merged.fonts = { ...(merged.fonts ?? {}), ...normalizedFonts };
    }
  }
  if (patch.ink !== undefined) {
    merged.ink = normalizeThemeColor(patch.ink) ?? merged.ink;
  }
  if (patch.opaqueWindows !== undefined) {
    merged.opaqueWindows = typeof patch.opaqueWindows === "boolean" ? patch.opaqueWindows : merged.opaqueWindows;
  }
  if (patch.semanticColors !== undefined) {
    const normalizedSemanticColors = normalizeSemanticColorsPatch(patch.semanticColors);
    if (normalizedSemanticColors) {
      merged.semanticColors = { ...(merged.semanticColors ?? {}), ...normalizedSemanticColors };
    }
  }
  if (patch.surface !== undefined) {
    merged.surface = normalizeThemeColor(patch.surface) ?? merged.surface;
  }

  return merged;
}

function findFirstThemeColor(
  colors: Record<string, string> | undefined,
  keys: readonly string[],
) {
  if (!colors) {
    return undefined;
  }

  for (const key of keys) {
    const color = parseThemeSeedColor(colors[key]);
    if (color) {
      return color;
    }
  }

  return undefined;
}

function findAccentThemeColor(themeModule: ThemeModule, surface: string, ink: string) {
  for (const key of ACCENT_COLOR_KEYS) {
    const color = parseThemeSeedColor(themeModule.colors?.[key], {
      minimumAlpha: MINIMUM_SEED_ALPHA,
      minimumChromaticRange: MINIMUM_CHROMATIC_RANGE,
    });
    if (color && !colorsAreTooClose(color, surface) && !colorsAreTooClose(color, ink)) {
      return color;
    }
  }

  let bestColor: string | undefined;
  let bestScore = -1;
  for (const colorSetting of collectThemeTextColors(themeModule)) {
    const color = parseThemeSeedColor(colorSetting.settings?.foreground, {
      minimumAlpha: MINIMUM_SEED_ALPHA,
      minimumChromaticRange: MINIMUM_CHROMATIC_RANGE,
    });
    if (!color || colorsAreTooClose(color, surface) || colorsAreTooClose(color, ink)) {
      continue;
    }

    const score = scoreThemeColor(color, surface, ink);
    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }

  return bestColor;
}

function deriveSemanticThemeColors(
  themeModule: ThemeModule,
  surface: string,
  ink: string,
  accent: string,
  variant: AppearanceVariant,
): AppearanceSemanticColors {
  const fallback = DEFAULT_CHROME_THEME_BY_VARIANT[variant].semanticColors;
  return {
    diffAdded:
      findFirstThemeColor(themeModule.colors, DIFF_ADDED_COLOR_KEYS) ??
      findHueMatchedColor(themeModule, surface, ink, DIFF_ADDED_HUE_RANGE, DIFF_ADDED_FALLBACK_HUE) ??
      fallback.diffAdded,
    diffRemoved:
      findFirstThemeColor(themeModule.colors, DIFF_REMOVED_COLOR_KEYS) ??
      findHueMatchedColor(themeModule, surface, ink, DIFF_REMOVED_HUE_RANGE, DIFF_REMOVED_FALLBACK_HUE) ??
      fallback.diffRemoved,
    skill:
      findFirstThemeColor(themeModule.colors, SKILL_COLOR_KEYS) ??
      findHueMatchedColor(themeModule, surface, ink, SKILL_HUE_RANGE, SKILL_FALLBACK_HUE) ??
      (!colorsAreTooClose(accent, surface) && !colorsAreTooClose(accent, ink) ? accent : fallback.skill),
  };
}

function collectThemeTextColors(themeModule: ThemeModule) {
  return [...(themeModule.tokenColors ?? []), ...(themeModule.settings ?? [])];
}

function findHueMatchedColor(
  themeModule: ThemeModule,
  surface: string,
  ink: string,
  hueRange: { max: number; min: number },
  fallbackHue: number,
) {
  let bestColor: string | undefined;
  let bestScore = -1;

  for (const color of collectUniqueThemeSeedColors(themeModule)) {
    if (colorsAreTooClose(color, surface) || colorsAreTooClose(color, ink)) {
      continue;
    }

    const parsedColor = parseRgbColor(color);
    if (!parsedColor) {
      continue;
    }

    const hue = calculateHue(parsedColor);
    if (hue === null || !hueInRange(hue, hueRange)) {
      continue;
    }

    const score = scoreThemeColor(color, surface, ink) - hueDistance(hue, fallbackHue) * 2;
    if (score > bestScore) {
      bestColor = color;
      bestScore = score;
    }
  }

  return bestColor;
}

function collectUniqueThemeSeedColors(themeModule: ThemeModule) {
  const seedColors = new Set<string>();
  const directColors = Object.values(themeModule.colors ?? {});
  const tokenColors = collectThemeTextColors(themeModule).map((item) => item.settings?.foreground);

  for (const colorValue of [...directColors, ...tokenColors]) {
    const color = parseThemeSeedColor(colorValue, {
      minimumAlpha: MINIMUM_SEED_ALPHA,
      minimumChromaticRange: MINIMUM_CHROMATIC_RANGE,
    });
    if (color) {
      seedColors.add(color);
    }
  }

  return [...seedColors];
}

function parseThemeSeedColor(
  value: string | undefined,
  options?: { minimumAlpha?: number; minimumChromaticRange?: number },
) {
  const parsedColor = parseHexColorWithAlpha(value);
  if (!parsedColor) {
    return undefined;
  }

  const minimumAlpha = options?.minimumAlpha ?? 0.98;
  const minimumChromaticRange = options?.minimumChromaticRange ?? 0;
  if (parsedColor.alpha < minimumAlpha || calculateChromaticRange(parsedColor) < minimumChromaticRange) {
    return undefined;
  }

  return rgbToHex(parsedColor);
}

function parseHexColorWithAlpha(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(trimmed)) {
    return undefined;
  }

  const alphaHex = trimmed.length === 9 ? trimmed.slice(7, 9) : "ff";
  return {
    alpha: Number.parseInt(alphaHex, 16) / 255,
    blue: Number.parseInt(trimmed.slice(5, 7), 16),
    green: Number.parseInt(trimmed.slice(3, 5), 16),
    red: Number.parseInt(trimmed.slice(1, 3), 16),
  };
}

function parseRgbColor(value: string) {
  const trimmed = value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return undefined;
  }

  return {
    blue: Number.parseInt(trimmed.slice(5, 7), 16),
    green: Number.parseInt(trimmed.slice(3, 5), 16),
    red: Number.parseInt(trimmed.slice(1, 3), 16),
  };
}

function colorsAreTooClose(left: string, right: string) {
  const leftColor = parseRgbColor(left);
  const rightColor = parseRgbColor(right);
  return leftColor && rightColor ? colorDistance(leftColor, rightColor) < 42 : false;
}

function scoreThemeColor(color: string, surface: string, ink: string) {
  const targetColor = parseRgbColor(color);
  const surfaceColor = parseRgbColor(surface);
  const inkColor = parseRgbColor(ink);

  if (!targetColor || !surfaceColor || !inkColor) {
    return 0;
  }

  return (
    calculateChromaticRange(targetColor) +
    colorDistance(targetColor, surfaceColor) / 4 +
    colorDistance(targetColor, inkColor) / 4
  );
}

function colorDistance(left: RgbColor, right: RgbColor) {
  return Math.sqrt(
    (left.red - right.red) ** 2 + (left.green - right.green) ** 2 + (left.blue - right.blue) ** 2,
  );
}

function calculateHue(color: RgbColor) {
  const red = color.red / 255;
  const green = color.green / 255;
  const blue = color.blue / 255;
  const max = Math.max(red, green, blue);
  const delta = max - Math.min(red, green, blue);

  if (delta === 0) {
    return null;
  }

  const hue =
    max === red
      ? ((green - blue) / delta) % 6
      : max === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;

  return (hue * 60 + 360) % 360;
}

function hueInRange(hue: number, range: { max: number; min: number }) {
  return range.min <= range.max ? hue >= range.min && hue <= range.max : hue >= range.min || hue <= range.max;
}

function hueDistance(hue: number, targetHue: number) {
  const distance = Math.abs(hue - targetHue);
  return Math.min(distance, 360 - distance);
}

function calculateChromaticRange(color: RgbColor) {
  return Math.max(color.red, color.green, color.blue) - Math.min(color.red, color.green, color.blue);
}

function buildComputedAppearanceTheme(theme: AppearanceChromeTheme, variant: AppearanceVariant): ComputedAppearanceTheme {
  const contrast = resolveThemeContrast(theme.contrast, variant);
  const surface = parseRgbColor(theme.surface) ?? WHITE_RGB;
  const ink = parseRgbColor(theme.ink) ?? BLACK_RGB;

  return {
    accent: parseRgbColor(theme.accent) ?? (variant === "light" ? parseRgbColor("#339cff")! : parseRgbColor("#339cff")!),
    contrast,
    editorBackground: variant === "light" ? mixRgb(surface, WHITE_RGB, 0.12) : mixRgb(surface, ink, 0.07),
    ink,
    surface,
    surfaceUnder: computeSurfaceUnder(theme, surface, ink, variant),
    theme,
    variant,
  };
}

function buildLightAppearancePalette(theme: ComputedAppearanceTheme) {
  const controlBackground = mixRgb(theme.surface, WHITE_RGB, 0.09 + theme.contrast * 0.04);
  const elevatedSecondary = mixRgb(theme.surface, WHITE_RGB, 0.08 + theme.contrast * 0.08);
  const elevatedPrimary = mixRgb(theme.surface, WHITE_RGB, 0.16 + theme.contrast * 0.12);

  return {
    accentBackground: mixHex(theme.theme.surface, theme.theme.accent, 0.11 + theme.contrast * 0.04),
    accentBackgroundActive: mixHex(theme.theme.surface, theme.theme.accent, 0.13 + theme.contrast * 0.05),
    accentBackgroundHover: mixHex(theme.theme.surface, theme.theme.accent, 0.12 + theme.contrast * 0.045),
    border: rgba(theme.ink, 0.06 + theme.contrast * 0.04),
    borderFocus: theme.theme.accent,
    borderHeavy: rgba(theme.ink, 0.09 + theme.contrast * 0.06),
    borderLight: rgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonPrimaryBackground: theme.theme.ink,
    buttonPrimaryBackgroundActive: rgba(theme.ink, 0.1 + theme.contrast * 0.12),
    buttonPrimaryBackgroundHover: rgba(theme.ink, 0.05 + theme.contrast * 0.06),
    buttonPrimaryBackgroundInactive: rgba(theme.ink, 0.18 + theme.contrast * 0.14),
    buttonSecondaryBackground: rgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonSecondaryBackgroundActive: rgba(theme.ink, 0.03 + theme.contrast * 0.02),
    buttonSecondaryBackgroundHover: rgba(theme.ink, 0.04 + theme.contrast * 0.03),
    buttonSecondaryBackgroundInactive: rgba(theme.ink, 0.01 + theme.contrast * 0.02),
    buttonTertiaryBackground: rgba(theme.ink, 0),
    buttonTertiaryBackgroundActive: rgba(theme.ink, 0.16 + theme.contrast * 0.08),
    buttonTertiaryBackgroundHover: rgba(theme.ink, 0.08 + theme.contrast * 0.04),
    controlBackground: rgba(controlBackground, 0.96),
    controlBackgroundOpaque: rgbCss(controlBackground),
    elevatedPrimary: rgba(elevatedPrimary, 0.96),
    elevatedPrimaryOpaque: rgbCss(elevatedPrimary),
    elevatedSecondary: rgba(elevatedSecondary, 0.96),
    elevatedSecondaryOpaque: rgbCss(elevatedSecondary),
    iconAccent: theme.theme.accent,
    iconPrimary: theme.theme.ink,
    iconSecondary: rgba(theme.ink, 0.65 + theme.contrast * 0.1),
    iconTertiary: rgba(theme.ink, 0.45 + theme.contrast * 0.1),
    simpleScrim: rgba(BLACK_RGB, 0.08 + theme.contrast * 0.04),
    textAccent: theme.theme.accent,
    textButtonPrimary: theme.theme.surface,
    textButtonSecondary: theme.theme.ink,
    textButtonTertiary: rgba(theme.ink, 0.45 + theme.contrast * 0.1),
    textForeground: theme.theme.ink,
    textForegroundSecondary: rgba(theme.ink, 0.65 + theme.contrast * 0.1),
    textForegroundTertiary: rgba(theme.ink, 0.45 + theme.contrast * 0.1),
  };
}

function buildDarkAppearancePalette(theme: ComputedAppearanceTheme) {
  const controlBackground = mixRgb(theme.surface, theme.ink, 0.06 + theme.contrast * 0.05);
  const accentFocus = mixRgb(theme.accent, WHITE_RGB, 0.3 + theme.contrast * 0.15);
  const elevatedPrimary = mixRgb(theme.surface, BLACK_RGB, 0.38 + theme.contrast * 0.12);
  const elevatedSecondary = mixRgb(theme.surface, theme.ink, 0.08 + theme.contrast * 0.08);

  return {
    accentBackground: mixHex("#000000", theme.theme.accent, 0.2 + theme.contrast * 0.08),
    accentBackgroundActive: mixHex("#000000", theme.theme.accent, 0.22 + theme.contrast * 0.12),
    accentBackgroundHover: mixHex("#000000", theme.theme.accent, 0.21 + theme.contrast * 0.1),
    border: rgba(theme.ink, 0.06 + theme.contrast * 0.04),
    borderFocus: rgba(accentFocus, 0.7 + theme.contrast * 0.1),
    borderHeavy: rgba(theme.ink, 0.12 + theme.contrast * 0.06),
    borderLight: rgba(theme.ink, 0.03 + theme.contrast * 0.02),
    buttonPrimaryBackground: rgbCss(elevatedPrimary),
    buttonPrimaryBackgroundActive: rgba(theme.ink, 0.07 + theme.contrast * 0.05),
    buttonPrimaryBackgroundHover: rgba(theme.ink, 0.04 + theme.contrast * 0.03),
    buttonPrimaryBackgroundInactive: rgba(theme.ink, 0.02 + theme.contrast * 0.02),
    buttonSecondaryBackground: rgba(theme.ink, 0.04 + theme.contrast * 0.02),
    buttonSecondaryBackgroundActive: rgba(theme.ink, 0.09 + theme.contrast * 0.05),
    buttonSecondaryBackgroundHover: rgba(theme.ink, 0.06 + theme.contrast * 0.03),
    buttonSecondaryBackgroundInactive: rgba(theme.ink, 0.02 + theme.contrast * 0.03),
    buttonTertiaryBackground: rgba(theme.ink, 0.02 + theme.contrast * 0.015),
    buttonTertiaryBackgroundActive: rgba(theme.ink, 0.07 + theme.contrast * 0.05),
    buttonTertiaryBackgroundHover: rgba(theme.ink, 0.05 + theme.contrast * 0.03),
    controlBackground: rgba(controlBackground, 0.96),
    controlBackgroundOpaque: rgbCss(controlBackground),
    elevatedPrimary: rgba(elevatedSecondary, 0.96),
    elevatedPrimaryOpaque: rgbCss(elevatedSecondary),
    elevatedSecondary: rgba(theme.ink, 0.02 + theme.contrast * 0.02),
    elevatedSecondaryOpaque: mixHex(theme.theme.surface, theme.theme.ink, 0.04 + theme.contrast * 0.05),
    iconAccent: rgbCss(accentFocus),
    iconPrimary: rgba(theme.ink, 0.82 + theme.contrast * 0.14),
    iconSecondary: rgba(theme.ink, 0.65 + theme.contrast * 0.1),
    iconTertiary: rgba(theme.ink, 0.45 + theme.contrast * 0.1),
    simpleScrim: rgba(theme.ink, 0.08 + theme.contrast * 0.04),
    textAccent: rgbCss(accentFocus),
    textButtonPrimary: rgbCss(elevatedPrimary),
    textButtonSecondary: mixHex(theme.theme.ink, theme.theme.surface, 0.7 + theme.contrast * 0.1),
    textButtonTertiary: rgba(theme.ink, 0.45 + theme.contrast * 0.1),
    textForeground: theme.theme.ink,
    textForegroundSecondary: rgba(theme.ink, 0.65 + theme.contrast * 0.1),
    textForegroundTertiary: rgba(theme.ink, 0.42 + theme.contrast * 0.13),
  };
}

function buildAppearanceCssVariables(
  theme: ComputedAppearanceTheme,
  palette: ReturnType<typeof buildLightAppearancePalette> | ReturnType<typeof buildDarkAppearancePalette>,
) {
  return {
    "--codex-base-accent": theme.theme.accent,
    "--codex-base-contrast": String(theme.theme.contrast),
    "--codex-base-ink": theme.theme.ink,
    "--codex-base-surface": theme.theme.surface,
    "--color-accent-blue": theme.theme.accent,
    "--color-accent-purple": theme.theme.semanticColors.skill,
    "--color-background-accent": palette.accentBackground,
    "--color-background-accent-active": palette.accentBackgroundActive,
    "--color-background-accent-hover": palette.accentBackgroundHover,
    "--color-background-button-primary": palette.buttonPrimaryBackground,
    "--color-background-button-primary-active": palette.buttonPrimaryBackgroundActive,
    "--color-background-button-primary-hover": palette.buttonPrimaryBackgroundHover,
    "--color-background-button-primary-inactive": palette.buttonPrimaryBackgroundInactive,
    "--color-background-button-secondary": palette.buttonSecondaryBackground,
    "--color-background-button-secondary-active": palette.buttonSecondaryBackgroundActive,
    "--color-background-button-secondary-hover": palette.buttonSecondaryBackgroundHover,
    "--color-background-button-secondary-inactive": palette.buttonSecondaryBackgroundInactive,
    "--color-background-button-tertiary": palette.buttonTertiaryBackground,
    "--color-background-button-tertiary-active": palette.buttonTertiaryBackgroundActive,
    "--color-background-button-tertiary-hover": palette.buttonTertiaryBackgroundHover,
    "--color-background-control": palette.controlBackground,
    "--color-background-control-opaque": palette.controlBackgroundOpaque,
    "--color-background-editor-opaque": rgbCss(theme.editorBackground),
    "--color-background-elevated-primary": palette.elevatedPrimary,
    "--color-background-elevated-primary-opaque": palette.elevatedPrimaryOpaque,
    "--color-background-elevated-secondary": palette.elevatedSecondary,
    "--color-background-elevated-secondary-opaque": palette.elevatedSecondaryOpaque,
    "--color-background-panel": buildPanelBackground(theme),
    "--color-background-surface": theme.theme.surface,
    "--color-background-surface-under": theme.surfaceUnder,
    "--color-border": palette.border,
    "--color-border-focus": palette.borderFocus,
    "--color-border-heavy": palette.borderHeavy,
    "--color-border-light": palette.borderLight,
    "--color-decoration-added": theme.theme.semanticColors.diffAdded,
    "--color-decoration-deleted": theme.theme.semanticColors.diffRemoved,
    "--color-editor-added":
      theme.variant === "light"
        ? rgba(parseRgbColor(theme.theme.semanticColors.diffAdded) ?? BLACK_RGB, 0.15)
        : rgba(parseRgbColor(theme.theme.semanticColors.diffAdded) ?? BLACK_RGB, 0.23),
    "--color-editor-deleted":
      theme.variant === "light"
        ? rgba(parseRgbColor(theme.theme.semanticColors.diffRemoved) ?? BLACK_RGB, 0.15)
        : rgba(parseRgbColor(theme.theme.semanticColors.diffRemoved) ?? BLACK_RGB, 0.23),
    "--color-icon-accent": palette.iconAccent,
    "--color-icon-primary": palette.iconPrimary,
    "--color-icon-secondary": palette.iconSecondary,
    "--color-icon-tertiary": palette.iconTertiary,
    "--color-simple-scrim": palette.simpleScrim,
    "--color-text-accent": palette.textAccent,
    "--color-text-button-primary": palette.textButtonPrimary,
    "--color-text-button-secondary": palette.textButtonSecondary,
    "--color-text-button-tertiary": palette.textButtonTertiary,
    "--color-text-foreground": palette.textForeground,
    "--color-text-foreground-secondary": palette.textForegroundSecondary,
    "--color-text-foreground-tertiary": palette.textForegroundTertiary,
  };
}

function resolveThemeContrast(contrast: number, variant: AppearanceVariant) {
  const baseContrast = BASE_CONTRAST_BY_VARIANT[variant];
  const baseRatio = baseContrast / 100;
  const contrastRatio = contrast / 100 + ((contrast - baseContrast) / 60) * CONTRAST_CURVE_BASE;
  return contrast <= baseContrast
    ? contrastRatio
    : baseRatio + (contrastRatio - baseRatio) * CONTRAST_CURVE_EXPONENT;
}

function computeSurfaceUnder(
  theme: AppearanceChromeTheme,
  surface: RgbColor,
  ink: RgbColor,
  variant: AppearanceVariant,
) {
  const baseContrast = BASE_CONTRAST_BY_VARIANT[variant];
  const opacity =
    SURFACE_UNDER_BASE_BY_VARIANT[variant] + (theme.contrast - baseContrast) * SURFACE_UNDER_SCALE_BY_VARIANT[variant];
  return variant === "light" ? mixHex(theme.surface, theme.ink, opacity) : mixHex(theme.surface, "#000000", opacity);
}

function buildPanelBackground(theme: ComputedAppearanceTheme) {
  const panelColor = theme.variant === "light" ? WHITE_RGB : theme.ink;
  return mixHex(
    theme.theme.surface,
    rgbToHex(panelColor),
    PANEL_BASE_BY_VARIANT[theme.variant] + theme.contrast * PANEL_SCALE_BY_VARIANT[theme.variant],
  );
}

function mixHex(fromColor: string, toColor: string, ratio: number) {
  const from = parseRgbColor(fromColor) ?? BLACK_RGB;
  const to = parseRgbColor(toColor) ?? BLACK_RGB;
  return rgbToHex(mixRgb(from, to, ratio));
}

function mixRgb(from: RgbColor, to: RgbColor, ratio: number): RgbColor {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  return {
    blue: mixChannel(from.blue, to.blue, clampedRatio),
    green: mixChannel(from.green, to.green, clampedRatio),
    red: mixChannel(from.red, to.red, clampedRatio),
  };
}

function mixChannel(from: number, to: number, ratio: number) {
  return Math.round(from + (to - from) * ratio);
}

function rgba(color: RgbColor, alpha: number) {
  return `rgba(${color.red}, ${color.green}, ${color.blue}, ${formatAlpha(alpha)})`;
}

function rgbCss(color: RgbColor) {
  return `rgb(${color.red}, ${color.green}, ${color.blue})`;
}

function formatAlpha(alpha: number) {
  return Math.min(1, Math.max(0, alpha)).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function rgbToHex(color: RgbColor) {
  return `#${toHexChannel(color.red)}${toHexChannel(color.green)}${toHexChannel(color.blue)}`;
}

function toHexChannel(channel: number) {
  return channel.toString(16).padStart(2, "0");
}

function setOptionalStyleProperty(root: HTMLElement, property: string, value: string | null) {
  if (value) {
    root.style.setProperty(property, value);
    return;
  }
  root.style.removeProperty(property);
}
