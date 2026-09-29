import { createContext, useContext } from 'react';
import type { AppState } from '../../contexts/appStateModel';

// App-level services a split pane needs to run the same document interactions
// as the main view. Absent (null) in isolated renders such as unit tests, where
// panes fall back to static rendering.
export interface DocumentEnvironment {
  state: AppState;
  bridge: any;
  navigate: (path: string) => void;
  onImageClick: (el: HTMLElement) => void;
  refresh: () => void;
}

export const DocumentEnvironmentContext = createContext<DocumentEnvironment | null>(null);

export function useDocumentEnvironment(): DocumentEnvironment | null {
  return useContext(DocumentEnvironmentContext);
}
