import { useEffect, useState, type ReactNode } from "react";
import {
  applyGeneralSettingsSnapshot,
  DEFAULT_GENERAL_SETTINGS,
  readGeneralSettingsSnapshot,
  resolveLocalePreference,
  setGlobalState,
  type GeneralSettingsSnapshot,
  type GlobalStateKey,
} from "../services/settings";
import { useI18n } from "../i18n/i18n";
import { SUPPORTED_LOCALES, getLocaleLabel, type LocaleCode } from "../i18n/messages";

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
          <Row label={t("general.language")}>
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
          </Row>
          <Row label={t("general.usePointerCursors")}>
            <input
              type="checkbox"
              checked={state.usePointerCursors}
              disabled={isLoading || isSaving}
              onChange={(event) => void persistBoolean("usePointerCursors", event.target.checked)}
            />
          </Row>
          <Row label={t("general.uiFontSize")}>
            <NumberInput
              value={state.uiFontSize}
              disabled={isLoading || isSaving}
              min={11}
              max={16}
              onCommit={(value) => void persistNumber("uiFontSize", "sansFontSize", value)}
            />
          </Row>
          <Row label={t("general.codeFontSize")}>
            <NumberInput
              value={state.codeFontSize}
              disabled={isLoading || isSaving}
              min={8}
              max={24}
              onCommit={(value) => void persistNumber("codeFontSize", "codeFontSize", value)}
            />
          </Row>
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4">
      <span>{label}</span>
      {children}
    </label>
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
