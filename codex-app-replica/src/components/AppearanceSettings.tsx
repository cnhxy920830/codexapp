import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/i18n";
import {
  applyAppearanceSettingsSnapshot,
  type AppearanceSettingsSnapshot,
  type AppearanceTheme,
  DEFAULT_APPEARANCE_SETTINGS,
  readAppearanceSettingsSnapshot,
  setGlobalState,
} from "../services/settings";
import {
  decodeAppearanceThemeShare,
  encodeAppearanceThemeShare,
  loadCodeThemeSeed,
  mergeAppearanceChromeTheme,
  type AppearanceChromeTheme,
  type AppearanceChromeThemePatch,
  type AppearanceCodeThemeId,
  type AppearanceVariant,
} from "../services/appearanceThemes";
import type { AppToast } from "./AppToastRegion";
import { Button } from "./Button";
import { SettingsContentLayout } from "./SettingsContentLayout";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { SettingsSectionTitle } from "./SettingsSectionTitle";
import { SettingsSurface } from "./SettingsSurface";
import { ToggleSwitch } from "./ToggleSwitch";
import { PetsSection } from "./appearance/PetsSection";
import { ThemeEditorCard } from "./appearance/ThemeEditorCard";
import { ThemePreviewCard } from "./appearance/ThemePreviewCard";

const SYSTEM_APPEARANCE_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function AppearanceSettings({
  onOpenChatWithPrompt,
  onShowToast,
}: {
  onOpenChatWithPrompt?: (prompt: string) => void;
  onShowToast?: (toast: AppToast) => void;
}) {
  const { t } = useI18n();
  const [state, setState] = useState<AppearanceSettingsSnapshot>(DEFAULT_APPEARANCE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const stateRef = useRef(state);
  const previewVariant = useResolvedPreviewVariant(state.appearanceTheme);
  const isMacOsPlatform =
    typeof navigator !== "undefined" && (navigator.platform ?? "").startsWith("Mac");
  const showCodeFont = state.conversationDetailMode === "STEPS_COMMANDS";

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapshot = await readAppearanceSettingsSnapshot();
        if (cancelled) {
          return;
        }
        stateRef.current = snapshot;
        setState(snapshot);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyAppearanceSettingsSnapshot(state);
  }, [state]);

  const editorVariants = useMemo(
    () => (state.appearanceTheme === "system" ? (["light", "dark"] as const) : [state.appearanceTheme]),
    [state.appearanceTheme],
  );

  const previewTheme = readChromeTheme(state, previewVariant);

  const persistSnapshotChange = async (
    buildNext: (current: AppearanceSettingsSnapshot) => AppearanceSettingsSnapshot | Promise<AppearanceSettingsSnapshot>,
    persist: (next: AppearanceSettingsSnapshot) => Promise<void>,
  ) => {
    const previousState = stateRef.current;
    setIsSaving(true);

    try {
      const nextState = await buildNext(previousState);
      stateRef.current = nextState;
      setState(nextState);
      await persist(nextState);
      return nextState;
    } catch {
      stateRef.current = previousState;
      setState(previousState);
      throw new Error("Failed to persist appearance settings");
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (toast: AppToast) => {
    onShowToast?.(toast);
  };

  const persistTheme = async (value: AppearanceTheme) => {
    await persistSnapshotChange(
      (current) => ({ ...current, appearanceTheme: value }),
      async () => {
        await setGlobalState("appearanceTheme", value);
      },
    );
  };

  const persistPointerCursors = async (value: boolean) => {
    await persistSnapshotChange(
      (current) => ({ ...current, usePointerCursors: value }),
      async () => {
        await setGlobalState("usePointerCursors", value);
      },
    );
  };

  const persistFontSmoothing = async (value: boolean) => {
    await persistSnapshotChange(
      (current) => ({ ...current, useFontSmoothing: value }),
      async () => {
        await setGlobalState("useFontSmoothing", value);
      },
    );
  };

  const persistNumber = async (field: "uiFontSize" | "codeFontSize", value: number) => {
    await persistSnapshotChange(
      (current) => ({ ...current, [field]: value }),
      async () => {
        await setGlobalState(field === "uiFontSize" ? "sansFontSize" : "codeFontSize", value);
      },
    );
  };

  const persistChromeThemePatch = async (variant: AppearanceVariant, patch: AppearanceChromeThemePatch) => {
    await persistSnapshotChange(
      (current) => setChromeTheme(current, variant, mergeAppearanceChromeTheme(readChromeTheme(current, variant), patch)),
      async (nextState) => {
        await setGlobalState(chromeThemeKeyForVariant(variant), readChromeTheme(nextState, variant));
      },
    );
  };

  const persistThemeFontsPatch = async (variant: AppearanceVariant, patch: Partial<AppearanceChromeTheme["fonts"]>) => {
    await persistChromeThemePatch(variant, { fonts: patch });
  };

  const persistCodeThemeSelection = async (variant: AppearanceVariant, codeThemeId: AppearanceCodeThemeId) => {
    await persistSnapshotChange(
      async (current) => {
        const seed = await loadCodeThemeSeed(codeThemeId, variant);
        return setVariantThemeState(current, variant, {
          chromeTheme: mergeAppearanceChromeTheme(readChromeTheme(current, variant), seed),
          codeThemeId,
        });
      },
      async (nextState) => {
        await Promise.all([
          setGlobalState(codeThemeKeyForVariant(variant), readCodeThemeId(nextState, variant)),
          setGlobalState(chromeThemeKeyForVariant(variant), readChromeTheme(nextState, variant)),
        ]);
      },
    );
  };

  const copyTheme = async (variant: AppearanceVariant) => {
    const variantLabel = getVariantLabel(t, variant);
    const currentState = stateRef.current;
    const shareString = encodeAppearanceThemeShare({
      codeThemeId: readCodeThemeId(currentState, variant),
      theme: readChromeTheme(currentState, variant),
      variant,
    });

    try {
      await navigator.clipboard.writeText(shareString);
      showToast({
        tone: "success",
        message: t("settings.general.appearance.chromeTheme.export.success", { variant: variantLabel }),
      });
    } catch {
      showToast({
        tone: "error",
        message: t("settings.general.appearance.chromeTheme.export.error", { variant: variantLabel }),
      });
    }
  };

  const importTheme = async (variant: AppearanceVariant, value: string) => {
    const variantLabel = getVariantLabel(t, variant);

    try {
      const decoded = decodeAppearanceThemeShare(value, variant);
      await persistSnapshotChange(
        (current) =>
          setVariantThemeState(current, variant, {
            chromeTheme: decoded.theme,
            codeThemeId: decoded.codeThemeId,
          }),
        async (nextState) => {
          await Promise.all([
            setGlobalState(codeThemeKeyForVariant(variant), readCodeThemeId(nextState, variant)),
            setGlobalState(chromeThemeKeyForVariant(variant), readChromeTheme(nextState, variant)),
          ]);
        },
      );
      showToast({
        tone: "success",
        message: t("settings.general.appearance.chromeTheme.import.success", { variant: variantLabel }),
      });
    } catch (err) {
      showToast({
        tone: "error",
        message: t("settings.general.appearance.chromeTheme.import.error", { variant: variantLabel }),
      });
      throw err;
    }
  };

  const themeOptions: Array<{ value: AppearanceTheme; ariaLabel: string; label: ReactNode }> = [
    {
      value: "light",
      ariaLabel: t("settings.general.appearance.theme.light"),
      label: (
        <ThemeOptionLabel icon={<ThemeLightIcon className="size-5" />} label={t("settings.general.appearance.theme.light")} />
      ),
    },
    {
      value: "dark",
      ariaLabel: t("settings.general.appearance.theme.dark"),
      label: (
        <ThemeOptionLabel icon={<ThemeDarkIcon className="size-5" />} label={t("settings.general.appearance.theme.dark")} />
      ),
    },
    {
      value: "system",
      ariaLabel: t("settings.general.appearance.theme.system"),
      label: (
        <ThemeOptionLabel
          icon={<ThemeSystemIcon className="size-5" />}
          label={t("settings.general.appearance.theme.system")}
        />
      ),
    },
  ];

  return (
    <SettingsContentLayout title={<SettingsSectionTitle slug="appearance" />}>
      <SettingsGroup>
        <SettingsGroup.Content>
          <SettingsSurface>
            <SettingsRow
              label={t("settings.general.appearance.theme")}
              description={t("settings.general.appearance.theme.description")}
              control={
                <SegmentedControl
                  ariaLabel={t("settings.general.appearance.theme")}
                  selectedId={state.appearanceTheme}
                  onSelect={(value) => {
                    if (value === "light" || value === "dark" || value === "system") {
                      void persistTheme(value);
                    }
                  }}
                  options={themeOptions.map((option) => ({
                    id: option.value,
                    label: option.label,
                    ariaLabel: option.ariaLabel,
                    disabled: isLoading || isSaving,
                  }))}
                />
              }
            />

            <div className="flex flex-col gap-2 p-1">
              <ThemePreviewCard theme={previewTheme} variant={previewVariant} />
              <div className="flex flex-col gap-2">
                {editorVariants.map((variant) => (
                  <ThemeEditorCard
                    key={variant}
                    codeThemeId={readCodeThemeId(state, variant)}
                    disabled={isLoading || isSaving}
                    theme={readChromeTheme(state, variant)}
                    variant={variant}
                    showCodeFont={showCodeFont}
                    onCodeThemeChange={(value) => void persistCodeThemeSelection(variant, value)}
                    onCopyTheme={() => copyTheme(variant)}
                    onFontsPatchChange={(patch) => void persistThemeFontsPatch(variant, patch)}
                    onImportTheme={(value) => importTheme(variant, value)}
                    onThemePatchChange={(patch) => void persistChromeThemePatch(variant, patch)}
                  />
                ))}
              </div>
            </div>

            <SettingsRow
              label={t("settings.general.appearance.usePointerCursors.label")}
              description={t("settings.general.appearance.usePointerCursors.description")}
              control={
                <ToggleSwitch
                  checked={state.usePointerCursors}
                  disabled={isLoading || isSaving}
                  ariaLabel={t("settings.general.appearance.usePointerCursors.label")}
                  onChange={(checked) => void persistPointerCursors(checked)}
                />
              }
            />

            <SettingsRow
              label={t("settings.general.appearance.sansFontSize.row")}
              description={t("settings.general.appearance.sansFontSize.row.description")}
              control={
                <NumberInput
                  ariaLabel={t("settings.general.appearance.sansFontSize")}
                  disabled={isLoading || isSaving}
                  max={16}
                  min={11}
                  unitLabel={t("settings.general.appearance.sansFontSize.units")}
                  value={state.uiFontSize}
                  onCommit={(value) => void persistNumber("uiFontSize", value)}
                />
              }
            />

            {showCodeFont ? (
              <SettingsRow
                label={t("settings.general.appearance.codeFontSize.row")}
                description={t("settings.general.appearance.codeFontSize.row.description")}
                control={
                  <NumberInput
                    ariaLabel={t("settings.general.appearance.codeFontSize")}
                    disabled={isLoading || isSaving}
                    max={24}
                    min={8}
                    unitLabel={t("settings.general.appearance.codeFontSize.units")}
                    value={state.codeFontSize}
                    onCommit={(value) => void persistNumber("codeFontSize", value)}
                  />
                }
              />
            ) : null}

            {isMacOsPlatform ? (
              <SettingsRow
                label={t("settings.general.appearance.fontSmoothing.label")}
                description={t("settings.general.appearance.fontSmoothing.description")}
                control={
                  <ToggleSwitch
                    checked={state.useFontSmoothing}
                    disabled={isLoading || isSaving}
                    ariaLabel={t("settings.general.appearance.fontSmoothing.label")}
                    onChange={(checked) => void persistFontSmoothing(checked)}
                  />
                }
              />
            ) : null}
          </SettingsSurface>
        </SettingsGroup.Content>
      </SettingsGroup>

      <PetsSection onOpenChatWithPrompt={onOpenChatWithPrompt} onShowToast={onShowToast} />
    </SettingsContentLayout>
  );
}

function readChromeTheme(state: AppearanceSettingsSnapshot, variant: AppearanceVariant) {
  return variant === "light" ? state.lightChromeTheme : state.darkChromeTheme;
}

function readCodeThemeId(state: AppearanceSettingsSnapshot, variant: AppearanceVariant) {
  return variant === "light" ? state.lightCodeThemeId : state.darkCodeThemeId;
}

function setChromeTheme(
  state: AppearanceSettingsSnapshot,
  variant: AppearanceVariant,
  chromeTheme: AppearanceChromeTheme,
): AppearanceSettingsSnapshot {
  return variant === "light" ? { ...state, lightChromeTheme: chromeTheme } : { ...state, darkChromeTheme: chromeTheme };
}

function setVariantThemeState(
  state: AppearanceSettingsSnapshot,
  variant: AppearanceVariant,
  values: {
    chromeTheme: AppearanceChromeTheme;
    codeThemeId: AppearanceCodeThemeId;
  },
): AppearanceSettingsSnapshot {
  return variant === "light"
    ? {
        ...state,
        lightChromeTheme: values.chromeTheme,
        lightCodeThemeId: values.codeThemeId,
      }
    : {
        ...state,
        darkChromeTheme: values.chromeTheme,
        darkCodeThemeId: values.codeThemeId,
      };
}

function chromeThemeKeyForVariant(variant: AppearanceVariant) {
  return variant === "light" ? "appearanceLightChromeTheme" : "appearanceDarkChromeTheme";
}

function codeThemeKeyForVariant(variant: AppearanceVariant) {
  return variant === "light" ? "appearanceLightCodeThemeId" : "appearanceDarkCodeThemeId";
}

function getVariantLabel(
  t: (key: "settings.general.appearance.theme.light" | "settings.general.appearance.theme.dark") => string,
  variant: AppearanceVariant,
) {
  return variant === "light" ? t("settings.general.appearance.theme.light") : t("settings.general.appearance.theme.dark");
}

function useResolvedPreviewVariant(theme: AppearanceTheme): AppearanceVariant {
  const [resolvedVariant, setResolvedVariant] = useState<AppearanceVariant>(() => resolveSystemAppearanceVariant());

  useEffect(() => {
    if (theme !== "system") {
      setResolvedVariant(theme);
      return;
    }

    const updateVariant = () => {
      setResolvedVariant(resolveSystemAppearanceVariant());
    };

    updateVariant();

    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia(SYSTEM_APPEARANCE_MEDIA_QUERY);
    if (typeof mediaQuery.addEventListener === "function" && typeof mediaQuery.removeEventListener === "function") {
      mediaQuery.addEventListener("change", updateVariant);
      return () => {
        mediaQuery.removeEventListener("change", updateVariant);
      };
    }

    if (typeof mediaQuery.addListener === "function" && typeof mediaQuery.removeListener === "function") {
      mediaQuery.addListener(updateVariant);
      return () => {
        mediaQuery.removeListener(updateVariant);
      };
    }

    return;
  }, [theme]);

  return theme === "system" ? resolvedVariant : theme;
}

function resolveSystemAppearanceVariant(): AppearanceVariant {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(SYSTEM_APPEARANCE_MEDIA_QUERY).matches ? "dark" : "light";
}

function ThemeOptionLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span className="text-sm">{label}</span>
    </span>
  );
}

function SegmentedControl({
  ariaLabel,
  onSelect,
  options,
  selectedId,
}: {
  ariaLabel: string;
  onSelect: (id: string) => void;
  options: Array<{
    ariaLabel: string;
    disabled?: boolean;
    id: string;
    label: ReactNode;
  }>;
  selectedId: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const selected = option.id === selectedId;
        const disabled = option.disabled ?? false;

        return (
          <Button
            key={option.id}
            color={selected ? "secondary" : "ghost"}
            size="default"
            aria-label={option.ariaLabel}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => {
              if (!disabled) {
                onSelect(option.id);
              }
            }}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function NumberInput({
  ariaLabel,
  disabled,
  max,
  min,
  onCommit,
  unitLabel,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  unitLabel: string;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div className="flex items-center gap-2">
      <input
        aria-label={ariaLabel}
        type="number"
        min={min}
        max={max}
        step={1}
        disabled={disabled}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => commitNumberValue(draft, value, min, max, onCommit, setDraft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitNumberValue(draft, value, min, max, onCommit, setDraft);
          }
        }}
        className="focus-visible:ring-token-focus h-token-button-composer w-16 rounded-lg border border-token-border bg-token-input-background px-2 py-0 text-right text-sm text-token-text-primary shadow-sm outline-none focus-visible:ring-2"
      />
      <span className="text-sm text-token-text-secondary">{unitLabel}</span>
    </div>
  );
}

function commitNumberValue(
  draft: string,
  fallback: number,
  min: number,
  max: number,
  onCommit: (value: number) => void,
  setDraft: (value: string) => void,
) {
  const parsed = Number(draft);
  if (!Number.isFinite(parsed)) {
    setDraft(String(fallback));
    return;
  }
  const clamped = Math.min(max, Math.max(min, Math.round(parsed)));
  setDraft(String(clamped));
  if (clamped !== fallback) {
    onCommit(clamped);
  }
}

function ThemeLightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9.33447 18.3336V16.6666C9.33447 16.2995 9.63239 16.0018 9.99951 16.0016C10.3668 16.0016 10.6646 16.2994 10.6646 16.6666V18.3336C10.6644 18.7007 10.3667 18.9987 9.99951 18.9987C9.6325 18.9985 9.33465 18.7006 9.33447 18.3336ZM5.28564 14.7145L5.75635 15.1842L4.57764 16.3629C4.31799 16.6225 3.89691 16.6224 3.63721 16.3629C3.37752 16.1032 3.37753 15.6822 3.63721 15.4225L4.81592 14.2438L5.28564 14.7145ZM16.3628 15.4225C16.6223 15.6822 16.6224 16.1033 16.3628 16.3629C16.1032 16.6226 15.6821 16.6224 15.4224 16.3629L16.3628 15.4225ZM16.3628 15.4225L15.8921 15.8922L15.4224 16.3629L14.2437 15.1842L14.7144 14.7145L15.1841 14.2438L16.3628 15.4225ZM4.81592 14.2438C5.07563 13.9843 5.49671 13.9841 5.75635 14.2438C6.01582 14.5034 6.01581 14.9245 5.75635 15.1842L4.81592 14.2438ZM14.2437 14.2438C14.5033 13.9841 14.9244 13.9841 15.1841 14.2438L14.2437 15.1842C13.984 14.9245 13.984 14.5035 14.2437 14.2438ZM12.6685 9.99963C12.6683 8.5261 11.4731 7.33167 9.99951 7.33167C8.52609 7.33184 7.33172 8.52621 7.33154 9.99963C7.33154 11.4732 8.52598 12.6684 9.99951 12.6686C11.4732 12.6686 12.6685 11.4733 12.6685 9.99963ZM3.3335 9.33459L3.46729 9.34827C3.77019 9.41027 3.99838 9.67844 3.99854 9.99963C3.99854 10.3209 3.77023 10.5889 3.46729 10.651L3.3335 10.6647H1.6665C1.29923 10.6647 1.00146 10.3669 1.00146 9.99963C1.00164 9.63251 1.29934 9.33459 1.6665 9.33459H3.3335ZM18.3335 9.33459L18.4673 9.34827C18.7702 9.41027 18.9984 9.67844 18.9985 9.99963C18.9985 10.3209 18.7702 10.5889 18.4673 10.651L18.3335 10.6647H16.6665C16.2992 10.6647 16.0015 10.3669 16.0015 9.99963C16.0016 9.63251 16.2993 9.33459 16.6665 9.33459H18.3335ZM5.75635 4.81604C6.01571 5.07577 6.01593 5.49688 5.75635 5.75647C5.49676 6.01605 5.07564 6.01583 4.81592 5.75647L5.75635 4.81604ZM15.1841 5.75647C14.9244 6.01594 14.5033 6.01595 14.2437 5.75647C13.984 5.49683 13.9841 5.07575 14.2437 4.81604L15.1841 5.75647ZM3.63721 3.63733C3.86449 3.41005 4.21501 3.38183 4.47314 3.55237L4.57764 3.63733L5.75635 4.81604L5.28564 5.28577L4.81592 5.75647L3.63721 4.57776L3.55225 4.47327C3.3817 4.21513 3.40992 3.86461 3.63721 3.63733ZM15.4224 3.63733C15.6821 3.37765 16.1031 3.37764 16.3628 3.63733C16.6223 3.89703 16.6224 4.31811 16.3628 4.57776L15.1841 5.75647L14.7144 5.28577L14.2437 4.81604L15.4224 3.63733ZM9.33447 3.33362V1.66663C9.33447 1.29947 9.63239 1.00176 9.99951 1.00159C10.3668 1.00159 10.6646 1.29936 10.6646 1.66663V3.33362C10.6644 3.70074 10.3667 3.99866 9.99951 3.99866C9.6325 3.99848 9.33465 3.70063 9.33447 3.33362ZM13.9985 9.99963C13.9985 12.2079 12.2077 13.9987 9.99951 13.9987C7.79144 13.9985 6.00146 12.2077 6.00146 9.99963C6.00164 7.79167 7.79155 6.00176 9.99951 6.00159C12.2076 6.00159 13.9984 7.79156 13.9985 9.99963Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThemeDarkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8.50195 5.83319C8.50197 4.93054 8.65078 4.06203 8.92188 3.24921C5.65928 3.76613 3.16504 6.59214 3.16504 10.0002C3.16514 13.775 6.2252 16.8351 10 16.8351C12.3126 16.8351 14.3565 15.6856 15.5938 13.926C11.5915 13.4005 8.50195 9.9788 8.50195 5.83319ZM9.83203 5.83319C9.83203 9.60806 12.8921 12.6682 16.667 12.6682C16.6833 12.6682 16.6996 12.6683 16.7158 12.6682C16.9467 12.6665 17.1618 12.7849 17.2842 12.9807C17.3913 13.1521 17.4145 13.3617 17.3496 13.55L17.3164 13.6291C15.9812 16.3161 13.2069 18.1652 10 18.1652C5.49066 18.1652 1.83506 14.5095 1.83496 10.0002C1.83496 5.51033 5.45891 1.8667 9.94141 1.83514L10.0273 1.84003C10.2248 1.86428 10.4027 1.97644 10.5098 2.14764C10.6321 2.34353 10.6447 2.58923 10.542 2.79608C10.0877 3.71023 9.83205 4.74091 9.83203 5.83319Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ThemeSystemIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.6682 13.998H12.6565L11.9641 14.3447C11.8718 14.3909 11.7695 14.415 11.6663 14.415H8.33325C8.23001 14.415 8.12774 14.3909 8.0354 14.3447L7.34302 13.998H2.32837V14.583C2.32837 15.1362 2.77712 15.585 3.33032 15.585H16.6663C17.2195 15.585 17.6682 15.1362 17.6682 14.583V13.998ZM16.8352 6.41699C16.8352 5.93931 16.8347 5.62054 16.8147 5.37598C16.8002 5.19841 16.7766 5.09313 16.7512 5.02246L16.7258 4.96191C16.6538 4.82049 16.5493 4.69891 16.4221 4.60645L16.2883 4.52441C16.2194 4.48931 16.1101 4.45489 15.8733 4.43555C15.6288 4.4156 15.3106 4.41504 14.8333 4.41504H5.16626C4.68886 4.41504 4.37071 4.41559 4.12622 4.43555C3.94903 4.45002 3.84339 4.47277 3.77271 4.49805L3.71216 4.52441C3.57094 4.59637 3.4491 4.70021 3.35669 4.82715L3.27368 4.96191C3.23861 5.03079 3.20513 5.13947 3.18579 5.37598C3.16581 5.62054 3.16528 5.93931 3.16528 6.41699V12.668H7.50024L7.57642 12.6729C7.65302 12.6817 7.72779 12.7036 7.79712 12.7383L8.4895 13.085H11.51L12.2024 12.7383L12.2737 12.708C12.346 12.6819 12.423 12.668 12.5002 12.668H16.8352V6.41699ZM18.1653 12.668H18.3333C18.7003 12.668 18.9981 12.9659 18.9983 13.333V14.583C18.9983 15.8708 17.954 16.915 16.6663 16.915H3.33032C2.04258 16.915 0.998291 15.8708 0.998291 14.583V13.333L1.01196 13.1992C1.07402 12.8962 1.34201 12.668 1.66333 12.668H1.83521V6.41699C1.83521 5.96125 1.83419 5.57886 1.85962 5.26758C1.88569 4.94869 1.94266 4.6459 2.08911 4.3584L2.17896 4.19727C2.40296 3.83215 2.72389 3.53443 3.10767 3.33887L3.21606 3.28809C3.47122 3.17862 3.73854 3.13317 4.01782 3.11035C4.32903 3.08493 4.71068 3.08496 5.16626 3.08496H14.8333C15.2888 3.08496 15.6705 3.08494 15.9817 3.11035C16.3007 3.13642 16.6042 3.19231 16.8918 3.33887L17.052 3.42871C17.4174 3.65275 17.7147 3.97437 17.9104 4.3584L17.9612 4.4668C18.0705 4.72179 18.1171 4.9885 18.1399 5.26758C18.1653 5.57886 18.1653 5.96125 18.1653 6.41699V12.668Z"
        fill="currentColor"
      />
    </svg>
  );
}
