import { useEffect, useState, type ReactNode } from "react";
import {
  applyGeneralSettingsSnapshot,
  DEFAULT_GENERAL_SETTINGS,
  type FollowUpQueueMode,
  readGeneralSettingsSnapshot,
  resolveLocalePreference,
  type ReviewDelivery,
  setGlobalState,
  type GeneralSettingsSnapshot,
  type GlobalStateKey,
} from "../services/settings";
import { useI18n } from "../i18n/i18n";
import { SUPPORTED_LOCALES, getLocaleLabel, type LocaleCode } from "../i18n/messages";

const INVERT_FOLLOW_UP_SHORTCUT_LABEL = "Ctrl+Enter";

export function GeneralSettings() {
  const { locale, setLocale, t } = useI18n();
  const [state, setState] = useState<GeneralSettingsSnapshot>(DEFAULT_GENERAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const snapshot = await readGeneralSettingsSnapshot();
        if (cancelled) {
          return;
        }
        setState(snapshot);
        setError(null);
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

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyGeneralSettingsSnapshot(state);
  }, [state]);

  const persistBoolean = async (key: GlobalStateKey, value: boolean) => {
    const previousState = state;
    setState((current) => ({ ...current, usePointerCursors: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistNumber = async (field: "uiFontSize" | "codeFontSize", key: GlobalStateKey, value: number) => {
    const previousState = state;
    setState((current) => ({ ...current, [field]: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistChoice = async (
    field: "followUpQueueMode" | "reviewDelivery",
    key: GlobalStateKey,
    value: FollowUpQueueMode | ReviewDelivery,
  ) => {
    const previousState = state;
    setState((current) => ({ ...current, [field]: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const persistLocale = async (value: string) => {
    const nextValue = value === "auto" ? null : value;
    const previousState = state;
    setState((current) => ({ ...current, localeOverride: nextValue }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState("localeOverride", nextValue);
      setLocale(resolveLocalePreference(nextValue));
    } catch (err) {
      setState(previousState);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
        <div className="text-[14px] font-medium text-[#29251f]">{t("general.title")}</div>
      </div>
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
        <div className="text-[12px] uppercase tracking-[0.16em] text-[var(--app-shell-subtle)]">{t("general.appearance")}</div>
        <div className="mt-4 space-y-4 text-[14px]">
          <SettingRow label={t("general.language")} description={t("general.languageDescription")}>
            <select
              value={state.localeOverride ?? "auto"}
              disabled={isLoading || isSaving}
              onChange={(event) => void persistLocale(event.target.value)}
              className="rounded-[10px] border border-black/8 bg-white px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:text-[#a29a91]"
            >
              {SUPPORTED_LOCALES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry === "auto"
                    ? t("general.languageAuto")
                    : entry === "en-US"
                      ? t("general.languageEnglish")
                      : entry === "zh-CN"
                      ? t("general.languageChineseSimplified")
                      : getLocaleLabel(entry, locale)}
                </option>
              ))}
            </select>
          </SettingRow>
          <SettingRow label={t("general.usePointerCursors")} description={t("general.usePointerCursorsDescription")}>
            <input
              type="checkbox"
              checked={state.usePointerCursors}
              disabled={isLoading || isSaving}
              onChange={(event) => void persistBoolean("usePointerCursors", event.target.checked)}
            />
          </SettingRow>
          <SettingRow label={t("general.uiFontSize")} description={t("general.uiFontSizeDescription")}>
            <NumberInput
              value={state.uiFontSize}
              disabled={isLoading || isSaving}
              min={11}
              max={16}
              onCommit={(value) => void persistNumber("uiFontSize", "sansFontSize", value)}
            />
          </SettingRow>
          <SettingRow label={t("general.codeFontSize")} description={t("general.codeFontSizeDescription")}>
            <NumberInput
              value={state.codeFontSize}
              disabled={isLoading || isSaving}
              min={8}
              max={24}
              onCommit={(value) => void persistNumber("codeFontSize", "codeFontSize", value)}
            />
          </SettingRow>
        </div>
      </div>
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow
            label={t("general.followUpBehavior")}
            description={t("general.followUpBehaviorDescription", {
              invertFollowUpShortcutLabel: INVERT_FOLLOW_UP_SHORTCUT_LABEL,
            })}
          >
            <SegmentedControl
              value={state.followUpQueueMode}
              disabled={isLoading || isSaving}
              options={[
                { value: "queue", label: t("general.followUpQueue") },
                { value: "steer", label: t("general.followUpSteer") },
              ]}
              onChange={(value) =>
                void persistChoice("followUpQueueMode", "followUpQueueMode", value as FollowUpQueueMode)
              }
            />
          </SettingRow>
          <SettingRow label={t("general.reviewDelivery")} description={t("general.reviewDeliveryDescription")}>
            <SegmentedControl
              value={state.reviewDelivery}
              disabled={isLoading || isSaving}
              options={[
                { value: "inline", label: t("general.reviewInline") },
                { value: "detached", label: t("general.reviewDetached") },
              ]}
              onChange={(value) => void persistChoice("reviewDelivery", "reviewDelivery", value as ReviewDelivery)}
            />
          </SettingRow>
        </div>
      </div>
      {error ? (
        <div className="rounded-[18px] border border-[#d5b6b0] bg-[#fff3f1] px-5 py-4 text-[13px] text-[#9e5348]">
          {error}
        </div>
      ) : null}
      <div className="rounded-[18px] border border-[var(--app-shell-border)] bg-white/92 px-5 py-4 text-[12px] text-[#7f766d]">
        {isLoading ? t("general.loading") : isSaving ? t("general.saving") : t("general.loaded")}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div>{label}</div>
        {description ? <div className="mt-1 text-[12px] leading-5 text-[#7f766d]">{description}</div> : null}
      </div>
      {children}
    </div>
  );
}

function SegmentedControl({
  disabled,
  onChange,
  options,
  value,
}: {
  disabled: boolean;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  value: string;
}) {
  return (
    <div className="inline-flex rounded-[12px] border border-black/8 bg-white p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition disabled:cursor-not-allowed disabled:text-[#a29a91]",
            option.value === value ? "bg-[#ecebea] text-[#302b25]" : "text-[#6a6259] hover:bg-[#f5f3f0]",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NumberInput({
  disabled,
  max,
  min,
  onCommit,
  value,
}: {
  disabled: boolean;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  value: number;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <input
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
      className="w-20 rounded-[10px] border border-black/8 bg-white px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:text-[#a29a91]"
    />
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
