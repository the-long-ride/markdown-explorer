import { useEffect, useState } from 'react';
import {
  SCOPE_NAVIGATION_REQUEST_EVENT,
  SCOPE_NAVIGATION_STATE_EVENT,
  type ScopeNavigationDirection,
  type ScopeNavigationStateDetail,
} from '../components/Modal/scopeHistory';

const INACTIVE_SCOPE_NAVIGATION: ScopeNavigationStateDetail = {
  active: false,
  canPrevious: false,
  canNext: false,
};

let latestScopeNavigationState: ScopeNavigationStateDetail = INACTIVE_SCOPE_NAVIGATION;

function initialScopeNavigationState(): ScopeNavigationStateDetail {
  if (typeof document === 'undefined' || !document.querySelector('.scope-view')) {
    return latestScopeNavigationState;
  }
  return latestScopeNavigationState.active
    ? latestScopeNavigationState
    : { active: true, canPrevious: false, canNext: false };
}

function normalizeScopeNavigationState(detail?: ScopeNavigationStateDetail): ScopeNavigationStateDetail {
  return detail?.active ? {
    active: true,
    canPrevious: Boolean(detail.canPrevious),
    canNext: Boolean(detail.canNext),
  } : INACTIVE_SCOPE_NAVIGATION;
}

export function getScopeNavigationStateSnapshot(doc?: Document): ScopeNavigationStateDetail {
  if (latestScopeNavigationState.active) return latestScopeNavigationState;
  const target = doc ?? (typeof document !== 'undefined' ? document : undefined);
  return target?.querySelector('.scope-view')
    ? { active: true, canPrevious: false, canNext: false }
    : INACTIVE_SCOPE_NAVIGATION;
}

export function requestScopeNavigation(direction: ScopeNavigationDirection): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SCOPE_NAVIGATION_REQUEST_EVENT, { detail: { direction } }));
}

export function useScopeNavigationState(): ScopeNavigationStateDetail {
  const [navigation, setNavigation] = useState<ScopeNavigationStateDetail>(initialScopeNavigationState);

  useEffect(() => {
    const handleScopeState = (event: Event) => {
      const detail = (event as CustomEvent<ScopeNavigationStateDetail>).detail;
      latestScopeNavigationState = normalizeScopeNavigationState(detail);
      setNavigation(latestScopeNavigationState);
    };
    window.addEventListener(SCOPE_NAVIGATION_STATE_EVENT, handleScopeState);
    return () => window.removeEventListener(SCOPE_NAVIGATION_STATE_EVENT, handleScopeState);
  }, []);

  return navigation;
}
