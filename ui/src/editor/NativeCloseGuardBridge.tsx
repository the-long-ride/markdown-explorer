import { useAppState } from '../contexts/AppStateContext';
import { usePlatform } from '../contexts/PlatformContext';
import { useNativeCloseGuard } from './useNativeCloseGuard';

export function NativeCloseGuardBridge() {
  const { state, guardUnsavedChanges } = useAppState();
  const bridge = usePlatform();
  useNativeCloseGuard({
    bridge: bridge as any,
    sessions: state.documentSessions ?? {},
    guardUnsavedChanges,
  });
  return null;
}
