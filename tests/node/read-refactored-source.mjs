import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCE_GROUPS = new Map(Object.entries({
  'chromium-xtension/src/chrome-host.ts': [
    'chromium-xtension/src/chrome-host.ts',
    'chromium-xtension/src/chrome-host-search.ts',
    'chromium-xtension/src/chrome-host-utils.ts',
    'chromium-xtension/src/workspace-operation-state.ts',
  ],
  'electron/core/runtime-command-handlers.js': [
    'electron/core/runtime-command-handlers.js',
    'electron/core/runtime-command-search-handlers.js',
  ],
  'electron/core/runtime-workspace-handlers.js': [
    'electron/core/runtime-workspace-handlers.js',
    'electron/core/runtime-workspace-resources.js',
    'electron/core/runtime-workspace-search.js',
  ],
  'tauri/src/dispatcher/commands.rs': [
    'tauri/src/dispatcher/commands.rs',
    'tauri/src/dispatcher/commands_workspace.rs',
    'tauri/src/dispatcher/commands_external.rs',
    'tauri/src/dispatcher/commands_window_update.rs',
  ],
  'tauri/src/dispatcher/handlers.rs': [
    'tauri/src/dispatcher/handlers.rs',
    'tauri/src/dispatcher/content_handlers.rs',
  ],
  'ui/src/App.tsx': [
    'ui/src/App.tsx',
    'ui/src/useAppUpdateActions.ts',
  ],
  'ui/src/components/Content/Content.tsx': [
    'ui/src/components/Content/Content.tsx',
    'ui/src/components/Content/ContentMainView.tsx',
    'ui/src/components/Content/useContentEffects.ts',
    'ui/src/components/Content/useContentNavigationEffects.ts',
    'ui/src/components/Content/useContentScrollMemory.ts',
  ],
  'ui/src/components/Content/ContentTabs.tsx': [
    'ui/src/components/Content/ContentTabs.tsx',
    'ui/src/components/Content/ContentTabItem.tsx',
    'ui/src/components/Content/contentTabContextMenuItems.tsx',
    'ui/src/components/Content/useContentTabsScrollbar.ts',
  ],
  'ui/src/components/Content/scheduleContentEnhancements.ts': [
    'ui/src/components/Content/scheduleContentEnhancements.ts',
    'ui/src/components/Content/contentEnhancementScheduler.ts',
    'ui/src/components/Content/runContentEnhancements.ts',
  ],
  'ui/src/components/Content/WelcomePage.tsx': [
    'ui/src/components/Content/WelcomePage.tsx',
    'ui/src/components/Content/WelcomeHero.tsx',
    'ui/src/components/Content/welcomeTipGroups.ts',
  ],
  'ui/src/components/Desktop/DesktopTabBar.tsx': [
    'ui/src/components/Desktop/DesktopTabBar.tsx',
    'ui/src/components/Desktop/DesktopTabItem.tsx',
    'ui/src/components/Desktop/DesktopTabContextMenu.tsx',
  ],
  'ui/src/components/Settings/SettingsModal.tsx': [
    'ui/src/components/Settings/SettingsModal.tsx',
    'ui/src/components/Settings/settingsModalData.ts',
  ],
  'ui/src/components/Sidebar/Sidebar.tsx': [
    'ui/src/components/Sidebar/Sidebar.tsx',
    'ui/src/components/Sidebar/sidebarItemMenuItems.tsx',
    'ui/src/components/Sidebar/sidebarTreeFiltering.ts',
  ],
  'ui/src/contexts/appStateReducer.ts': [
    'ui/src/contexts/appStateReducer.ts',
    'ui/src/contexts/reducers/settingsUiReducer.ts',
  ],
  'ui/src/contexts/translations.ts': [
    'ui/src/contexts/translations.ts',
    'ui/src/contexts/translationTypes.ts',
  ],
  'ui/src/hooks/useDesktopTabs.ts': [
    'ui/src/hooks/useDesktopTabs.ts',
    'ui/src/hooks/useDesktopTabManagement.ts',
    'ui/src/hooks/useDesktopTabSearchSync.ts',
  ],
  'ui/src/markdown/highlighter.ts': [
    'ui/src/markdown/highlighter.ts',
    'ui/src/markdown/highlighting/interpolations.ts',
    'ui/src/markdown/highlighting/terminal.ts',
    'ui/src/markdown/highlighting/xml.ts',
  ],
  'ui/src/styles/global/global-code-blocks.css': [
    'ui/src/styles/global/global-code-blocks.css',
    'ui/src/styles/global/global-code-syntax.css',
  ],
  'ui/src/styles/global/global-markdown-foundation.css': [
    'ui/src/styles/global/global-markdown-foundation.css',
    'ui/src/styles/global/global-markdown-structures.css',
  ],
  'ui/src/styles/global/global-topbar-tabs.css': [
    'ui/src/styles/global/global-topbar-tabs.css',
    'ui/src/styles/global/global-topbar-actions.css',
    'ui/src/styles/global/global-workspace-tabs.css',
    'ui/src/styles/global/global-tab-actions-menus.css',
  ],
  'ui/src/styles/tokens/tokens-style-foundation.css': [
    'ui/src/styles/tokens/tokens-style-foundation.css',
    'ui/src/styles/tokens/tokens-style-vivid.css',
  ],
  'ui/src/types.ts': [
    'ui/src/types.ts',
    'ui/src/types/files.ts',
    'ui/src/types/content.ts',
    'ui/src/types/settings.ts',
    'ui/src/types/hostMessages.ts',
    'ui/src/types/webviewMessages.ts',
    'ui/src/types/index.ts',
  ],
  'vscode/src/core/panel.ts': [
    'vscode/src/core/panel.ts',
    'vscode/src/core/panelMedia.ts',
    'vscode/src/core/panelNavigationHandler.ts',
    'vscode/src/core/panelWorkspaceResources.ts',
  ],
  'website-app/src/web-host.ts': [
    'website-app/src/web-host.ts',
    'website-app/src/web-test-message-router.ts',
    'website-app/src/web-file-utility-router.ts',
    'chromium-xtension/src/chrome-host-utils.ts',
    'chromium-xtension/src/workspace-operation-state.ts',
  ],
}));

export async function readProjectSource(file) {
  const paths = SOURCE_GROUPS.get(file) ?? [file];
  const parts = await Promise.all(paths.map(path => readFile(resolve(process.cwd(), path), 'utf8')));
  return parts.join('\n');
}

export function readProjectSourceSync(file) {
  const paths = SOURCE_GROUPS.get(file) ?? [file];
  return paths.map(path => readFileSync(resolve(process.cwd(), path), 'utf8')).join('\n');
}
