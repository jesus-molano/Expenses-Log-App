import type { AppLanguage } from "@/domain/types";
import { messages } from "./i18n-messages";

export { messages };

export const DEFAULT_LANGUAGE: AppLanguage = "es";

export function normalizeAppLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : DEFAULT_LANGUAGE;
}

type MessagePath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string
        ? K
        : `${K}.${MessagePath<T[K]>}`;
    }[keyof T & string];

export type TranslationKey = MessagePath<(typeof messages)["es"]>;

export function t(key: TranslationKey, language = readActiveLanguage()): string {
  const dictionary = messages[language ?? DEFAULT_LANGUAGE];
  const value = key
    .split(".")
    .reduce<unknown>((node, part) => {
      if (!node || typeof node !== "object") return undefined;
      return (node as Record<string, unknown>)[part];
    }, dictionary);

  return typeof value === "string" ? value : key;
}

// Mensaje con huecos ("{month}", "{count}"…). Un hueco sin valor se deja tal
// cual para que se vea en lugar de desaparecer en silencio.
export function formatMessage(
  key: TranslationKey,
  values: Record<string, string | number>,
  language = readActiveLanguage(),
): string {
  return t(key, language).replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}

export function persistLanguagePreference(language: AppLanguage) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language;
  document.cookie = `expense-language=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function readLanguageCookie(): AppLanguage | null {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith("expense-language="))
    ?.split("=")[1];

  return isAppLanguage(value) ? value : null;
}

export function readActiveLanguage(): AppLanguage {
  if (typeof document !== "undefined" && isAppLanguage(document.documentElement.lang)) {
    return document.documentElement.lang;
  }

  return readLanguageCookie() ?? DEFAULT_LANGUAGE;
}

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "es" || value === "en";
}

