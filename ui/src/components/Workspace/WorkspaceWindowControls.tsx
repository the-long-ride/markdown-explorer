import { TooltipButton } from '../shared/TooltipButton';
import type { ThemeMode } from '../../types';
import { isDesktopRuntime } from './workspaceSelectionUtils';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';

interface WorkspaceWindowControlsProps {
  embeddedInTabs: boolean;
  theme: ThemeMode;
  isMaximized: boolean;
  onToggleTheme: () => void;
}

export function WorkspaceWindowControls({
  embeddedInTabs,
  theme,
  isMaximized,
  onToggleTheme,
}: WorkspaceWindowControlsProps) {
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const isDesktop = isDesktopRuntime();
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '44px',
        display: embeddedInTabs ? 'none' : 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingRight: '12px',
        zIndex: 200000,
        ...(isDesktop ? { WebkitAppRegion: 'drag' } : {}) as any,
      }}
    >
      <div className="window-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px', ...(isDesktop ? { WebkitAppRegion: 'no-drag' } : {}) as any }}>
        <TooltipButton
          className="btn btn--icon"
          onClick={onToggleTheme}
          tooltip={t.topbar.theme}
          shortcut={state.settings.keybindings?.toggleTheme}
          icon={isDark ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        />
        {isDesktop && (
          <>
            <div style={{ width: '1px', height: '16px', background: 'var(--bd-s)' }} />
            <TooltipButton className="btn btn--icon window-control-btn" onClick={() => (window as any).electronAPI.postMessage({ command: 'window-minimize' })} tooltip={t.tooltips.minimize} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>} />
            <TooltipButton
              className="btn btn--icon window-control-btn"
              onClick={() => (window as any).electronAPI.postMessage({ command: 'window-maximize' })}
              tooltip={isMaximized ? t.tooltips.restore : t.tooltips.maximize}
              icon={isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M8 3h13v13H8z" /><path d="M16 16v5H3V8h5" /></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
              )}
            />
            <TooltipButton className="btn btn--icon window-control-btn window-control-btn--close" onClick={() => (window as any).electronAPI.postMessage({ command: 'window-close' })} tooltip={t.tooltips.closeApp} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
          </>
        )}
      </div>
    </div>
  );
}
