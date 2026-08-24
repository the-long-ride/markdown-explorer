import { subscribeToAutoMermaidTheme, syncMermaidAppearance } from './enhancements/mermaidAppearance';
import { createMermaidRerenderLifecycle } from './enhancements/mermaidRerenderLifecycle';

interface MermaidContentLifecycleArgs {
  body: ParentNode;
  state: any;
  previousAppearanceKeyRef: { current: string | null };
  runIdRef: { current: number };
  startEnhancements: () => () => void;
}

export function installMermaidContentLifecycle({
  body,
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
  });
  if (appearance.changed) rerender.schedule();
  const unsubscribeAutoTheme = subscribeToAutoMermaidTheme(state.theme, () => rerender.schedule());

  return () => {
    unsubscribeAutoTheme();
    rerender.dispose();
  };
}
