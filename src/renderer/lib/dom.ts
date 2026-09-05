/** Query helpers that fail loudly: a missing element is a bug in the HTML, not a runtime condition. */
export function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

export function all<T extends HTMLElement>(selector: string, scope: ParentNode = document): T[] {
  return Array.from(scope.querySelectorAll<T>(selector));
}

export function setText(target: HTMLElement, text: string): void {
  target.textContent = text;
}

/** Toggle an `aria-pressed`/`aria-checked` control and keep the DOM the single source of truth. */
export function setToggle(
  target: HTMLElement,
  attribute: 'aria-pressed' | 'aria-checked',
  on: boolean,
): void {
  target.setAttribute(attribute, on ? 'true' : 'false');
}
