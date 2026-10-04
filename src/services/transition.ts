import { flushSync } from 'react-dom';
export function transition(update: () => void) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) { update(); return; }
  const view = document.startViewTransition(() => flushSync(update));
  void view.finished.catch(() => undefined);
}
