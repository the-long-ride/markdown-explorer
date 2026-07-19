// =============================================================================
// components/Content/WelcomePage.tsx — Common Welcome & Guidelines Screen
// =============================================================================

import { useState } from 'react';
import { useAppState } from '../../contexts/AppStateContext';
import { getWelcomeTranslations } from '../../contexts/welcomeTranslations';
import { getTranslations } from '../../contexts/translations';
import { ACTIONS_LIST } from '../Settings/SettingsModal';
import { InteractiveBackground } from '../shared/InteractiveBackground';
import './WelcomePage.css';

import {
  ArrowRightIcon, BugIcon, ChartIcon, FolderIcon, GlobeIcon, HighlightIcon,
  KeyboardIcon, LightbulbIcon, LockIcon, ModalIcon, SearchIcon, SparklesIcon,
  TableIcon,
} from './WelcomePageIcons';
import { TIPS_CONTENT } from './welcomeTipsContent';

// =============================================================================
// Helper Utilities & Localized Labels (Emoji-free)
// =============================================================================

import { cleanTitle, TAB_LABELS } from './welcomeLabels';
import { renderWelcomeDescription } from './renderWelcomeDescription';
import { getTipIcon, renderShortcutKeys } from './welcomePageHelpers';

export function WelcomePage() {
  const isDesktop = typeof (window as any).electronAPI !== 'undefined';
  const isChrome = typeof (window as any).__chromeExtBus !== 'undefined';
  const isDesktopLike = isDesktop || isChrome;
  const { state } = useAppState();
  const currentLang = state.settings.language || 'en';
  const wt = getWelcomeTranslations(currentLang);
  const t = getTranslations(currentLang);
  
  const [activeTab, setActiveTab] = useState<'features' | 'shortcuts' | 'privacy' | 'tips'>('features');
  const labels = TAB_LABELS[currentLang] || TAB_LABELS.en;
  


  return (
    <div className="welcome-container">
      <InteractiveBackground />
      <div className="welcome-animate-wrapper">
        {/* Hero Section */}
        <div className="hero-section">
        <h1 className="hero-title">
          {wt.hero.title}
        </h1>
        <p className="hero-subtitle">
          {isDesktop ? wt.hero.descDesktop : wt.hero.descVSCode}
        </p>
        <div className="hero-meta">
          {wt.hero.createdBy}{' '}
          <a
            href="https://github.com/the-long-ride"
            target="_blank"
            rel="noopener noreferrer"
          >
            the-long-ride
          </a>{' '}
          with ❤️ · {wt.hero.repository}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
          >
            markdown-explorer
          </a>{' '}
          · {wt.hero.license}:{' '}
          <a
            href="https://github.com/the-long-ride/markdown-explorer/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT
          </a>
        </div>
        <div className="homepage-link-container">
          <a
            href="https://the-long-ride.github.io/markdown-explorer"
            target="_blank"
            rel="noopener noreferrer"
            className="homepage-link"
          >
            <GlobeIcon className="link-icon" />
            <span>https://the-long-ride.github.io/markdown-explorer</span>
          </a>
          <a
            href="https://the-long-ride.github.io/markdown-them"
            target="_blank"
            rel="noopener noreferrer"
            className="homepage-link"
          >
            <GlobeIcon className="link-icon" />
            <span>Markdown Them - privacy-first document to markdown</span>
          </a>
          {isDesktop && state.hostPlatform === 'macos' && (
            <a
              href="https://github.com/the-long-ride/markdown-explorer/blob/main/docs/macos-install.md"
              target="_blank"
              rel="noopener noreferrer"
              className="homepage-link"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="link-icon"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
              <span>{wt.hero.macosInstallBtn}</span>
            </a>
          )}
          {!isDesktop && (
            <div className="desktop-recommendation">
              {wt.hero.desktopRecommendation}
            </div>
          )}
        </div>
      </div>

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
            <div className="feature-card">
              <div className="feature-card-title">
                <FolderIcon className="card-icon" />
                {cleanTitle(wt.features.tree.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.tree.desc}
              </div>
            </div>

            {/* Feature 2: Quick Search */}
            <div className="feature-card">
              <div className="feature-card-title">
                <SearchIcon className="card-icon" />
                {cleanTitle(wt.features.search.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.search.desc}
          <div className="welcome-spacer--small">
                  <strong>
                    {isDesktop ? (
                      <>
                        <kbd>F</kbd> · <kbd>Ctrl+F</kbd> · <kbd>Ctrl+Shift+F</kbd>
                      </>
                    ) : (
                      <>
                        <kbd>K</kbd> · <kbd>Ctrl+K</kbd> · <kbd>Ctrl+Shift+K</kbd>
                      </>
                    )}
                  </strong>
                </div>
              </div>
            </div>

            {/* Feature 3: Interactive Tables */}
            <div className="feature-card">
              <div className="feature-card-title">
                <TableIcon className="card-icon" />
                {cleanTitle(wt.features.tables.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.tables.desc}
              </div>
            </div>

            {/* Feature 4: Table-to-Chart */}
            <div className="feature-card">
              <div className="feature-card-title">
                <ChartIcon className="card-icon" />
                {cleanTitle(wt.features.charts.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.charts.desc}
              </div>
            </div>

            {/* Feature 5: Syntax Highlighting & Mermaid */}
            <div className="feature-card">
              <div className="feature-card-title">
                <HighlightIcon className="card-icon" />
                {cleanTitle(wt.features.highlight.title)}
              </div>
              <div className="feature-card-desc">
                {wt.features.highlight.desc}
              </div>
            </div>

            {/* Feature 6: Media Modal */}
            <div className="feature-card">
              <div className="feature-card-title">
                <ModalIcon className="card-icon" />
                {cleanTitle(wt.features.modal.title).replace(/Media Modal/g, 'Media Viewer')}
              </div>
              <div className="feature-card-desc">
                {wt.features.modal.desc}
              </div>
            </div>

            {/* Feature 7: Keyboard Shortcuts Guide Card */}
            <div className="feature-card">
              <div className="feature-card-title">
                <KeyboardIcon className="card-icon" />
                {cleanTitle(wt.features.shortcuts.title)}
              </div>
              <div className="feature-card-desc">
                {!isDesktop && (
          <div className="welcome-spacer--medium">
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
          </div>
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
                  (act.scope === 'desktop' && isDesktopLike) ||
                  (act.scope === 'electron' && isDesktop),
                ).map((act) => {
                  const val = state.settings.keybindings?.[act.id] || "";
                  return (
                    <tr key={act.id}>
                      <td>{t.actions[act.id as keyof typeof t.actions] || act.label}</td>
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
                  <td>Sidebar cursor mode details</td>
                  <td>
                    Use <kbd>Up</kbd> / <kbd>Down</kbd> to move, <kbd>Enter</kbd> to expand/open, <kbd>Esc</kbd> to leave
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
          <div className="tips-container">
            {(TIPS_CONTENT[currentLang] || TIPS_CONTENT.en).map((item, idx) => (
              <div className="tip-card" key={idx}>
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

