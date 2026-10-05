import { flushSync } from 'react-dom';
let active: ViewTransition | undefined;
export function transition(update: () => void) {
  active?.skipTransition();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) { update(); return; }
  const view = document.startViewTransition(() => flushSync(update));
  active = view;
  void view.finished.catch(() => undefined).finally(() => { if (active === view) active = undefined; });
}
