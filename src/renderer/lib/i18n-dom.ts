import type { MessageKey, Translator } from '@shared/i18n/index.js';
import { all } from './dom.js';

/**
 * Fill every `data-i18n*` slot in a subtree.
 *
 * Static labels live in the HTML so the markup stays readable; anything with a
 * placeholder is set from code where the values are known.
 */
export function applyTranslations(t: Translator, scope: ParentNode = document): void {
  for (const node of all<HTMLElement>('[data-i18n]', scope)) {
    node.textContent = t(node.dataset['i18n'] as MessageKey);
  }
  for (const node of all<HTMLElement>('[data-i18n-title]', scope)) {
    const label = t(node.dataset['i18nTitle'] as MessageKey);
    node.title = label;
    node.setAttribute('aria-label', label);
  }
  for (const node of all<HTMLElement>('[data-i18n-aria-label]', scope)) {
    node.setAttribute('aria-label', t(node.dataset['i18nAriaLabel'] as MessageKey));
  }
}
