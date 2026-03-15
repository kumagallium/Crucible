"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import ja from "./ja.json";
import en from "./en.json";

export type Locale = "ja" | "en";

const messages: Record<Locale, Record<string, unknown>> = { ja, en };

type I18nContextType = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextType | null>(null);

function getNestedValue(obj: unknown, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return path;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : path;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("crucible-locale") as Locale | null;
      if (saved && (saved === "ja" || saved === "en")) return saved;
    }
    return "ja";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    if (typeof window !== "undefined") {
      localStorage.setItem("crucible-locale", newLocale);
      document.documentElement.lang = newLocale;
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => {
      let value = getNestedValue(messages[locale], key);
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, v);
        }
      }
      return value;
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
