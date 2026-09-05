/**
 * A two-note chime, synthesised rather than shipped as an audio file — it keeps
 * the bundle free of binary assets and the tone matches the app's restraint.
 */
export function playUnlockChime(): void {
  try {
    const AudioCtor = window.AudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const now = context.currentTime;

    for (const [index, frequency] of [660, 880].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = now + index * 0.12;

      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(0.09, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.42);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.45);
    }

    setTimeout(() => void context.close(), 900);
  } catch {
    // Audio is a nicety; never let it break the unlock flow.
  }
}
