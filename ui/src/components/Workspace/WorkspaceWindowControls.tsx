import { TooltipButton } from '../shared/TooltipButton';
import { WebDemoNavActions } from '../Topbar/WebDemoNavActions';
import type { ThemeMode } from '../../types';
import { executeThemeTransition } from '../../utils/themeTransition';
import { isDesktopRuntime } from './workspaceSelectionUtils';
import { useAppState } from '../../contexts/AppStateContext';
import { getTranslations } from '../../contexts/translations';
import { usePlatform } from '../../contexts/PlatformContext';
import { useRequestWindowClose } from '../../hooks/useDirtyDocumentsGuard';
import { getEnabledShortcut } from '../../utils/shortcuts';

interface WorkspaceWindowControlsProps {
  embeddedInTabs: boolean;
  theme: ThemeMode;
  isMaximized: boolean;
  onToggleTheme: () => void;
  onOpenHomepage?: () => void;
}

export function WorkspaceWindowControls({
  embeddedInTabs,
  theme,
  isMaximized,
  onToggleTheme,
  onOpenHomepage,
}: WorkspaceWindowControlsProps) {
  const { state } = useAppState();
  const bridge = usePlatform();
  const requestWindowClose = useRequestWindowClose();
  const currentLang = state.settings.language || 'en';
  const t = getTranslations(currentLang);

  const isDesktop = isDesktopRuntime();
  const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const themeToggleLabel = isDark ? t.topbar.switchToLightMode : t.topbar.switchToDarkMode;
  return (
    <div className={`workspace-window-controls${embeddedInTabs ? ' is-hidden' : ''}${isDesktop ? ' is-desktop' : ''}`}>
      <div className="window-controls">
        {onOpenHomepage && (
          <TooltipButton
            className="btn btn--icon workspace-selection__home-button"
            onClick={onOpenHomepage}
            tooltip={t.topbar.home}
            shortcut={getEnabledShortcut(state.settings, 'welcome')}
            aria-label={t.topbar.home}
            data-testid="workspace-open-homepage-btn"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V9.5z" /></svg>
            }
          />
        )}
        <TooltipButton
          className="btn btn--icon"
          onClick={(e) => {
            executeThemeTransition(onToggleTheme, {
              originElement: e.currentTarget,
              event: e,
              nextTheme: isDark ? 'light' : 'dark',
            });
          }}
          tooltip={themeToggleLabel}
          shortcut={getEnabledShortcut(state.settings, 'toggleTheme')}
          icon={isDark ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        />
        {isDesktop && (
          <>
            <div className="workspace-window-controls__divider" />
            <TooltipButton className="btn btn--icon window-control-btn" onClick={() => bridge.postMessage({ command: 'window-minimize' })} tooltip={t.tooltips.minimize} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>} />
            <TooltipButton
              className="btn btn--icon window-control-btn"
              onClick={() => bridge.postMessage({ command: 'window-maximize' })}
              tooltip={isMaximized ? t.tooltips.restore : t.tooltips.maximize}
              icon={isMaximized ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M8 8V3h13v13h-5" /><path d="M3 8h13v13H3z" /></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg>
              )}
            />
            <TooltipButton className="btn btn--icon window-control-btn window-control-btn--close" onClick={requestWindowClose} tooltip={t.tooltips.closeApp} icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>} />
          </>
        )}
        <WebDemoNavActions />
      </div>
    </div>
  );
}
