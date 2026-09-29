import { subscribeToAutoMermaidTheme, syncMermaidAppearance } from './enhancements/mermaidAppearance';
import { createMermaidRerenderLifecycle } from './enhancements/mermaidRerenderLifecycle';

interface MermaidContentLifecycleArgs {
  body: ParentNode;
  /** Scroll container of the document root (main view, split pane, scope view). */
  scroll?: Element | null;
  state: any;
  previousAppearanceKeyRef: { current: string | null };
  runIdRef: { current: number };
  startEnhancements: () => () => void;
}

export function installMermaidContentLifecycle({
  body,
  scroll,
  state,
  previousAppearanceKeyRef,
  runIdRef,
  startEnhancements,
}: MermaidContentLifecycleArgs): () => void {
  const appearance = syncMermaidAppearance(previousAppearanceKeyRef.current, state);
  previousAppearanceKeyRef.current = appearance.key;

  const rerender = createMermaidRerenderLifecycle(body, startEnhancements, {
    theme: state.theme,
    runIdRef,
    scroll,
  });
  if (appearance.changed) rerender.schedule();
  const unsubscribeAutoTheme = subscribeToAutoMermaidTheme(state.theme, () => rerender.schedule());

  return () => {
    unsubscribeAutoTheme();
    rerender.dispose();
  };
}
