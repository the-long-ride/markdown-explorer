// =============================================================================
// hooks/useResetOnChange.ts — Reset component state when its inputs change
// =============================================================================

import { useState } from 'react';

// Runs `reset` while rendering when any of `deps` changed since the last render,
// so dependent state is cleared within that same render. Resetting from an effect
// instead costs an extra commit per change; on every keystroke that cascade piles
// up into React's "Maximum update depth exceeded" limit.
export function useResetOnChange(deps: readonly unknown[], reset: () => void): void {
  const [prevDeps, setPrevDeps] = useState(deps);
  if (deps.length !== prevDeps.length || deps.some((dep, index) => !Object.is(dep, prevDeps[index]))) {
    setPrevDeps(deps);
    reset();
  }
}
