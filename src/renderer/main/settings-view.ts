import {
  acceleratorFromEvent,
  formatAcceleratorForDisplay,
  isUsableUnlockShortcut,
} from '@shared/accelerator.js';
import { formatDurationWords } from '@shared/format.js';
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@shared/i18n/index.js';
import type { AccentId, LocaleSetting } from '@shared/types.js';
import { el, setToggle } from '../lib/dom.js';
import { getEnvironment, getSettings, resetSettings, t, updateSettings } from '../lib/store.js';

const ACCENTS: { id: AccentId; color: string }[] = [
  { id: 'indigo', color: '#6c8cff' },
  { id: 'teal', color: '#2dd4bf' },
  { id: 'violet', color: '#a78bfa' },
  { id: 'amber', color: '#fbbf5c' },
  { id: 'rose', color: '#fb7185' },
];

/** Thresholds offered for the "think twice" prompt, in milliseconds. `0` disables it. */
const CONFIRM_OPTIONS_MS = [0, 120_000, 300_000, 600_000, 900_000];

type ShortcutError = 'invalid' | 'taken' | null;

export function setupSettingsView(): { render: () => void } {
  const localeSelect = el<HTMLSelectElement>('setting-locale');
  const accentGroup = el('setting-accent');
  const shortcutButton = el<HTMLButtonElement>('setting-shortcut');
  const shortcutHint = el('shortcut-hint');
  const mouseUnlockSwitch = el('setting-mouse-unlock');
  const mouseUnlockHint = el('mouse-unlock-hint');
  const confirmSelect = el<HTMLSelectElement>('setting-confirm');
  const blockShortcutsSwitch = el('setting-block-shortcuts');
  const keepAwakeSwitch = el('setting-keep-awake');
  const soundSwitch = el('setting-sound');
  const resetButton = el<HTMLButtonElement>('setting-reset');
  const versionLabel = el('version-label');
  const sourceLink = el<HTMLAnchorElement>('source-link');

  let recording = false;
  let shortcutError: ShortcutError = null;

  for (const accent of ACCENTS) {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'swatch';
    swatch.style.background = accent.color;
    swatch.style.color = accent.color;
    swatch.dataset['accent'] = accent.id;
    swatch.addEventListener('click', () => void updateSettings({ accent: accent.id }));
    accentGroup.append(swatch);
  }

  localeSelect.addEventListener('change', () => {
    void updateSettings({ locale: localeSelect.value as LocaleSetting });
  });

  confirmSelect.addEventListener('change', () => {
    void updateSettings({ confirmThresholdMs: Number(confirmSelect.value) });
  });

  const bindSwitch = (
    node: HTMLElement,
    key: 'allowMouseUnlock' | 'blockSystemShortcuts' | 'keepDisplayAwake' | 'playSound',
  ) => {
    node.addEventListener('click', () => void updateSettings({ [key]: !getSettings()[key] }));
  };
  bindSwitch(mouseUnlockSwitch, 'allowMouseUnlock');
  bindSwitch(blockShortcutsSwitch, 'blockSystemShortcuts');
  bindSwitch(keepAwakeSwitch, 'keepDisplayAwake');
  bindSwitch(soundSwitch, 'playSound');

  resetButton.addEventListener('click', () => void resetSettings());

  sourceLink.addEventListener('click', (event) => {
    event.preventDefault();
    void window.keyboardLock.openExternal(getEnvironment().homepage);
  });

  // ---- shortcut recorder -------------------------------------------------

  const stopRecording = () => {
    recording = false;
    window.removeEventListener('keydown', onRecordKey, true);
    render();
  };

  async function commitShortcut(accelerator: string): Promise<void> {
    const platform = getEnvironment().platform;
    if (!isUsableUnlockShortcut(accelerator, platform)) {
      shortcutError = 'invalid';
      stopRecording();
      return;
    }
    const check = await window.keyboardLock.checkShortcut(accelerator);
    if (!check.available) {
      shortcutError = check.reason === 'invalid' ? 'invalid' : 'taken';
      stopRecording();
      return;
    }
    shortcutError = null;
    stopRecording();
    await updateSettings({ unlockShortcut: accelerator });
  }

  function onRecordKey(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') {
      shortcutError = null;
      stopRecording();
      return;
    }
    const accelerator = acceleratorFromEvent({
      key: event.key,
      control: event.ctrlKey,
      alt: event.altKey,
      shift: event.shiftKey,
      meta: event.metaKey,
    });
    // Modifier-only presses are the normal in-between state while a chord is
    // being pressed, so they are ignored rather than reported as an error.
    if (!accelerator) return;
    void commitShortcut(accelerator);
  }

  shortcutButton.addEventListener('click', () => {
    if (recording) {
      stopRecording();
      return;
    }
    recording = true;
    shortcutError = null;
    window.addEventListener('keydown', onRecordKey, true);
    render();
  });

  // ---- rendering ---------------------------------------------------------

  function renderLocaleOptions(): void {
    const translate = t();
    const current = getSettings().locale;
    localeSelect.replaceChildren();

    const systemOption = new Option(translate('settings.languageSystem'), 'system');
    localeSelect.append(systemOption);
    for (const code of SUPPORTED_LOCALES) {
      localeSelect.append(new Option(LOCALE_NAMES[code], code));
    }
    localeSelect.value = current;
  }

  function renderConfirmOptions(): void {
    const translate = t();
    confirmSelect.replaceChildren();
    for (const ms of CONFIRM_OPTIONS_MS) {
      const label =
        ms === 0
          ? translate('settings.confirmThresholdOff')
          : translate('settings.confirmThresholdFrom', {
              duration: formatDurationWords(ms, translate),
            });
      confirmSelect.append(new Option(label, String(ms)));
    }
    confirmSelect.value = String(getSettings().confirmThresholdMs);
  }

  function render(): void {
    const settings = getSettings();
    const translate = t();
    const { platform, appVersion } = getEnvironment();

    renderLocaleOptions();
    renderConfirmOptions();

    for (const swatch of Array.from(accentGroup.children) as HTMLElement[]) {
      setToggle(swatch, 'aria-pressed', swatch.dataset['accent'] === settings.accent);
    }

    shortcutButton.dataset['recording'] = recording ? 'true' : 'false';
    shortcutButton.textContent = recording
      ? translate('settings.recording')
      : formatAcceleratorForDisplay(settings.unlockShortcut, platform);

    shortcutHint.classList.toggle('row__hint--error', shortcutError !== null);
    shortcutHint.textContent =
      shortcutError === 'taken'
        ? translate('settings.shortcutTaken')
        : shortcutError === 'invalid'
          ? translate('settings.shortcutInvalid')
          : recording
            ? translate('settings.recording')
            : translate('settings.shortcutInvalid');

    mouseUnlockHint.textContent = translate('settings.mouseUnlockHint', {
      duration: formatDurationWords(settings.mouseUnlockHoldMs, translate),
    });

    setToggle(mouseUnlockSwitch, 'aria-checked', settings.allowMouseUnlock);
    setToggle(blockShortcutsSwitch, 'aria-checked', settings.blockSystemShortcuts);
    setToggle(keepAwakeSwitch, 'aria-checked', settings.keepDisplayAwake);
    setToggle(soundSwitch, 'aria-checked', settings.playSound);

    versionLabel.textContent = `v${appVersion}`;
  }

  return { render };
}
