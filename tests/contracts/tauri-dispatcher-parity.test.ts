import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '../..');
const dispatcherPath = path.join(repoRoot, 'tauri/src/dispatcher.rs');
const dispatcherSrc = fs.readFileSync(dispatcherPath, 'utf8');
const dispatcherCommandsPath = path.join(repoRoot, 'tauri/src/dispatcher/commands.rs');
const dispatcherCommandsSrc = fs.readFileSync(dispatcherCommandsPath, 'utf8');
const dispatcherHandlersPath = path.join(repoRoot, 'tauri/src/dispatcher/handlers.rs');
const dispatcherHandlersSrc = fs.readFileSync(dispatcherHandlersPath, 'utf8');
const dispatcherIncrementalPath = path.join(repoRoot, 'tauri/src/dispatcher/incremental_scan.rs');
const dispatcherIncrementalSrc = fs.readFileSync(dispatcherIncrementalPath, 'utf8');
const bootstrapPath = path.join(repoRoot, 'tauri/src/core/bootstrap.rs');
const bootstrapSrc = fs.readFileSync(bootstrapPath, 'utf8');
const appStatePath = path.join(repoRoot, 'tauri/src/app_state.rs');
const appStateSrc = fs.readFileSync(appStatePath, 'utf8');
const preloadPath = path.join(repoRoot, 'tauri/src/preload/api.rs');
const preloadSrc = fs.readFileSync(preloadPath, 'utf8');
const appPath = path.join(repoRoot, 'ui/src/App.tsx');
const appSrc = fs.readFileSync(appPath, 'utf8');
const desktopTabBarPath = path.join(repoRoot, 'ui/src/components/Desktop/DesktopTabBar.tsx');
const desktopTabBarSrc = fs.readFileSync(desktopTabBarPath, 'utf8');
const topbarPath = path.join(repoRoot, 'ui/src/components/Topbar/Topbar.tsx');
const topbarSrc = fs.readFileSync(topbarPath, 'utf8');
const toolbarActionMenuPath = path.join(repoRoot, 'ui/src/components/shared/ToolbarActionMenu.tsx');
const toolbarActionMenuSrc = fs.readFileSync(toolbarActionMenuPath, 'utf8');
const welcomePagePath = path.join(repoRoot, 'ui/src/components/Content/WelcomePage.tsx');
const welcomePageSrc = fs.readFileSync(welcomePagePath, 'utf8');
const translationsPath = path.join(repoRoot, 'ui/src/contexts/translations.ts');
const translationsSrc = fs.readFileSync(translationsPath, 'utf8');
const translationsDataPath = path.join(repoRoot, 'ui/src/contexts/translationsData.ts');
const translationsDataSrc = fs.readFileSync(translationsDataPath, 'utf8');
const topbarCssPath = path.join(repoRoot, 'ui/src/styles/global/global-topbar-tabs.css');
const topbarCssSrc = fs.readFileSync(topbarCssPath, 'utf8');

const REQUIRED_DESKTOP_WEBVIEW_COMMANDS = [
  'ready', 'navigate', 'openFolder', 'openFile', 'openPath',
  'activateWorkspace', 'searchAcrossWorkspaces', 'searchWorkspace',
  'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
  'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
  'closeWorkspace', 'cancelWorkspaceScan', 'cancelAllWorkspaceScans', 'zoom-in', 'zoom-out', 'openInEditor', 'copyCode',
  'openExternal', 'openHtmlPreview', 'refresh', 'setDocumentConversion', 'downloadUpdate',
  'scheduleDownloadedUpdate', 'restartAndApplyUpdate', 'window-minimize',
  'window-maximize', 'window-close', 'updateAppearance',
  'toggle-fullscreen',
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('tauri dispatcher parity', () => {
  for (const cmd of REQUIRED_DESKTOP_WEBVIEW_COMMANDS) {
    test(`${cmd} is handled by tauri dispatcher`, () => {
      const pattern = new RegExp(`"${escapeRegex(cmd)}"\\s*=>`);
      expect(dispatcherSrc).toMatch(pattern);
    });
  }

  test('no Part A stub comments remain for implemented commands', () => {
    const stubPatterns = [
      /\/\/\s*TODO/i,
      /\/\/\s*stub/i,
      /\/\/\s*placeholder/i,
      /\/\/\s*not yet implemented/i,
      /unimplemented!\(/,
      /todo!\(/,
    ];
    for (const pattern of stubPatterns) {
      const matches = dispatcherSrc.match(new RegExp(pattern.source, 'gi'));
      expect(matches).toBeNull();
    }
  });

  test('navigate reads "path" key (not "filePath") — matches Electron IPC contract', () => {
    const electronHandlersPath = path.join(repoRoot, 'electron/core/ipc-handlers.js');
    const electronSrc = fs.readFileSync(electronHandlersPath, 'utf8');

    const electronNavigateMatch = electronSrc.match(/case\s+["']navigate["'].*?msg\.(\w+)/s);
    expect(electronNavigateMatch).not.toBeNull();
    const electronField = electronNavigateMatch![1];

    const tauriNavigateMatch = dispatcherSrc.match(/"navigate"\s*=>\s*\{[^}]*msg\.get\("(\w+)"\)/s);
    expect(tauriNavigateMatch).not.toBeNull();
    const tauriField = tauriNavigateMatch![1];

    expect(tauriField).toBe(electronField);
    expect(tauriField).toBe('path');
  });

  test('publishes updated recent workspaces immediately after saving them', () => {
    expect(dispatcherHandlersSrc).toMatch(
      /fn save_recent_workspace[\s\S]*?store\.save\(workspace_path\);[\s\S]*?emit_recent_workspaces_changed\(&self\.app, store\.load\(\)\);/,
    );
    expect(dispatcherCommandsSrc).toContain('self.save_recent_workspace(&path);');
    expect(dispatcherHandlersSrc).toContain('self.save_recent_workspace(&workspace_path);');
  });

  test('activateWorkspace reads openFirstFile from message', () => {
    const match = dispatcherSrc.match(/"activateWorkspace"\s*=>\s*\{[\s\S]*?openFirstFile[\s\S]*?msg\s*\.\s*get\("openFirstFile"\)/);
    expect(match).not.toBeNull();
  });

  test('activateWorkspace defers initial content until its current scan completes', () => {
    const activateStart = dispatcherCommandsSrc.indexOf('"activateWorkspace" =>');
    const activateEnd = dispatcherCommandsSrc.indexOf('"openRecentWorkspace" =>', activateStart);
    const activateBlock = dispatcherCommandsSrc.slice(activateStart, activateEnd);
    expect(activateBlock).toContain('self.send_workspace_data(open_first_file);');
    expect(activateBlock).not.toContain('self.send_initial_content');
    expect(dispatcherIncrementalSrc).toContain('dispatcher.send_initial_content(open_first_file);');
  });

  test('Tauri exposes current and all workspace scan cancellation', () => {
    expect(dispatcherCommandsSrc).toContain('"cancelWorkspaceScan" =>');
    expect(dispatcherCommandsSrc).toContain('"cancelAllWorkspaceScans" =>');
    expect(dispatcherCommandsSrc).toContain('workspace_scan_generation.wrapping_add(1)');
  });

  test('navigate does not read "filePath" key', () => {
    const navigateBlock = dispatcherSrc.match(/"navigate"\s*=>\s*\{[\s\S]*?\}/);
    expect(navigateBlock).not.toBeNull();
    expect(navigateBlock![0]).not.toContain('filePath');
  });

  test('fullscreen transition runs on the Tauri main UI thread', () => {
    const start = dispatcherSrc.indexOf('"toggle-fullscreen" =>');
    const end = dispatcherSrc.indexOf('"zoom-in" =>', start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(dispatcherSrc.slice(start, end)).toContain('run_on_main_thread');
  });

  test('fullscreen clears maximized state before native entry and locks movement', () => {
    const start = dispatcherSrc.indexOf('"toggle-fullscreen" =>');
    const end = dispatcherSrc.indexOf('"zoom-in" =>', start);
    const fullscreenBlock = dispatcherSrc.slice(start, end);

    expect(fullscreenBlock).toContain('FullscreenTransition::AwaitingMaximize');
    expect(fullscreenBlock).toContain('FullscreenTransition::AwaitingUnmaximize');
    expect(fullscreenBlock).toContain('window.maximize()');
    expect(fullscreenBlock).toContain('window.unmaximize()');
    expect(appStateSrc).toContain('pub enum FullscreenTransition');
    expect(bootstrapSrc).toContain('FullscreenTransition::AwaitingMaximize if is_max');
    expect(bootstrapSrc).toContain('FullscreenTransition::AwaitingUnmaximize if !is_max');
    expect(bootstrapSrc).toContain('win_for_event.set_fullscreen(true)');
    expect(bootstrapSrc.indexOf('win_for_event.unmaximize()')).toBeLessThan(
      bootstrapSrc.indexOf('win_for_event.set_fullscreen(true)'),
    );
    expect(preloadSrc).toContain("payload.command === 'fullscreenChanged'");
    expect(preloadSrc).toContain('tauriFullscreenDragLocked');
    expect(preloadSrc).toContain('e.stopImmediatePropagation()');
  });

  test('fullscreen exit completes the transient transition and restores native movement', () => {
    const start = dispatcherSrc.indexOf('"toggle-fullscreen" =>');
    const end = dispatcherSrc.indexOf('"zoom-in" =>', start);
    const fullscreenBlock = dispatcherSrc.slice(start, end);

    expect(fullscreenBlock).toContain('window.set_fullscreen(false)');
    expect(fullscreenBlock).toContain('FullscreenTransition::Idle');
    expect(preloadSrc).toContain('setTauriFullscreenDragLocked(payload.isFullscreen)');
  });

  test('fullscreen restore button exits fullscreen before maximize handling', () => {
    const start = dispatcherSrc.indexOf('"window-maximize" =>');
    const end = dispatcherSrc.indexOf('"window-close" =>', start);
    const maximizeBlock = dispatcherSrc.slice(start, end);

    expect(maximizeBlock).toContain('window.is_fullscreen()');
    expect(maximizeBlock).toContain('window.set_fullscreen(false)');
    expect(maximizeBlock).toContain('host_message::emit_fullscreen_changed(&self.app, false)');
    expect(maximizeBlock.indexOf('window.set_fullscreen(false)')).toBeLessThan(
      maximizeBlock.indexOf('window.is_maximized()'),
    );
  });

  test('Tauri fullscreen restore control routes through fullscreen toggle in UI', () => {
    for (const src of [desktopTabBarSrc, topbarSrc]) {
      expect(src).toContain("state.appRuntime === 'tauri' && isFullscreen");
      expect(src).toContain('onFullscreenToggle?.()');
      expect(src.indexOf('onFullscreenToggle?.()')).toBeLessThan(
        src.indexOf("bridge.postMessage({ command: 'window-maximize' })"),
      );
    }
  });

  test('fullscreen drag lock removes Tauri drag-region attributes until unlock', () => {
    expect(preloadSrc).toContain('data-tauri-drag-region-disabled');
    expect(preloadSrc).toContain('setTauriFullscreenDragLocked');
    expect(preloadSrc).toContain("el.removeAttribute('data-tauri-drag-region')");
    expect(preloadSrc).toContain("el.setAttribute('data-tauri-drag-region', disabledValue)");
    expect(preloadSrc).toContain('applyTauriFullscreenDragLock(document)');
  });

  test('Tauri fullscreen disables CSS app-region dragging', () => {
    expect(appSrc).toContain("state.appRuntime === 'tauri' ? ' app--tauri' : ''");
    expect(topbarCssSrc).toContain('.app--tauri.app--fullscreen');
    expect(topbarCssSrc).toContain('-webkit-app-region: no-drag !important');
    expect(topbarCssSrc).toContain('.app--tauri.app--fullscreen .desktop-tabbar');
    expect(topbarCssSrc).toContain('.app--tauri.app--fullscreen .desktop-tabbar__tabs-wrap');
    expect(topbarCssSrc).toContain('.app--tauri.app--fullscreen .topbar');
  });

  test('Tauri fullscreen resizes the WebView and remains transient', () => {
    expect(bootstrapSrc).toContain('.auto_resize()');
    expect(bootstrapSrc).toContain('StateFlags::FULLSCREEN | StateFlags::DECORATIONS');
    expect(bootstrapSrc).not.toContain('with_denylist(&["decorations"])');
  });

  test('fullscreen menu and homepage shortcut labels come from translations', () => {
    expect(translationsSrc).toContain('toggleFullscreen: string;');
    expect(translationsSrc).toContain('toggleFullscreenTooltip: string;');
    expect(translationsDataSrc.match(/toggleFullscreen:/g)?.length).toBe(9);
    expect(translationsDataSrc.match(/toggleFullscreenTooltip:/g)?.length).toBe(9);

    expect(toolbarActionMenuSrc).not.toContain('label: "Show full screen"');
    expect(toolbarActionMenuSrc).not.toContain('tooltip: "Toggle native full screen window [F11]"');
    expect(toolbarActionMenuSrc).toContain('fullscreenLabel');
    expect(toolbarActionMenuSrc).toContain('fullscreenTooltip');
    expect(toolbarActionMenuSrc).toContain('showFullscreen');
    expect(toolbarActionMenuSrc).toContain('buildShortcutTooltip(fullscreenTooltip, fullscreenShortcut)');

    expect(topbarSrc).toContain('showFullscreen={isDesktop}');
    expect(desktopTabBarSrc).toContain('showFullscreen');
    for (const src of [desktopTabBarSrc, topbarSrc]) {
      expect(src).toContain('fullscreenLabel={t.actions.toggleFullscreen}');
      expect(src).toContain('fullscreenTooltip={t.actions.toggleFullscreenTooltip}');
      expect(src).toContain('fullscreenShortcut="F11"');
    }

    expect(welcomePageSrc).not.toContain('label: "Show full screen"');
    expect(welcomePageSrc).toContain('<td>{t.actions.toggleFullscreen}</td>');
  });
});
