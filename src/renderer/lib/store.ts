import { createTranslator, resolveLocale, type Translator } from '@shared/i18n/index.js';
import type { AppSettings, EnvironmentInfo, LocaleCode } from '@shared/types.js';

type Listener = () => void;

const listeners = new Set<Listener>();

let settings: AppSettings;
let environment: EnvironmentInfo;
let locale: LocaleCode;
let translator: Translator;

/** Reflect language and accent on the root element so CSS and screen readers follow. */
function applyToDocument(): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dataset['accent'] = settings.accent;
  root.dataset['platform'] = environment.platform;
}

function recompute(next: AppSettings): void {
  settings = next;
  locale = resolveLocale(settings.locale, environment.systemLocale);
  translator = createTranslator(locale);
  applyToDocument();
}

export async function initStore(): Promise<void> {
  const [loadedSettings, loadedEnv] = await Promise.all([
    window.keyboardLock.getSettings(),
    window.keyboardLock.getEnvironment(),
  ]);
  environment = loadedEnv;
  recompute(loadedSettings);

  // Another window may change settings; keep every renderer in step.
  window.keyboardLock.onSettingsChanged((next) => {
    recompute(next);
    emit();
  });
}

export function getSettings(): AppSettings {
  return settings;
}

export function getEnvironment(): EnvironmentInfo {
  return environment;
}

export function getLocale(): LocaleCode {
  return locale;
}

export function t(): Translator {
  return translator;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
  recompute(await window.keyboardLock.setSettings(patch));
  emit();
}

export async function resetSettings(): Promise<void> {
  recompute(await window.keyboardLock.resetSettings());
  emit();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(): void {
  for (const listener of listeners) listener();
}
