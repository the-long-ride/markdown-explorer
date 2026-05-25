// =============================================================================
// contexts/PlatformContext.tsx — Provides PlatformBridge to the component tree
// =============================================================================

import { createContext, useContext } from 'react';
import type { PlatformBridge } from '../platform/bridge';

const PlatformContext = createContext<PlatformBridge | null>(null);

export function PlatformProvider({
  bridge,
  children,
}: {
  bridge: PlatformBridge;
  children: React.ReactNode;
}) {
  return (
    <PlatformContext.Provider value={bridge}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformBridge {
  const bridge = useContext(PlatformContext);
  if (!bridge) throw new Error('usePlatform must be used within PlatformProvider');
  return bridge;
}
