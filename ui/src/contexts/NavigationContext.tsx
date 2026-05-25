// =============================================================================
// contexts/NavigationContext.tsx — Document history (back/forward)
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from 'react';
import { useAppState } from './AppStateContext';

interface NavigationContextValue {
  /** Push a new file to history (called when content renders) */
  push: (fsPath: string) => void;
  /** Go back in history */
  back: () => void;
  /** Go forward in history */
  forward: () => void;
  /** Can go back */
  canGoBack: boolean;
  /** Can go forward */
  canGoForward: boolean;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { navigate } = useAppState();

  const stackRef = useRef<string[]>([]);
  const indexRef = useRef(-1);
  const isNavRef = useRef(false);

  // Force re-render when history changes (for canGoBack/canGoForward)
  const [, forceUpdate] = useReducerCompat();

  const push = useCallback(
    (fsPath: string) => {
      if (isNavRef.current) {
        isNavRef.current = false;
        forceUpdate();
        return;
      }
      if (
        indexRef.current >= 0 &&
        stackRef.current[indexRef.current] === fsPath
      ) {
        return;
      }
      stackRef.current = stackRef.current.slice(0, indexRef.current + 1);
      stackRef.current.push(fsPath);
      indexRef.current = stackRef.current.length - 1;
      forceUpdate();
    },
    [forceUpdate],
  );

  const back = useCallback(() => {
    if (indexRef.current > 0) {
      isNavRef.current = true;
      indexRef.current--;
      navigate(stackRef.current[indexRef.current]);
      forceUpdate();
    }
  }, [navigate, forceUpdate]);

  const forward = useCallback(() => {
    if (indexRef.current < stackRef.current.length - 1) {
      isNavRef.current = true;
      indexRef.current++;
      navigate(stackRef.current[indexRef.current]);
      forceUpdate();
    }
  }, [navigate, forceUpdate]);

  const value = useMemo<NavigationContextValue>(
    () => ({
      push,
      back,
      forward,
      canGoBack: indexRef.current > 0,
      canGoForward: indexRef.current < stackRef.current.length - 1,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [push, back, forward, indexRef.current, stackRef.current.length],
  );

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx)
    throw new Error('useNavigation must be used within NavigationProvider');
  return ctx;
}

// Simple incrementing counter to force re-renders
function useReducerCompat(): [number, () => void] {
  const [n, dispatch] = useReducerImpl((s: number) => s + 1, 0);
  return [n, dispatch];
}

// Use React's useReducer for the counter
import { useReducer as useReducerImpl } from 'react';
