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
  /** Select the history scope used by push/back/forward */
  setScope: (scopeId: string) => void;
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
const DEFAULT_SCOPE_ID = 'default';

interface HistoryState {
  stack: string[];
  index: number;
  isNavigatingHistory: boolean;
}

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const { navigate } = useAppState();

  const historiesRef = useRef<Record<string, HistoryState>>({});
  const scopeRef = useRef(DEFAULT_SCOPE_ID);

  // Force re-render when history changes (for canGoBack/canGoForward)
  const [version, forceUpdate] = useReducerCompat();

  const getHistory = useCallback((scopeId = scopeRef.current) => {
    if (!historiesRef.current[scopeId]) {
      historiesRef.current[scopeId] = {
        stack: [],
        index: -1,
        isNavigatingHistory: false,
      };
    }
    return historiesRef.current[scopeId];
  }, []);

  const setScope = useCallback(
    (scopeId: string) => {
      const nextScopeId = scopeId || DEFAULT_SCOPE_ID;
      if (scopeRef.current === nextScopeId) return;
      scopeRef.current = nextScopeId;
      getHistory(nextScopeId);
      forceUpdate();
    },
    [forceUpdate, getHistory],
  );

  const push = useCallback(
    (fsPath: string) => {
      const history = getHistory();
      if (history.isNavigatingHistory) {
        history.isNavigatingHistory = false;
        forceUpdate();
        return;
      }
      if (
        history.index >= 0 &&
        history.stack[history.index] === fsPath
      ) {
        return;
      }
      history.stack = history.stack.slice(0, history.index + 1);
      history.stack.push(fsPath);
      history.index = history.stack.length - 1;
      forceUpdate();
    },
    [forceUpdate, getHistory],
  );

  const back = useCallback(() => {
    const history = getHistory();
    if (history.index > 0) {
      history.isNavigatingHistory = true;
      history.index--;
      navigate(history.stack[history.index]);
      forceUpdate();
    }
  }, [navigate, forceUpdate, getHistory]);

  const forward = useCallback(() => {
    const history = getHistory();
    if (history.index < history.stack.length - 1) {
      history.isNavigatingHistory = true;
      history.index++;
      navigate(history.stack[history.index]);
      forceUpdate();
    }
  }, [navigate, forceUpdate, getHistory]);

  const value = useMemo<NavigationContextValue>(() => {
    const activeHistory = getHistory();
    return {
      push,
      setScope,
      back,
      forward,
      canGoBack: activeHistory.index > 0,
      canGoForward: activeHistory.index < activeHistory.stack.length - 1,
    };
  }, [push, setScope, back, forward, getHistory, version]);

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
