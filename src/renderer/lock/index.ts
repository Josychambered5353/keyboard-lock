import { formatAcceleratorForDisplay } from '@shared/accelerator.js';
import { formatClock } from '@shared/duration.js';
import type { LockStatus } from '@shared/types.js';
import { el } from '../lib/dom.js';
import { createHoldButton } from '../lib/hold.js';
import { applyTranslations } from '../lib/i18n-dom.js';
import { playUnlockChime } from '../lib/sound.js';
import { getEnvironment, getSettings, initStore, subscribe, t } from '../lib/store.js';

const DIAL_RADIUS = 124;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

const isPrimary = new URLSearchParams(window.location.search).get('primary') !== '0';

async function bootstrap(): Promise<void> {
  await initStore();

  const body = document.body;
  const time = el('lock-time');
  const subtitle = el('lock-subtitle');
  const shortcutHint = el('shortcut-hint');
  const blockedCount = el('blocked-count');
  const degradedNotice = el('degraded-notice');
  const dial = el<SVGCircleElement & HTMLElement>('dial-progress');
  const unlockButton = el<HTMLButtonElement>('unlock-hold');

  body.dataset['primary'] = isPrimary ? 'true' : 'false';
  dial.style.strokeDasharray = String(DIAL_CIRCUMFERENCE);
  dial.style.strokeDashoffset = '0';

  const unlockHold = createHoldButton(unlockButton, {
    durationMs: getSettings().mouseUnlockHoldMs,
    idleLabel: '',
    holdingLabel: '',
    onComplete: () => void window.keyboardLock.stopLock('mouse'),
  });

  let latest: LockStatus | null = null;

  function renderStatus(status: LockStatus): void {
    latest = status;
    time.textContent = formatClock(status.remainingMs);

    const progress = status.durationMs > 0 ? status.remainingMs / status.durationMs : 0;
    dial.style.strokeDashoffset = String(DIAL_CIRCUMFERENCE * (1 - progress));

    if (isPrimary && status.blockedKeys > 0) {
      blockedCount.textContent = t()('lock.blocked', { count: status.blockedKeys });
    }
    // Say so rather than letting the user discover a live shortcut the hard way.
    degradedNotice.hidden = !isPrimary || !status.shortcutsDegraded;
  }

  function renderChrome(): void {
    const translate = t();
    const settings = getSettings();
    const shortcut = formatAcceleratorForDisplay(
      settings.unlockShortcut,
      getEnvironment().platform,
    );

    applyTranslations(translate);

    subtitle.textContent = isPrimary ? translate('lock.subtitle') : translate('lock.secondary');

    // Secondary displays are a status readout only — every control lives on the
    // primary screen, where the pointer already is.
    const showMouseUnlock = isPrimary && settings.allowMouseUnlock;
    unlockButton.hidden = !showMouseUnlock;
    body.dataset['mouseUnlock'] = showMouseUnlock ? 'true' : 'false';

    unlockHold.update({
      durationMs: settings.mouseUnlockHoldMs,
      idleLabel: translate('lock.unlockButton'),
      holdingLabel: translate('lock.unlockHolding'),
    });

    shortcutHint.hidden = !isPrimary;
    shortcutHint.textContent = showMouseUnlock
      ? translate('lock.unlockShortcut', { shortcut })
      : translate('lock.shortcutOnly', { shortcut });

    if (latest) renderStatus(latest);
  }

  window.keyboardLock.onLockTick(renderStatus);

  window.keyboardLock.onLockEnded(() => {
    unlockHold.cancel();
    body.dataset['finished'] = 'true';
    if (isPrimary && getSettings().playSound) playUnlockChime();
  });

  subscribe(renderChrome);
  renderChrome();
  renderStatus(await window.keyboardLock.getLockStatus());
}

void bootstrap();
