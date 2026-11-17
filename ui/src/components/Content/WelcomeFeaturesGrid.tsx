import type { AppSettings } from '../../themeTypes';
import type { WelcomeTranslations } from '../../contexts/welcomeTranslations';
import { cleanTitle } from './welcomeLabels';
import { renderShortcutKeys } from './welcomePageHelpers';
import { getEnabledShortcut } from '../../utils/shortcuts';
import {
  ArrowRightIcon,
  BookmarkFeatureIcon,
  ChartIcon,
  EditorIcon,
  ExportIcon,
  FolderIcon,
  GitBranchIcon,
  GlobeIcon,
  HighlightIcon,
  InsightsIcon,
  KeyboardIcon,
  ModalIcon,
  PaletteThemeIcon,
  SearchIcon,
  TableIcon,
  TocOutlineIcon,
} from './WelcomePageIcons';

export interface WelcomeFeaturesGridProps {
  features?: WelcomeTranslations['features'] & Partial<Record<'editor' | 'insights' | 'git' | 'export' | 'outline' | 'bookmarks' | 'themes', { title: string; desc: string }>>;
  settings: AppSettings;
  isDesktop: boolean;
  supportsEditor: boolean;
  viewShortcutsLabel: string;
  onViewShortcuts: () => void;
}

export function WelcomeFeaturesGrid({
  features,
  settings,
  isDesktop,
  supportsEditor,
  viewShortcutsLabel,
  onViewShortcuts,
}: WelcomeFeaturesGridProps) {
  return (
    <div className="features-grid">
      {/* 1. File Tree */}
      {features?.tree && (
        <div className="feature-card">
          <div className="feature-card-title"><FolderIcon className="card-icon" />{cleanTitle(features.tree.title)}</div>
          <div className="feature-card-desc">{features.tree.desc}</div>
        </div>
      )}

      {/* 2. Quick Search */}
      {features?.search && (
        <div className="feature-card">
          <div className="feature-card-title"><SearchIcon className="card-icon" />{cleanTitle(features.search.title)}</div>
          <div className="feature-card-desc">
            {features.search.desc}
            <div className="welcome-spacer--small">
              <strong>
                {renderShortcutKeys(getEnabledShortcut(settings, 'findCurrentFile') || (isDesktop ? 'F' : 'K'))}
                {' · '}
                {renderShortcutKeys(getEnabledShortcut(settings, 'searchCurrent') || (isDesktop ? 'Ctrl+F' : 'Ctrl+K'))}
                {isDesktop && (<>{' · '}{renderShortcutKeys(getEnabledShortcut(settings, 'searchAllTabs') || 'Ctrl+Shift+F')}</>)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 3. Rich Editor */}
      {features?.editor && (
        <div className="feature-card">
          <div className="feature-card-title"><EditorIcon className="card-icon" />{cleanTitle(features.editor.title)}</div>
          <div className="feature-card-desc">
            {features.editor.desc}
            {supportsEditor && (
              <div className="welcome-spacer--small">
                <strong>
                  {renderShortcutKeys(getEnabledShortcut(settings, 'editCurrentDocument') || (isDesktop ? 'Ctrl+E' : 'Ctrl+Alt+E'))}
                  {' · '}
                  {renderShortcutKeys(getEnabledShortcut(settings, 'saveCurrentDocument') || 'Ctrl+S')}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Interactive Tables */}
      {features?.tables && (
        <div className="feature-card">
          <div className="feature-card-title"><TableIcon className="card-icon" />{cleanTitle(features.tables.title)}</div>
          <div className="feature-card-desc">{features.tables.desc}</div>
        </div>
      )}

      {/* 5. Table Charts */}
      {features?.charts && (
        <div className="feature-card">
          <div className="feature-card-title"><ChartIcon className="card-icon" />{cleanTitle(features.charts.title)}</div>
          <div className="feature-card-desc">{features.charts.desc}</div>
        </div>
      )}

      {/* 6. Syntax Highlighting */}
      {features?.highlight && (
        <div className="feature-card">
          <div className="feature-card-title"><HighlightIcon className="card-icon" />{cleanTitle(features.highlight.title)}</div>
          <div className="feature-card-desc">{features.highlight.desc}</div>
        </div>
      )}

      {/* 7. Workspace Insights */}
      {features?.insights && (
        <div className="feature-card">
          <div className="feature-card-title"><InsightsIcon className="card-icon" />{cleanTitle(features.insights.title)}</div>
          <div className="feature-card-desc">
            {features.insights.desc}
            {isDesktop && (
              <div className="welcome-spacer--small">
                <strong>
                  {renderShortcutKeys(getEnabledShortcut(settings, 'toggleWorkspaceInsights') || 'Ctrl+Alt+I')}
                </strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. Git History */}
      {features?.git && (
        <div className="feature-card">
          <div className="feature-card-title"><GitBranchIcon className="card-icon" />{cleanTitle(features.git.title)}</div>
          <div className="feature-card-desc">{features.git.desc}</div>
        </div>
      )}

      {/* 9. Export Center */}
      {features?.export && (
        <div className="feature-card">
          <div className="feature-card-title"><ExportIcon className="card-icon" />{cleanTitle(features.export.title)}</div>
          <div className="feature-card-desc">{features.export.desc}</div>
        </div>
      )}

      {/* 10. Table of Contents & Outline */}
      {features?.outline && (
        <div className="feature-card">
          <div className="feature-card-title"><TocOutlineIcon className="card-icon" />{cleanTitle(features.outline.title)}</div>
          <div className="feature-card-desc">
            {features.outline.desc}
            <div className="welcome-spacer--small">
              <strong>
                {renderShortcutKeys(getEnabledShortcut(settings, 'toggleToc') || (isDesktop ? 'Ctrl+T' : 'Alt+C'))}
                {isDesktop && (
                  <>
                    {' · '}
                    {renderShortcutKeys(getEnabledShortcut(settings, 'collapseAll') || 'Ctrl+Shift+X')}
                    {' · '}
                    {renderShortcutKeys(getEnabledShortcut(settings, 'expandAll') || 'Ctrl+Shift+E')}
                  </>
                )}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 11. Bookmarks */}
      {features?.bookmarks && (
        <div className="feature-card">
          <div className="feature-card-title"><BookmarkFeatureIcon className="card-icon" />{cleanTitle(features.bookmarks.title)}</div>
          <div className="feature-card-desc">
            {features.bookmarks.desc}
            <div className="welcome-spacer--small">
              <strong>
                {renderShortcutKeys(getEnabledShortcut(settings, 'openBookmarks') || (isDesktop ? 'Ctrl+Shift+B' : 'Alt+Shift+B'))}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 12. HTML Sandboxes */}
      {features?.html && (
        <div className="feature-card">
          <div className="feature-card-title"><GlobeIcon className="card-icon" />{cleanTitle(features.html.title)}</div>
          <div className="feature-card-desc">
            {features.html.desc}
            <div className="welcome-spacer--small">
              <strong>
                {renderShortcutKeys(getEnabledShortcut(settings, 'toggleHtmlPreview') || 'Ctrl+Alt+H')}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 13. Media Viewer */}
      {features?.modal && (
        <div className="feature-card">
          <div className="feature-card-title"><ModalIcon className="card-icon" />{cleanTitle(features.modal.title).replace(/Media Modal/g, 'Media Viewer')}</div>
          <div className="feature-card-desc">{features.modal.desc}</div>
        </div>
      )}

      {/* 14. Themes & Typography */}
      {features?.themes && (
        <div className="feature-card">
          <div className="feature-card-title"><PaletteThemeIcon className="card-icon" />{cleanTitle(features.themes.title)}</div>
          <div className="feature-card-desc">
            {features.themes.desc}
            <div className="welcome-spacer--small">
              <strong>
                {renderShortcutKeys(getEnabledShortcut(settings, 'toggleTheme') || (isDesktop ? 'Ctrl+L' : 'Ctrl+Shift+L'))}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* 15. Keyboard Shortcuts */}
      {features?.shortcuts && (
        <div className="feature-card">
          <div className="feature-card-title"><KeyboardIcon className="card-icon" />{cleanTitle(features.shortcuts.title)}</div>
          <div className="feature-card-desc">
            {!isDesktop && (<div className="welcome-feature-card__detail">{features.shortcuts.vscodeDesc}</div>)}
            {features.shortcuts.desc}
          </div>
          <div className="feature-card-action">
            <button className="card-action-btn" onClick={onViewShortcuts}>
              {cleanTitle(viewShortcutsLabel)}<ArrowRightIcon className="action-btn-icon" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
