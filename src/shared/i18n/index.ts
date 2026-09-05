import type { LocaleCode, LocaleSetting } from '../types.js';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import ptBR from './locales/pt-BR.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zhCN from './locales/zh-CN.json';

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, string>;

export const MESSAGES: Record<LocaleCode, Messages> = {
  en,
  de,
  fr,
  es,
  it,
  'pt-BR': ptBR,
  nl,
  pl,
  ru,
  tr,
  ja,
  'zh-CN': zhCN,
};

/** Endonyms — a language picker should read in the language it offers. */
export const LOCALE_NAMES: Record<LocaleCode, string> = {
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  'pt-BR': 'Português (BR)',
  nl: 'Nederlands',
  pl: 'Polski',
  ru: 'Русский',
  tr: 'Türkçe',
  ja: '日本語',
  'zh-CN': '简体中文',
};

export const SUPPORTED_LOCALES = Object.keys(MESSAGES) as LocaleCode[];

export const FALLBACK_LOCALE: LocaleCode = 'en';

/**
 * Map an OS locale (`de-AT`, `pt_BR`, `zh-Hans-CN`, …) onto a supported one.
 * Exact match wins, then the base language, then English.
 */
export function resolveLocale(setting: LocaleSetting, systemLocale: string): LocaleCode {
  if (setting !== 'system') {
    return SUPPORTED_LOCALES.includes(setting) ? setting : FALLBACK_LOCALE;
  }
  const normalized = systemLocale.replace('_', '-');
  const exact = SUPPORTED_LOCALES.find((code) => code.toLowerCase() === normalized.toLowerCase());
  if (exact) return exact;

  const base = normalized.split('-')[0]?.toLowerCase() ?? '';
  if (base === 'pt') return 'pt-BR';
  if (base === 'zh') return 'zh-CN';
  const byBase = SUPPORTED_LOCALES.find((code) => code.toLowerCase() === base);
  return byBase ?? FALLBACK_LOCALE;
}

export type TranslateVars = Record<string, string | number>;

/** Replace `{name}` placeholders. Unknown placeholders are left untouched so they surface in review. */
export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export type Translator = (key: MessageKey, vars?: TranslateVars) => string;

export function createTranslator(locale: LocaleCode): Translator {
  const primary = MESSAGES[locale] ?? MESSAGES[FALLBACK_LOCALE];
  const fallback = MESSAGES[FALLBACK_LOCALE];
  return (key, vars) => interpolate(primary[key] ?? fallback[key] ?? key, vars);
}
