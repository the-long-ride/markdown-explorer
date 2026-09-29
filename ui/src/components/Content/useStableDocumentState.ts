import { useMemo } from 'react';
import type { AppState } from '../../contexts/appStateModel';

// Split panes read only a handful of AppState fields (theme, settings,
// workspace identity, file list...). Handing them the whole, ever-changing
// state object re-rendered and re-wired BOTH panes on every dispatch, e.g. on
// a divider commit or a tab switch in the other pane. The returned object is
// the full state as of the last change to one of those fields.
export function useStableDocumentState(state: AppState): AppState {
  return useMemo(() => state, [
    state.settings,
    state.theme,
    state.themeStyle,
    state.workspacePath,
    state.workspaceName,
    state.defaultExpanded,
    state.appRuntime,
    state.fileList,
    state.tocCollapsed,
  ]); // eslint-disable-line react-hooks/exhaustive-deps
}
