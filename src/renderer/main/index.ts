import { formatAcceleratorForDisplay } from '@shared/accelerator.js';
import { CONFIRM_HOLD_MS, DURATION_PRESETS_MS } from '@shared/constants.js';
import {
  DURATION_STEPS_MS,
  durationToStepIndex,
  formatClock,
  stepIndexToDuration,
} from '@shared/duration.js';
import { formatDurationWords } from '@shared/format.js';
import { el, setToggle } from '../lib/dom.js';
import { createHoldButton } from '../lib/hold.js';
import { applyTranslations } from '../lib/i18n-dom.js';
import {
  getEnvironment,
  getSettings,
  initStore,
  subscribe,
  t,
  updateSettings,
} from '../lib/store.js';
import { setupSettingsView } from './settings-view.js';

type View = 'setup' | 'confirm' | 'settings';

const views: Record<View, string> = {
  setup: 'view-setup',
  confirm: 'view-confirm',
  settings: 'view-settings',
};

let currentView: View = 'setup';
let durationMs = 0;

function showView(next: View): void {
  currentView = next;
  for (const [name, id] of Object.entries(views)) {
    el(id).hidden = name !== next;
  }
}

async function bootstrap(): Promise<void> {
  await initStore();
  durationMs = getSettings().defaultDurationMs;

  const slider = el<HTMLInputElement>('duration-slider');
  const durationValue = el('duration-value');
  const durationHint = el('duration-hint');
  const presets = el('presets');
  const unlockNote = el('unlock-note-text');
  const startButton = el<HTMLButtonElement>('start-lock');
  const confirmDuration = el('confirm-duration');
  const confirmBody = el('confirm-body');

  slider.max = String(DURATION_STEPS_MS.length - 1);
  slider.value = String(durationToStepIndex(durationMs));

  const settingsView = setupSettingsView();

  // ---- presets -----------------------------------------------------------

  const presetButtons = DURATION_PRESETS_MS.map((preset) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset['ms'] = String(preset);
    button.addEventListener('click', () => setDuration(preset, true));
    presets.append(button);
    return button;
  });

  function setDuration(next: number, syncSlider: boolean): void {
    durationMs = next;
    if (syncSlider) slider.value = String(durationToStepIndex(next));
    render();
  }

  slider.addEventListener('input', () => {
    setDuration(stepIndexToDuration(Number(slider.value)), false);
  });

  // ---- start / confirm ---------------------------------------------------

  async function beginLock(): Promise<void> {
    await updateSettings({ defaultDurationMs: durationMs });
    await window.keyboardLock.startLock(durationMs);
    showView('setup');
  }

  const confirmHold = createHoldButton(el<HTMLButtonElement>('confirm-hold'), {
    durationMs: CONFIRM_HOLD_MS,
    idleLabel: '',
    holdingLabel: '',
    onComplete: () => void beginLock(),
  });

  startButton.addEventListener('click', () => {
    const { confirmThresholdMs } = getSettings();
    // Anything long enough to strand someone gets a second, deliberate step.
    if (confirmThresholdMs > 0 && durationMs >= confirmThresholdMs) {
      showView('confirm');
      render();
      return;
    }
    void beginLock();
  });

  el('confirm-back').addEventListener('click', () => {
    confirmHold.cancel();
    showView('setup');
  });

  // ---- settings ----------------------------------------------------------

  el('open-settings').addEventListener('click', () => {
    showView('settings');
    render();
  });
  el('close-settings').addEventListener('click', () => showView('setup'));

  el('minimize-window').addEventListener('click', () => void window.keyboardLock.minimizeWindow());
  el('close-window').addEventListener('click', () => void window.keyboardLock.closeWindow());

  // ---- rendering ---------------------------------------------------------

  function render(): void {
    const translate = t();
    const settings = getSettings();
    const platform = getEnvironment().platform;
    const shortcut = formatAcceleratorForDisplay(settings.unlockShortcut, platform);
    const words = formatDurationWords(durationMs, translate);

    applyTranslations(translate);

    durationValue.textContent = formatClock(durationMs);
    durationHint.textContent = translate('setup.startHint', { duration: words });
    unlockNote.textContent = translate('setup.unlockHint', { shortcut });

    const fill = (Number(slider.value) / (DURATION_STEPS_MS.length - 1)) * 100;
    slider.style.setProperty('--fill', `${fill}%`);

    for (const button of presetButtons) {
      const preset = Number(button.dataset['ms']);
      button.textContent = formatDurationWords(preset, translate);
      setToggle(button, 'aria-pressed', preset === durationMs);
    }

    confirmDuration.textContent = formatClock(durationMs);
    confirmBody.textContent = translate('confirm.body', { duration: words, shortcut });
    confirmHold.update({
      idleLabel: translate('confirm.hold'),
      holdingLabel: translate('confirm.holding'),
    });

    if (currentView === 'settings') settingsView.render();
  }

  subscribe(render);
  window.keyboardLock.onLockEnded(() => showView('setup'));

  showView('setup');
  render();
}

void bootstrap();
