import { DestroyRef, inject, Signal, signal } from '@angular/core';

/**
 * A signal that follows a CSS media query, e.g. mediaQuery('(max-width: 767px)').
 * Call it in a constructor or field initializer (it needs an injection context).
 * Use it to render a different layout (cards instead of a table) rather than
 * rendering both and hiding one with CSS.
 */
export function mediaQuery(query: string): Signal<boolean> {
    const list = window.matchMedia(query);
    const matches = signal(list.matches);
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    list.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => list.removeEventListener('change', listener));
    return matches.asReadonly();
}

/** Below Tailwind's `md` breakpoint (768px in tailwind.css): phones and small tablets. */
export const NARROW_SCREEN = '(max-width: 767.98px)';
