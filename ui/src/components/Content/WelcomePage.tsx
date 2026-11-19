// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { version as bundledVersion } from '../../../package.json';
import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { ACTIONS_LIST } from '../Settings/SettingsModal';
import { getLocalizedShortcutActionLabel } from '../Settings/settingsActions';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import { WELCOME_SELECT_TAB_EVENT, getLastRequestedWelcomeTab, type WelcomeTabId } from '../../utils/welcomeEvents';
import { WelcomeLaunchpad } from './WelcomeLaunchpad';
import { WelcomeHero } from './WelcomeHero';
import { UserManualTab } from './UserManualTab';
import { WelcomeFeaturesGrid } from './WelcomeFeaturesGrid';
import './WelcomePage.css';

import {
  BugIcon, KeyboardIcon, LightbulbIcon, LockIcon, SparklesIcon,
} from './WelcomePageIcons';
import { buildWelcomeTipGroups } from './welcomeTipGroups';
import { cleanTitle, TAB_LABELS } from './welcomeLabels';
import { renderWelcomeDescription } from './renderWelcomeDescription';
import { getTipIcon, renderShortcutKeys } from './welcomePageHelpers';
import { getEnabledShortcut } from '../../utils/shortcuts';

export function WelcomePage() {
  const { state } = useAppState();
  const isDesktop = typeof (window as any).electronAPI !== 'undefined' || state.appRuntime === 'tauri' || state.appRuntime === 'desktop';
  const isWeb = typeof (window as any).__webBus !== 'undefined' || state.appRuntime === 'web';
  const isDesktopLike = isDesktop || isWeb;
  const supportsEditor = isDesktop || state.appRuntime === 'vscode' || isWeb;
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);
  const t = getTranslations(currentLang);

  const [activeTab, setActiveTab] = useState<WelcomeTabId>(() => getLastRequestedWelcomeTab() ?? 'manual');
  const labels = TAB_LABELS[currentLang] || TAB_LABELS.en;
  const effectiveSettings = useMemo(() => {
    const directKeybindings = (state as any)?.keybindings;
    const settingsKeybindings = state.settings?.keybindings;
    if (directKeybindings || settingsKeybindings) {
      return {
        ...state.settings,
        keybindings: {
          ...settingsKeybindings,
          ...directKeybindings,
        },
      };
    }
    return state.settings;
  }, [state.settings, (state as any)?.keybindings]);

  const tipGroups = useMemo(
    () => buildWelcomeTipGroups(currentLang, effectiveSettings, wt.tips),
    [currentLang, effectiveSettings, wt.tips],
  );

  useEffect(() => {
    const handleSelectTab = (event: Event) => {
      const tab = (event as CustomEvent<WelcomeTabId>).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener(WELCOME_SELECT_TAB_EVENT, handleSelectTab);
    return () => window.removeEventListener(WELCOME_SELECT_TAB_EVENT, handleSelectTab);
  }, []);

  return (
    <div className="welcome-container">
      <InteractiveBackground />
      <div className="welcome-animate-wrapper">
        <WelcomeHero copy={wt.hero} isDesktop={isDesktopLike} hostPlatform={state.hostPlatform} markdownThemLabel={t.ui.markdownThemLinkLabel} language={currentLang} />

        <div className="welcome-command-deck">
          <WelcomeLaunchpad
            language={currentLang} isDesktop={isDesktop}
            workspaceName={state.workspaceName} fileCount={state.fileList?.length ?? 0}
            recentWorkspaces={state.recentWorkspaces}
          />

          <div className="welcome-discovery-workbench">
            {/* Tabs Bar */}
            <div className="tabs-bar welcome-tabs" data-tour-id="welcome-tabs-bar">
              <button
                className={`tab-btn welcome-tab ${activeTab === 'manual' ? 'active' : ''}`}
                data-tour-id="welcome-tab-manual"
                onClick={() => setActiveTab('manual')}
              >
                <LightbulbIcon className="tab-icon" />{labels.manual}
              </button>
              <button
                className={`tab-btn welcome-tab ${activeTab === 'features' ? 'active' : ''}`}
                data-tour-id="welcome-tab-features"
                onClick={() => setActiveTab('features')}
              >
                <SparklesIcon className="tab-icon" />{labels.features}
              </button>
              <button
                className={`tab-btn welcome-tab ${activeTab === 'shortcuts' ? 'active' : ''}`}
                data-tour-id="welcome-tab-shortcuts"
                onClick={() => setActiveTab('shortcuts')}
              >
                <KeyboardIcon className="tab-icon" />{labels.shortcuts}
              </button>
              <button
                className={`tab-btn welcome-tab ${activeTab === 'tips' ? 'active' : ''}`}
                data-tour-id="welcome-tab-tips"
                onClick={() => setActiveTab('tips')}
              >
                <LightbulbIcon className="tab-icon" />{labels.tips}
              </button>
              <button
                className={`tab-btn welcome-tab ${activeTab === 'privacy' ? 'active' : ''}`}
                data-tour-id="welcome-tab-privacy"
                onClick={() => setActiveTab('privacy')}
              >
                <LockIcon className="tab-icon" />{labels.privacy}
              </button>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'features' && (
                <WelcomeFeaturesGrid
                  features={wt?.features}
                  settings={state.settings}
                  isDesktop={isDesktop}
                  supportsEditor={supportsEditor}
                  viewShortcutsLabel={labels.viewShortcuts}
                  onViewShortcuts={() => setActiveTab('shortcuts')}
                />
              )}

              {activeTab === 'manual' && (
                <UserManualTab language={currentLang} settings={state.settings} version={state.appVersion || bundledVersion} />
              )}

              {activeTab === 'shortcuts' && (
                <div className="shortcuts-card">
                  <h2 className="shortcuts-title"><KeyboardIcon className="section-icon" />{cleanTitle(wt.features.shortcuts.title)}</h2>
                  {!isDesktop && (<div className="welcome-feature-card__detail">{wt.features.shortcuts.vscodeDesc}</div>)}
                  <table className="shortcuts-table">
                    <thead>
                      <tr>
                        <th>{wt.shortcutsTable.headers.action}</th>
                        <th>{wt.shortcutsTable.headers.shortcut}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ACTIONS_LIST.filter((act) =>
                        act.scope === 'both' ||
                        (act.scope === 'non-vscode' && state.appRuntime !== 'vscode') ||
                        (act.scope === 'desktop' && isDesktopLike) ||
                        (act.scope === 'electron' && isDesktop) ||
                        (act.scope === 'editor' && supportsEditor),
                      ).map((act) => {
                        const val = getEnabledShortcut(state.settings, act.id) ?? state.settings.keybindings?.[act.id] ?? "";
                        return (
                          <tr key={act.id}>
                            <td>{getLocalizedShortcutActionLabel(t, act.id, act.label)}</td>
                            <td>{renderShortcutKeys(val)}</td>
                          </tr>
                        );
                      })}
                      {isDesktop && (
                        <tr><td>{t.actions.toggleFullscreen}</td><td><kbd>F11</kbd></td></tr>
                      )}
                      <tr><td>{wt.shortcutsTable.rows.zoomModal}</td><td><kbd>{wt.shortcutsTable.rows.zoomModalShortcut}</kbd></td></tr>
                      <tr>
                        <td>{t.ui.sidebarCursorDetails}</td>
                        <td>
                          {t.ui.sidebarCursorUse} <kbd>UP</kbd> / <kbd>DOWN</kbd> {t.ui.sidebarCursorToMove}{' '}
                          <kbd>ENTER</kbd> {t.ui.sidebarCursorToExpandOpen} <kbd>ESC</kbd> {t.ui.sidebarCursorToLeave}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="shortcuts-note">{wt.shortcutsTable.note}</div>
                </div>
              )}

              {activeTab === 'tips' && (
                <div className="tips-use-cases">
                  {tipGroups.map((group) => (
                    <section className="tips-use-case" key={group.id} data-tip-group={group.id}>
                      <h2 className="tips-use-case__title">{group.title}</h2>
                      <div className="tips-container">
                        {group.items.map((item, idx) => (
                          <div className="tip-card" key={`${group.id}-${idx}`}>
                            <div className="tip-card-header">
                              <h3 className="tip-card-title">{getTipIcon(idx)}{item.title}</h3>
                              {item.badge && <span className="tip-card-badge">{item.badge}</span>}
                            </div>
                            <div className="tip-card-desc tip-card-desc--multiline">
                              {renderWelcomeDescription(item.desc)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="privacy-support-container">
                  <div className="privacy-card">
                    <h2 className="privacy-title"><LockIcon className="section-icon" />{cleanTitle(wt.privacy.title)}</h2>
                    <div className="privacy-desc">
                      {wt.privacy.desc}
                      <ul className="privacy-list">
                        {wt.privacy.bullets.map((bullet, idx) => (<li key={idx}>{bullet}</li>))}
                      </ul>
                    </div>
                  </div>

                  <div className="issues-card">
                    <h2 className="issues-title"><BugIcon className="section-icon" />{cleanTitle(wt.issues.title)}</h2>
                    <div className="issues-desc">
                      {wt.issues.hint}{' '}
                      <a href="https://github.com/the-long-ride/markdown-explorer/issues" target="_blank" rel="noopener noreferrer">
                        {wt.issues.linkText}
                      </a>
                    </div>
                    <ul className="issues-list">
                      {wt.issues.bullets.map((bullet, idx) => (<li key={idx}>{bullet}</li>))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
