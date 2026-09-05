import type { Translator } from './i18n/index.js';
import { toDurationParts } from './duration.js';

/**
 * Duration as prose (`"2 min 30 s"`), for sentences and hints.
 * Numeric countdowns use {@link formatClock} instead.
 */
export function formatDurationWords(ms: number, t: Translator): string {
  const { minutes, seconds } = toDurationParts(ms);
  if (minutes === 0) return t('common.seconds', { count: seconds });
  if (seconds === 0) return t('common.minutes', { count: minutes });
  return t('common.minutesSeconds', { minutes, seconds });
}
