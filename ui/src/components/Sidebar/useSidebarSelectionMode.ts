import { useCallback, useEffect, useRef, useState } from 'react';
import type { SidebarItemKind } from '../../types';

const EMPTY_SELECTION: ReadonlySet<string> = new Set();

export function useSidebarSelectionMode({ workspaceKey, onEnter }: { workspaceKey: string; onEnter: () => void }) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(EMPTY_SELECTION);
  // Bumped on every enter and exit so an async caller can tell whether the selection it started with is still the current one.
  const epochRef = useRef(0);
  const getEpoch = useCallback(() => epochRef.current, []);

  const exit = useCallback(() => {
    epochRef.current += 1;
    setActive(false);
    setSelected(EMPTY_SELECTION);
  }, []);

  useEffect(() => { exit(); }, [exit, workspaceKey]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) exit();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, exit]);

  const enter = useCallback(() => {
    epochRef.current += 1;
    onEnter();
    setActive(true);
  }, [onEnter]);

  const toggle = useCallback((kind: SidebarItemKind, path: string) => {
    const key = `${kind}:${path}`;
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  return { active, selected, enter, exit, toggle, isSelected, getEpoch };
}
