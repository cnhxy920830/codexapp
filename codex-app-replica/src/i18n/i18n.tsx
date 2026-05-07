import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LOCALE, MESSAGES, getMessageLocale, type LocaleCode, type MessageKey, type MessageValues } from "./messages";
import { getGlobalState, resolveLocalePreference } from "../services/settings";

type I18nContextValue = {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: MessageKey, values?: MessageValues) => string;
};

const I18N_CONTEXT = createContext<I18nContextValue | null>(null);

function formatMessage(template: string, values?: MessageValues) {
  if (!values) {
    return template;
  }

  // Support the narrow ICU plural form used by extracted upstream locale keys.
  const formattedPluralTemplate = template.replace(
    /\{(\w+),\s*plural,\s*one\s*\{([^{}]*)\}\s*other\s*\{([^{}]*)\}\s*\}/g,
    (match, token, oneVariant, otherVariant) => {
      const rawValue = values[token];
      const numericValue =
        typeof rawValue === "number" ? rawValue : typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
      if (!Number.isFinite(numericValue)) {
        return match;
      }

      const variant = numericValue === 1 ? oneVariant : otherVariant;
      return variant.replaceAll("#", String(numericValue));
    },
  );

  return formattedPluralTemplate.replace(/\{(\w+)\}/g, (match, token) => {
    const value = values[token];
    return value === undefined ? match : String(value);
  });
}

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
      t: (key, values) => formatMessage(MESSAGES[getMessageLocale(locale)][key], values),
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
