import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  type ComposerEnterBehavior,
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
import { CheckIcon, ChevronDownIcon } from "./AppShellIcons";
import { ToggleSwitch } from "./ToggleSwitch";

const INVERT_FOLLOW_UP_SHORTCUT_LABEL = "Ctrl+Enter";
const COMPOSER_MODIFIER_SYMBOL = "Ctrl";

export function GeneralSettings({
  onComposerEnterBehaviorChange,
  onFollowUpQueueModeChange,
  onReviewDeliveryChange,
}: {
  onComposerEnterBehaviorChange?: (value: ComposerEnterBehavior) => void;
  onFollowUpQueueModeChange?: (value: FollowUpQueueMode) => void;
  onReviewDeliveryChange?: (value: ReviewDelivery) => void;
}) {
  const { locale, setLocale, t } = useI18n();
  const [state, setState] = useState<GeneralSettingsSnapshot>(DEFAULT_GENERAL_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [languageSearch, setLanguageSearch] = useState("");
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

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
    if (!isLanguageMenuOpen) {
      setLanguageSearch("");
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (languageMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setIsLanguageMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isLanguageMenuOpen]);

  const persistChoice = async (
    field: "composerEnterBehavior" | "followUpQueueMode" | "reviewDelivery",
    key: GlobalStateKey,
    value: ComposerEnterBehavior | FollowUpQueueMode | ReviewDelivery,
  ) => {
    const previousState = state;
    setState((current) => ({ ...current, [field]: value }));
    setError(null);
    setIsSaving(true);
    try {
      await setGlobalState(key, value);
      if (field === "composerEnterBehavior") {
        onComposerEnterBehaviorChange?.(value as ComposerEnterBehavior);
      }
      if (field === "followUpQueueMode") {
        onFollowUpQueueModeChange?.(value as FollowUpQueueMode);
      }
      if (field === "reviewDelivery") {
        onReviewDeliveryChange?.(value as ReviewDelivery);
      }
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

  const localeEntries = SUPPORTED_LOCALES.filter((entry): entry is LocaleCode => entry !== "auto").map((entry) => {
    const nativeLabel = getLocaleLabel(entry, entry);
    const localizedLabel = getLocaleLabel(entry, locale);
    const searchText = `${nativeLabel} ${localizedLabel} ${entry}`.toLowerCase();
    return {
      code: entry,
      nativeLabel,
      localizedLabel,
      searchText,
    };
  });

  const selectedLocaleLabel =
    state.localeOverride == null
      ? t("settings.ide.language.auto")
      : localeEntries.find((entry) => entry.code === state.localeOverride)?.nativeLabel ?? state.localeOverride;

  const normalizedLanguageSearch = languageSearch.trim().toLowerCase();
  const filteredLocaleEntries =
    normalizedLanguageSearch.length === 0
      ? localeEntries
      : localeEntries.filter((entry) => entry.searchText.includes(normalizedLanguageSearch));

  return (
    <div className="mx-auto flex max-w-[820px] flex-col gap-4 px-5 py-5">
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="app-title text-[14px] font-medium">{t("settings.section.general-settings")}</div>
      </div>
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow label={t("settings.ide.language.label")} description={t("settings.ide.language.description")}>
            <div className="relative w-[320px] max-w-full" ref={languageMenuRef}>
              <button
                type="button"
                disabled={isLoading || isSaving}
                onClick={() => setIsLanguageMenuOpen((open) => !open)}
                className="app-control flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px]"
              >
                <span className="truncate text-left">{selectedLocaleLabel}</span>
                <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
              </button>
              {isLanguageMenuOpen ? (
                <div className="app-card absolute top-[calc(100%+8px)] right-0 z-20 w-full rounded-[14px] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
                  <div className="pb-1">
                    <input
                      type="text"
                      value={languageSearch}
                      autoFocus
                      onChange={(event) => setLanguageSearch(event.target.value)}
                      placeholder={t("settings.ide.language.search")}
                      className="app-control w-full rounded-[10px] px-3 py-2 text-[13px]"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => {
                      setIsLanguageMenuOpen(false);
                      void persistLocale("auto");
                    }}
                    className={[
                      "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                      state.localeOverride == null ? "app-nav-item-active" : "app-nav-item-idle",
                    ].join(" ")}
                  >
                    <span>{t("settings.ide.language.autoOption")}</span>
                    {state.localeOverride == null ? (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                    ) : null}
                  </button>
                  <div className="mt-1 max-h-80 overflow-y-auto">
                    {filteredLocaleEntries.map((entry) => {
                      const isSelected = entry.code === state.localeOverride;
                      return (
                        <button
                          key={entry.code}
                          type="button"
                          disabled={isSaving}
                          onClick={() => {
                            setIsLanguageMenuOpen(false);
                            void persistLocale(entry.code);
                          }}
                          className={[
                            "flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left text-[13px]",
                            isSelected ? "app-nav-item-active" : "app-nav-item-idle",
                          ].join(" ")}
                        >
                          <span className="truncate">
                            {entry.nativeLabel}
                            {entry.localizedLabel === entry.nativeLabel ? "" : ` • ${entry.localizedLabel}`}
                          </span>
                          {isSelected ? (
                            <CheckIcon className="h-3.5 w-3.5 shrink-0 text-token-text-secondary" />
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </SettingRow>
          <SettingRow
            label={t("settings.general.enterBehavior.label", { modifierSymbol: COMPOSER_MODIFIER_SYMBOL })}
            description={t("settings.general.enterBehavior.description", { modifierSymbol: COMPOSER_MODIFIER_SYMBOL })}
          >
            <ToggleSwitch
              checked={state.composerEnterBehavior === "cmdIfMultiline"}
              disabled={isLoading || isSaving}
              ariaLabel={t("settings.general.enterBehavior.label", { modifierSymbol: COMPOSER_MODIFIER_SYMBOL })}
              onChange={(checked) =>
                void persistChoice(
                  "composerEnterBehavior",
                  "composerEnterBehavior",
                  checked ? "cmdIfMultiline" : "enter",
                )
              }
            />
          </SettingRow>
        </div>
      </div>
      <div className="app-card rounded-[18px] px-5 py-4">
        <div className="space-y-4 text-[14px]">
          <SettingRow
            label={t("settings.general.followUpQueueMode.label")}
            description={t("settings.general.followUpQueueMode.description", {
              invertFollowUpShortcutLabel: INVERT_FOLLOW_UP_SHORTCUT_LABEL,
            })}
          >
            <SegmentedControl
              value={state.followUpQueueMode}
              disabled={isLoading || isSaving}
              options={[
                { value: "queue", label: t("settings.general.followUpQueueMode.queue") },
                { value: "steer", label: t("settings.general.followUpQueueMode.interrupt") },
              ]}
              onChange={(value) =>
                void persistChoice("followUpQueueMode", "followUpQueueMode", value as FollowUpQueueMode)
              }
            />
          </SettingRow>
          <SettingRow
            label={t("settings.general.reviewDelivery.label")}
            description={t("settings.general.reviewDelivery.description")}
          >
            <SegmentedControl
              value={state.reviewDelivery}
              disabled={isLoading || isSaving}
              options={[
                { value: "inline", label: t("settings.general.reviewDelivery.inline") },
                { value: "detached", label: t("settings.general.reviewDelivery.detached") },
              ]}
              onChange={(value) => void persistChoice("reviewDelivery", "reviewDelivery", value as ReviewDelivery)}
            />
          </SettingRow>
        </div>
      </div>
      {error ? (
        <div className="app-card-error rounded-[18px] px-5 py-4 text-[13px]">
          {error}
        </div>
      ) : null}
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
        {description ? <div className="app-text-muted mt-1 text-[12px] leading-5">{description}</div> : null}
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
    <div className="app-segmented inline-flex rounded-[12px] p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={[
            "rounded-[9px] px-3 py-1.5 text-[13px] transition",
            option.value === value ? "app-segmented-option-active" : "app-segmented-option-idle",
          ].join(" ")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
