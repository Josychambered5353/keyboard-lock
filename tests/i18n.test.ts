import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MessageKey } from '@shared/i18n/index.js';
import {
  FALLBACK_LOCALE,
  LOCALE_NAMES,
  MESSAGES,
  SUPPORTED_LOCALES,
  createTranslator,
  interpolate,
  resolveLocale,
} from '@shared/i18n/index.js';
import { formatDurationWords } from '@shared/format.js';

const englishKeys = Object.keys(MESSAGES[FALLBACK_LOCALE]) as MessageKey[];

describe('translation catalogues', () => {
  it.each(SUPPORTED_LOCALES)('%s has exactly the English key set', (locale) => {
    expect(Object.keys(MESSAGES[locale]).sort()).toEqual([...englishKeys].sort());
  });

  it.each(SUPPORTED_LOCALES)('%s keeps every placeholder of the English string', (locale) => {
    const placeholders = (value: string) => (value.match(/\{\w+\}/g) ?? []).sort();
    for (const key of englishKeys) {
      const source = MESSAGES[FALLBACK_LOCALE][key];
      const translated = MESSAGES[locale][key];
      expect(placeholders(translated), `${locale}: ${key}`).toEqual(placeholders(source));
    }
  });

  it.each(SUPPORTED_LOCALES)('%s has no blank strings', (locale) => {
    for (const key of englishKeys) {
      expect(MESSAGES[locale][key].trim().length, `${locale}: ${key}`).toBeGreaterThan(0);
    }
  });

  it('ships a locale file for every supported code and nothing more', () => {
    const dir = join(import.meta.dirname, '../src/shared/i18n/locales');
    const onDisk = readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''))
      .sort();
    expect(onDisk).toEqual([...SUPPORTED_LOCALES].sort());
  });

  it('names every locale in the picker', () => {
    expect(Object.keys(LOCALE_NAMES).sort()).toEqual([...SUPPORTED_LOCALES].sort());
  });
});

describe('resolveLocale', () => {
  it('honours an explicit choice', () => {
    expect(resolveLocale('ja', 'de-DE')).toBe('ja');
  });

  it('falls back to English for an unknown explicit choice', () => {
    expect(resolveLocale('kl-GL' as never, 'de-DE')).toBe('en');
  });

  it('follows the system locale, region included', () => {
    expect(resolveLocale('system', 'de-AT')).toBe('de');
    expect(resolveLocale('system', 'fr_CA')).toBe('fr');
    expect(resolveLocale('system', 'zh-CN')).toBe('zh-CN');
  });

  it('maps regional variants of split languages onto the shipped one', () => {
    expect(resolveLocale('system', 'pt-PT')).toBe('pt-BR');
    expect(resolveLocale('system', 'zh-Hans-SG')).toBe('zh-CN');
  });

  it('falls back to English for an unsupported system locale', () => {
    expect(resolveLocale('system', 'sv-SE')).toBe('en');
    expect(resolveLocale('system', '')).toBe('en');
  });
});

describe('interpolate', () => {
  it('substitutes known placeholders and leaves unknown ones visible', () => {
    expect(interpolate('in {duration}', { duration: '5 min' })).toBe('in 5 min');
    expect(interpolate('in {duration}', {})).toBe('in {duration}');
  });
});

describe('formatDurationWords', () => {
  const t = createTranslator('en');

  it('drops the empty half of the duration', () => {
    expect(formatDurationWords(30_000, t)).toBe('30 s');
    expect(formatDurationWords(300_000, t)).toBe('5 min');
    expect(formatDurationWords(90_000, t)).toBe('1 min 30 s');
  });
});
