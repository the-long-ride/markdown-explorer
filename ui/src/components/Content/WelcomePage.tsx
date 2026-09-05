// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

import { useMemo, useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { ACTIONS_LIST } from '../Settings/SettingsModal';
import { getLocalizedShortcutActionLabel } from '../Settings/settingsActions';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import './WelcomePage.css';

import {
  ArrowRightIcon, BugIcon, ChartIcon, FolderIcon, GlobeIcon, HighlightIcon,
  KeyboardIcon, LightbulbIcon, LockIcon, ModalIcon, SearchIcon, SparklesIcon,
  TableIcon,
} from './WelcomePageIcons';
import { buildWelcomeTipGroups } from './welcomeTipGroups';
import { WelcomeHero } from './WelcomeHero';
import { UserManualTab } from './UserManualTab';

// =============================================================================
// Helper Utilities & Localized Labels (Emoji-free)
// =============================================================================

import { cleanTitle, TAB_LABELS } from './welcomeLabels';
import { renderWelcomeDescription } from './renderWelcomeDescription';
import { getTipIcon, renderShortcutKeys } from './welcomePageHelpers';
import { getEnabledShortcut } from '../../utils/shortcuts';

export function WelcomePage() {
  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isDesktop || isChrome;
  const { state } = useAppState();
  const supportsEditor = isDesktop || state.appRuntime === 'vscode';
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);
  const t = getTranslations(currentLang);

  const [activeTab, setActiveTab] = useState<'features' | 'manual' | 'shortcuts' | 'privacy' | 'tips'>('features');
  const labels = TAB_LABELS[currentLang] || TAB_LABELS.en;
  const tipGroups = useMemo(
    () => buildWelcomeTipGroups(currentLang, state.settings, wt.tips),
    [currentLang, state.settings, wt.tips],
  );

  return (
    <div className="welcome-container">
      <InteractiveBackground />
      <div className="welcome-animate-wrapper">
        <WelcomeHero copy={wt.hero} isDesktop={isDesktop} hostPlatform={state.hostPlatform} markdownThemLabel={t.ui.markdownThemLinkLabel} language={currentLang} />

      {/* Tabs Bar */}
      <div className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'features' ? 'active' : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <SparklesIcon className="tab-icon" />
          {labels.features}
        </button>
        <button
          className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <LightbulbIcon className="tab-icon" />
          {labels.manual}
        </button>
        <button
          className={`tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
          onClick={() => setActiveTab('shortcuts')}
        >
          <KeyboardIcon className="tab-icon" />
          {labels.shortcuts}
        </button>
        <button
          className={`tab-btn ${activeTab === 'tips' ? 'active' : ''}`}
          onClick={() => setActiveTab('tips')}
        >
          <LightbulbIcon className="tab-icon" />
          {labels.tips}
        </button>
        <button
          className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => setActiveTab('privacy')}
        >
          <LockIcon className="tab-icon" />
          {labels.privacy}
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'features' && (
          <div className="features-grid">

            {/* Feature 1: Navigation Tree */}
            {wt?.features?.tree && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <FolderIcon className="card-icon" />
                  {cleanTitle(wt.features.tree.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.tree.desc}
                </div>
              </div>
            )}

            {/* Feature 2: Quick Search */}
            {wt?.features?.search && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <SearchIcon className="card-icon" />
                  {cleanTitle(wt.features.search.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.search.desc}
                  <div className="welcome-spacer--small">
                    <strong>
                      {renderShortcutKeys(getEnabledShortcut(state.settings, 'findCurrentFile') || (isDesktop ? 'F' : 'K'))}
                      {' · '}
                      {renderShortcutKeys(getEnabledShortcut(state.settings, 'searchCurrent') || (isDesktop ? 'Ctrl+F' : 'Ctrl+K'))}
                      {isDesktop && (
                        <>
                          {' · '}
                          {renderShortcutKeys(getEnabledShortcut(state.settings, 'searchAllTabs') || 'Ctrl+Shift+F')}
                        </>
                      )}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            {/* Feature 3: Interactive Tables */}
            {wt?.features?.tables && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <TableIcon className="card-icon" />
                  {cleanTitle(wt.features.tables.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.tables.desc}
                </div>
              </div>
            )}

            {/* Feature 4: Table-to-Chart */}
            {wt?.features?.charts && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <ChartIcon className="card-icon" />
                  {cleanTitle(wt.features.charts.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.charts.desc}
                </div>
              </div>
            )}

            {/* Feature 5: Syntax Highlighting & Mermaid */}
            {wt?.features?.highlight && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <HighlightIcon className="card-icon" />
                  {cleanTitle(wt.features.highlight.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.highlight.desc}
                </div>
              </div>
            )}

            {/* Feature 6: Interactive HTML & Document Previews */}
            {wt?.features?.html && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <GlobeIcon className="card-icon" />
                  {cleanTitle(wt.features.html.title)}
                </div>
                <div className="feature-card-desc">
                  {wt.features.html.desc}
                </div>
              </div>
            )}

            {/* Feature 7: Media Modal */}
            {wt?.features?.modal && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <ModalIcon className="card-icon" />
                  {cleanTitle(wt.features.modal.title).replace(/Media Modal/g, 'Media Viewer')}
                </div>
                <div className="feature-card-desc">
                  {wt.features.modal.desc}
                </div>
              </div>
            )}

            {/* Feature 8: Keyboard Shortcuts Guide Card */}
            {wt?.features?.shortcuts && (
              <div className="feature-card">
                <div className="feature-card-title">
                  <KeyboardIcon className="card-icon" />
                  {cleanTitle(wt.features.shortcuts.title)}
                </div>
                <div className="feature-card-desc">
                  {!isDesktop && (
                    <div className="welcome-feature-card__detail">
                      {wt.features.shortcuts.vscodeDesc}
                    </div>
                  )}
                  {wt.features.shortcuts.desc}
                </div>
                <div className="feature-card-action">
                  <button
                    className="card-action-btn"
                    onClick={() => setActiveTab('shortcuts')}
                  >
                    {cleanTitle(labels.viewShortcuts)}
                    <ArrowRightIcon className="action-btn-icon" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'manual' && (
          <UserManualTab language={currentLang} settings={state.settings} />
        )}

        {activeTab === 'shortcuts' && (
          <div className="shortcuts-card">
            <h2 className="shortcuts-title">
              <KeyboardIcon className="section-icon" />
              {cleanTitle(wt.features.shortcuts.title)}
            </h2>
            {!isDesktop && (
          <div className="welcome-feature-card__detail">
                {wt.features.shortcuts.vscodeDesc}
              </div>
            )}
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
                      <td>
                        {renderShortcutKeys(val)}
                      </td>
                    </tr>
                  );
                })}
                {isDesktop && (
                  <tr>
                    <td>{t.actions.toggleFullscreen}</td>
                    <td><kbd>F11</kbd></td>
                  </tr>
                )}
                {/* Special non-customizable shortcuts */}
                <tr>
                  <td>{wt.shortcutsTable.rows.zoomModal}</td>
                  <td><kbd>{wt.shortcutsTable.rows.zoomModalShortcut}</kbd></td>
                </tr>
                <tr>
                  <td>{t.ui.sidebarCursorDetails}</td>
                  <td>
                    {t.ui.sidebarCursorUse} <kbd>UP</kbd> / <kbd>DOWN</kbd> {t.ui.sidebarCursorToMove}{' '}
                    <kbd>ENTER</kbd> {t.ui.sidebarCursorToExpandOpen} <kbd>ESC</kbd> {t.ui.sidebarCursorToLeave}
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="shortcuts-note">
              {wt.shortcutsTable.note}
            </div>
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
                        <h3 className="tip-card-title">
                          {getTipIcon(idx)}
                          {item.title}
                        </h3>
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
            {/* Privacy Pledge */}
            <div className="privacy-card">
              <h2 className="privacy-title">
                <LockIcon className="section-icon" />
                {cleanTitle(wt.privacy.title)}
              </h2>
              <div className="privacy-desc">
                {wt.privacy.desc}
                <ul className="privacy-list">
                  {wt.privacy.bullets.map((bullet, idx) => (
                    <li key={idx}>
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Report Issues */}
            <div className="issues-card">
              <h2 className="issues-title">
                <BugIcon className="section-icon" />
                {cleanTitle(wt.issues.title)}
              </h2>
              <div className="issues-desc">
                {wt.issues.hint}{' '}
                <a
                  href="https://github.com/the-long-ride/markdown-explorer/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {wt.issues.linkText}
                </a>
              </div>
              <ul className="issues-list">
                {wt.issues.bullets.map((bullet, idx) => (
                  <li key={idx}>
                    {bullet}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
