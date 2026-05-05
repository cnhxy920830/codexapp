import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, MESSAGES, getMessageLocale, type LocaleCode, type MessageKey } from "./messages";
import { getGlobalState, resolveLocalePreference } from "../services/settings";

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: MessageKey) => string;
};

const I18N_CONTEXT = createContext<I18nContextValue | null>(null);
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  useEffect(() => {
    let cancelled = false;

    void getGlobalState("localeOverride")
      .then((response) => {
        if (cancelled) {
          return;
        }
        setLocaleState(resolveLocalePreference(response.value));
      })
      .catch(() => {
        if (!cancelled) {
          setLocaleState(DEFAULT_LOCALE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        setLocaleState(nextLocale);
      },
      t: (key) => MESSAGES[getMessageLocale(locale)][key],
    }),
    [locale],
  );

  return <I18N_CONTEXT.Provider value={value}>{children}</I18N_CONTEXT.Provider>;
}

export function useI18n() {
  const context = useContext(I18N_CONTEXT);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
