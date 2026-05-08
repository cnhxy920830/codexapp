import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useI18n } from "../../i18n/i18n";
import {
  canDecodeAppearanceThemeShare,
  DEFAULT_CODE_FONT_STACK,
  DEFAULT_UI_FONT_STACK,
  encodeAppearanceThemeShare,
  type AppearanceChromeTheme,
  type AppearanceChromeThemePatch,
  type AppearanceCodeThemeId,
  type AppearanceThemeFonts,
  type AppearanceVariant,
} from "../../services/appearanceThemes";
import { ToggleSwitch } from "../ToggleSwitch";
import { ChromeThemeColorInput } from "./ChromeThemeColorInput";
import { CodeThemePicker } from "./CodeThemePicker";

export function ThemeEditorCard({
  codeThemeId,
  disabled,
  theme,
  variant,
  onCodeThemeChange,
  onCopyTheme,
  onFontsPatchChange,
  onImportTheme,
  onThemePatchChange,
}: {
  codeThemeId: AppearanceCodeThemeId;
  disabled: boolean;
  theme: AppearanceChromeTheme;
  variant: AppearanceVariant;
  onCodeThemeChange: (value: AppearanceCodeThemeId) => void;
  onCopyTheme: () => Promise<void>;
  onFontsPatchChange: (patch: Partial<AppearanceThemeFonts>) => void;
  onImportTheme: (value: string) => Promise<void>;
  onThemePatchChange: (patch: AppearanceChromeThemePatch) => void;
}) {
  const { t } = useI18n();
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const variantLabel = variant === "light" ? t("settings.general.appearance.theme.light") : t("settings.general.appearance.theme.dark");

  useEffect(() => {
    if (!isImportDialogOpen) {
      setImportValue("");
    }
  }, [isImportDialogOpen]);

  const exportThemeString = useMemo(
    () =>
      encodeAppearanceThemeShare({
        codeThemeId,
        theme,
        variant,
      }),
    [codeThemeId, theme, variant],
  );
  const isImportValueValid = importValue.trim().length > 0 && canDecodeAppearanceThemeShare(importValue, variant);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-token-border bg-token-input-background shadow-sm">
        <div className="flex items-center justify-between gap-2 px-4 py-2 max-sm:flex-col max-sm:items-stretch">
          <div className="min-w-0">
            <div className="text-base font-medium text-token-text-secondary">
              {variant === "light"
                ? t("settings.general.appearance.lightChromeTheme")
                : t("settings.general.appearance.darkChromeTheme")}
            </div>
          </div>

          <div className="flex items-center gap-2 max-sm:w-full max-sm:flex-wrap max-sm:justify-end">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setIsImportDialogOpen(true)}
              className="app-control-weak rounded-[10px] px-2.5 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("settings.general.appearance.chromeTheme.import")}
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => void onCopyTheme()}
              className="app-control-weak rounded-[10px] px-2.5 py-1.5 text-[12px] disabled:opacity-60"
            >
              {t("settings.general.appearance.chromeTheme.export")}
            </button>
            <CodeThemePicker
              ariaLabel={t("settings.general.appearance.codeTheme", { variant: variantLabel })}
              disabled={disabled}
              theme={theme}
              value={codeThemeId}
              variant={variant}
              onChange={onCodeThemeChange}
            />
          </div>
        </div>

        <div className="divide-y divide-[var(--app-shell-border)]">
          <EditorRow label={t("settings.general.appearance.chromeTheme.accent.short")}>
            <ChromeThemeColorInput
              ariaLabel={t("settings.general.appearance.chromeTheme.accent", { variant: variantLabel })}
              disabled={disabled}
              value={theme.accent}
              onChange={(value) => onThemePatchChange({ accent: value })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.surface.short")}>
            <ChromeThemeColorInput
              ariaLabel={t("settings.general.appearance.chromeTheme.surface", { variant: variantLabel })}
              disabled={disabled}
              value={theme.surface}
              onChange={(value) => onThemePatchChange({ surface: value })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.ink.short")}>
            <ChromeThemeColorInput
              ariaLabel={t("settings.general.appearance.chromeTheme.ink", { variant: variantLabel })}
              disabled={disabled}
              value={theme.ink}
              onChange={(value) => onThemePatchChange({ ink: value })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.uiFontFamily.short")}>
            <FontFamilyInput
              ariaLabel={t("settings.general.appearance.chromeTheme.uiFontFamily", { variant: variantLabel })}
              disabled={disabled}
              placeholder={DEFAULT_UI_FONT_STACK}
              value={theme.fonts.ui}
              onChange={(value) => onFontsPatchChange({ ui: value })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.codeFontFamily.short")}>
            <FontFamilyInput
              ariaLabel={t("settings.general.appearance.chromeTheme.codeFontFamily", { variant: variantLabel })}
              disabled={disabled}
              placeholder={DEFAULT_CODE_FONT_STACK}
              value={theme.fonts.code}
              onChange={(value) => onFontsPatchChange({ code: value })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.translucentSidebar.short")}>
            <ToggleSwitch
              ariaLabel={t("settings.general.appearance.chromeTheme.translucentSidebar", { variant: variantLabel })}
              checked={!theme.opaqueWindows}
              disabled={disabled}
              onChange={(checked) => onThemePatchChange({ opaqueWindows: !checked })}
            />
          </EditorRow>

          <EditorRow label={t("settings.general.appearance.chromeTheme.contrast.short")}>
            <ContrastSlider
              ariaLabel={t("settings.general.appearance.chromeTheme.contrast", { variant: variantLabel })}
              disabled={disabled}
              theme={theme}
              value={theme.contrast}
              onChange={(value) => onThemePatchChange({ contrast: value })}
            />
          </EditorRow>
        </div>
      </div>

      <ThemeImportDialog
        exampleValue={exportThemeString}
        isDisabled={disabled}
        isOpen={isImportDialogOpen}
        isSubmitEnabled={isImportValueValid}
        value={importValue}
        variantLabel={variantLabel}
        onClose={() => setIsImportDialogOpen(false)}
        onSubmit={async () => {
          await onImportTheme(importValue.trim());
          setIsImportDialogOpen(false);
        }}
        onValueChange={setImportValue}
      />
    </>
  );
}

function EditorRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-10 items-center justify-between gap-3 px-4 py-0.5 max-sm:min-h-0 max-sm:flex-col max-sm:items-stretch">
      <div className="text-sm text-token-text-primary">{label}</div>
      <div className="max-sm:w-full">{children}</div>
    </div>
  );
}

function FontFamilyInput({
  ariaLabel,
  disabled,
  placeholder,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    const nextValue = trimmed.length > 0 ? trimmed : null;
    setDraft(nextValue ?? "");
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <input
      aria-label={ariaLabel}
      className="focus-visible:ring-token-focus h-7 w-full max-w-[8.5rem] rounded-lg border border-token-border bg-token-input-background px-2 text-xs text-token-text-primary shadow-sm outline-none focus-visible:ring-2 max-sm:max-w-none"
      disabled={disabled}
      placeholder={placeholder}
      spellCheck={false}
      type="text"
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        commit();
      }}
    />
  );
}

function ContrastSlider({
  ariaLabel,
  disabled,
  theme,
  value,
  onChange,
}: {
  ariaLabel: string;
  disabled: boolean;
  theme: AppearanceChromeTheme;
  value: number;
  onChange: (value: number) => void;
}) {
  const background = `linear-gradient(90deg, color-mix(in srgb, ${theme.accent} 35%, ${theme.surface}) 0%, ${theme.accent} 32%, ${theme.accent} 100%)`;

  return (
    <div className="flex h-9 min-w-[12rem] items-center gap-2.5 max-sm:w-full max-sm:min-w-0">
      <input
        aria-label={ariaLabel}
        className="h-0.5 flex-1 appearance-none rounded-full [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-transparent [&::-moz-range-thumb]:bg-current [&::-moz-range-thumb]:shadow-sm [&::-moz-range-track]:h-0.5 [&::-moz-range-track]:rounded-full [&::-webkit-slider-runnable-track]:h-0.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:mt-[-9px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-transparent [&::-webkit-slider-thumb]:bg-current [&::-webkit-slider-thumb]:shadow-sm"
        disabled={disabled}
        max={100}
        min={0}
        step={1}
        style={{
          background,
          color: "var(--app-shell-control-text)",
        }}
        type="range"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="w-9 text-right text-[13px] tabular-nums">{value}</span>
    </div>
  );
}

function ThemeImportDialog({
  exampleValue,
  isDisabled,
  isOpen,
  isSubmitEnabled,
  value,
  variantLabel,
  onClose,
  onSubmit,
  onValueChange,
}: {
  exampleValue: string;
  isDisabled: boolean;
  isOpen: boolean;
  isSubmitEnabled: boolean;
  value: string;
  variantLabel: string;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onValueChange: (value: string) => void;
}) {
  const { t } = useI18n();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(0,0,0,0.24)] px-4">
      <div className="w-full max-w-[480px] rounded-[18px] border border-token-border bg-token-main-surface-primary px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.22)]">
        <div className="text-base font-medium text-token-text-primary">
          {t("settings.general.appearance.chromeTheme.import.dialog.title")}
        </div>
        <input
          aria-label={t("settings.general.appearance.chromeTheme.import.dialog.ariaLabel", {
            variant: variantLabel,
          })}
          autoFocus
          className="focus-visible:ring-token-focus mt-4 h-9 w-full rounded-xl border border-token-input-border bg-token-input-background px-3 font-mono text-sm text-token-input-foreground outline-none placeholder:text-token-input-placeholder-foreground focus-visible:ring-2"
          disabled={isDisabled}
          placeholder={exampleValue}
          spellCheck={false}
          type="text"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px]"
          >
            {t("settings.general.appearance.chromeTheme.import.dialog.cancel")}
          </button>
          <button
            type="button"
            disabled={isDisabled || !isSubmitEnabled}
            onClick={() => void onSubmit()}
            className="app-control rounded-[11px] px-3 py-1.5 text-[12px] disabled:opacity-60"
          >
            {t("settings.general.appearance.chromeTheme.import.dialog.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
