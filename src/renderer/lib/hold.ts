export interface HoldOptions {
  durationMs: number;
  idleLabel: string;
  holdingLabel: string;
  onComplete: () => void;
}

export interface HoldController {
  update(options: Partial<HoldOptions>): void;
  cancel(): void;
  destroy(): void;
}

/**
 * "Hold to confirm" / "hold to unlock".
 *
 * A deliberate press-and-hold is the whole point: it cannot be triggered by a
 * cloth brushing the trackpad, and it gives the user two full seconds to change
 * their mind before a long lock starts.
 */
export function createHoldButton(button: HTMLButtonElement, options: HoldOptions): HoldController {
  const fill = button.querySelector<HTMLElement>('.hold__fill');
  const label = button.querySelector<HTMLElement>('.hold__label');
  if (!fill || !label) throw new Error('Hold button needs .hold__fill and .hold__label');

  let config = { ...options };
  let frame = 0;
  let startedAt = 0;
  let holding = false;

  const paint = (progress: number) => fill.style.setProperty('--progress', String(progress));

  const stop = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    holding = false;
    button.dataset['holding'] = 'false';
    label.textContent = config.idleLabel;
    paint(0);
  };

  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / config.durationMs);
    paint(progress);
    if (progress >= 1) {
      stop();
      config.onComplete();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const begin = () => {
    if (holding || button.disabled) return;
    holding = true;
    button.dataset['holding'] = 'true';
    label.textContent = config.holdingLabel;
    startedAt = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    button.setPointerCapture(event.pointerId);
    begin();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== ' ' && event.key !== 'Enter')) return;
    event.preventDefault();
    begin();
  };

  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('blur', stop);
  button.addEventListener('keydown', onKeyDown);
  button.addEventListener('keyup', stop);

  label.textContent = config.idleLabel;
  paint(0);

  return {
    update(next) {
      config = { ...config, ...next };
      if (!holding) label.textContent = config.idleLabel;
    },
    cancel: stop,
    destroy() {
      stop();
      button.removeEventListener('pointerdown', onPointerDown);
      button.removeEventListener('pointerup', stop);
      button.removeEventListener('pointercancel', stop);
      button.removeEventListener('pointerleave', stop);
      button.removeEventListener('blur', stop);
      button.removeEventListener('keydown', onKeyDown);
      button.removeEventListener('keyup', stop);
    },
  };
}
