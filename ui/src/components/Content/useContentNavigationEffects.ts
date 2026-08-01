import { useEffect } from 'react';

interface ContentNavigationEffectsArgs {
  currentFile: string | null;
  markdownSource: string | null;
  navigate: (path: string) => void;
  push: (path: string) => void;
}

export function useContentNavigationEffects({
  currentFile,
  markdownSource,
  navigate,
  push,
}: ContentNavigationEffectsArgs): void {
  useEffect(() => {
    if (currentFile) push(currentFile);
  }, [currentFile, push]);

  useEffect(() => {
    const win = window as any;
    if (!win.UI) win.UI = {};
    win.UI.currentMarkdownSource = markdownSource;
    return () => {
      if (win.UI?.currentMarkdownSource === markdownSource) {
        win.UI.currentMarkdownSource = null;
      }
    };
  }, [markdownSource]);

  useEffect(() => {
    const win = window as any;
    if (!win.Nav) win.Nav = {};
    const previousGo = win.Nav.go;
    const go = (fsPath: string | null) => {
      if (fsPath) navigate(String(fsPath));
    };
    win.Nav.go = go;
    return () => {
      if (win.Nav?.go === go) win.Nav.go = previousGo;
    };
  }, [navigate]);
}
