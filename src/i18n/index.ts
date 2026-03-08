import { en, type TranslationKey } from "./en";
import { cn } from "./cn";
import { getSetting } from "../db";

type Lang = "EN" | "CN";

const translations: Record<Lang, Record<string, string>> = { EN: en, CN: cn };

let cachedLang: Lang | null = null;

export function getLang(): Lang {
  if (cachedLang) return cachedLang;
  const stored = getSetting("setup_lang");
  cachedLang = (stored === "CN" ? "CN" : "EN") as Lang;
  return cachedLang;
}

export function setLangCache(lang: Lang): void {
  cachedLang = lang;
}

export function t(key: TranslationKey, values?: Record<string, string | number>): string {
  const lang = getLang();
  let text = translations[lang][key] ?? translations.EN[key] ?? key;
  if (values) {
    for (const [k, v] of Object.entries(values)) {
      text = text.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return text;
}

export type { TranslationKey };
