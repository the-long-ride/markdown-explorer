import assert from 'node:assert/strict';
import test from 'node:test';
import { readProjectSource } from './read-refactored-source.mjs';

const read = readProjectSource;

test('Aurora Glass tooltips and dropdown panels use opaque backgrounds without fading contents', async () => {
  const [tooltipCss, toolbarCss] = await Promise.all([
    read('ui/src/styles/global/global-switch-tooltip-diff.css'),
    read('ui/src/styles/global/global-topbar-tabs.css'),
  ]);
  const dark = tooltipCss.match(/\[data-theme-style="glass"\] \.tooltip-text\s*\{([^}]*)\}/s)?.[1] ?? '';
  const light = tooltipCss.match(/\[data-theme-style="glass"\]\[data-theme="light"\] \.tooltip-text\s*\{([^}]*)\}/s)?.[1] ?? '';
  const hover = tooltipCss.match(/\[data-theme-style="glass"\] \.tooltip-container:hover \.tooltip-text\s*\{([^}]*)\}/s)?.[1] ?? '';
  const panel = toolbarCss.match(/\[data-theme-style="glass"\] \.toolbar-action-menu__panel\s*\{([^}]*)\}/s)?.[1] ?? '';
  const lightPanel = toolbarCss.match(/\[data-theme-style="glass"\]\[data-theme="light"\] \.toolbar-action-menu__panel\s*\{([^}]*)\}/s)?.[1] ?? '';
  for (const [name, block] of Object.entries({ dark, light, panel, lightPanel })) {
    assert.match(block, /background:\s*rgb\([^/]+\);/, `${name} must use an opaque rgb background`);
  }
  assert.match(hover, /opacity:\s*1;/);
});

test('document tabs have both close phases under 200ms and active tabs can collapse to zero', async () => {
  const [component, css, keyboard, events] = await Promise.all([
    read('ui/src/components/Content/ContentTabs.tsx'),
    read('ui/src/styles/global/global-content-tabs-focus-search.css'),
    read('ui/src/hooks/useKeyboard.ts'),
    read('ui/src/components/Content/contentTabCloseEvents.ts'),
  ]);
  assert.match(component, /CONTENT_TAB_CLOSE_FADE_MS\s*=\s*90/);
  assert.match(component, /CONTENT_TAB_CLOSE_COLLAPSE_MS\s*=\s*140/);
  assert.match(component, /closeAllTabs[\s\S]*requestTabClose/);
  assert.match(component, /prefers-reduced-motion:\s*reduce/);
  assert.match(component, /event\.preventDefault\(\)/);
  assert.match(events, /cancelable:\s*true/);
  assert.match(keyboard, /!requestAnimatedContentTabClose[\s\S]*closeContentTab/);
  assert.match(keyboard, /!requestAnimatedContentTabClose[\s\S]*closeAllContentTabs/);
  assert.match(css, /\.content-tab\.is-active\.is-closing--collapse\s*\{[^}]*flex-basis:\s*0;/s);
  for (const match of css.matchAll(/(\d+)ms/g)) {
    const duration = Number(match[1]);
    if (match.index && css.slice(Math.max(0, match.index - 220), match.index).includes('is-closing')) {
      assert.ok(duration <= 200, `close duration ${duration}ms exceeds 200ms`);
    }
  }
});

test('workspace operation metadata is attached to every folder/file open path in App', async () => {
  const app = await read('ui/src/App.tsx');
  assert.match(app, /openDroppedFolder:[\s\S]*prepareWorkspaceOpen\(\)[\s\S]*command:\s*'openFolder'[\s\S]*\.\.\.operation/);
  assert.match(app, /openDroppedFileHandle:[\s\S]*prepareWorkspaceOpen\(\)[\s\S]*command:\s*'openFileHandle'[\s\S]*\.\.\.operation/);
});

test('scan cancellation commands and operation metadata are represented in the shared protocol', async () => {
  const types = await read('ui/src/types.ts');
  assert.match(types, /interface OpenFileHandleMessage extends WorkspaceOperationMetadata/);
  assert.match(types, /interface WorkspaceOperationMetadata\s*\{[^}]*workspaceOperationId\?: string;[^}]*workspaceTabId\?: string;/s);
  assert.match(types, /command:\s*'cancelWorkspaceScan'/);
  assert.match(types, /command:\s*'cancelAllWorkspaceScans'/);
  assert.match(types, /interface WorkspaceScanProgressMessage extends WorkspaceOperationMetadata/);
});

test('loading UI remains after the desktop header and exposes current-scan cancellation', async () => {
  const view = await read('ui/src/AppView.tsx');
  const tabBarIndex = view.indexOf('<DesktopTabBar');
  const loadingIndex = view.indexOf('className="tab-loading"');
  assert.ok(tabBarIndex >= 0 && loadingIndex > tabBarIndex);
  assert.match(view, /state-screen__cancel[\s\S]*cancelCurrentWorkspaceScan/);
  assert.match(view, /activeTabId === 'home'[\s\S]*<WelcomePage/);
});

test('Close All cancels all workspace jobs before returning Home', async () => {
  const hook = await read('ui/src/hooks/useDesktopTabs.ts');
  const block = hook.match(/const closeAllTabs = useCallback\(\(\) => \{([\s\S]*?)\n  \}, \[/)?.[1] ?? '';
  assert.match(block, /cancelAllWorkspaceScans/);
  assert.ok(block.indexOf('cancelAllWorkspaceScans') < block.indexOf('setTabs'));
  assert.match(block, /dispatchEmptyWorkspace/);
});

test('UI and VS Code use the same HTML renderability heuristic', async () => {
  const [uiHelper, vscodeHelper, uiRenderer, vscodeRenderer] = await Promise.all([
    read('ui/src/markdown/htmlPreviewDocument.ts'),
    read('vscode/src/markdown/htmlPreviewDocument.ts'),
    read('ui/src/markdown/codeRenderer.ts'),
    read('vscode/src/markdown/codeRenderer.ts'),
  ]);
  const uiFunction = uiHelper.match(/export function hasRenderableHtmlContent[\s\S]*?\n\}/)?.[0];
  const vscodeFunction = vscodeHelper.match(/export function hasRenderableHtmlContent[\s\S]*?\n\}/)?.[0];
  assert.equal(uiFunction?.replace(/\r\n/g, '\n'), vscodeFunction?.replace(/\r\n/g, '\n'));
  assert.match(uiRenderer, /hasRenderableHtmlContent\(token\.content\)/);
  assert.match(vscodeRenderer, /hasRenderableHtmlContent\(token\.content\)/);
});

test('every supported language includes the scan-cancel translation', async () => {
  const data = await read('ui/src/contexts/translationsData.ts');
  const occurrences = data.match(/cancelScan:/g)?.length ?? 0;
  assert.equal(occurrences, 9);
});

test('browser hosts gate async workspace continuations with the operation that started them', async () => {
  const [chromium, website, electron] = await Promise.all([
    read('chromium-xtension/src/chrome-host.ts'),
    read('website-app/src/web-host.ts'),
    read('electron/core/runtime-workspace-handlers.js'),
  ]);
  assert.match(chromium, /function isWorkspaceOperationCurrent/);
  assert.match(chromium, /const operation = currentWorkspaceOperationMetadata\(\);[\s\S]*await pickDirectory\(\)[\s\S]*if \(!isWorkspaceOperationCurrent\(operation\)\) break;/);
  assert.match(chromium, /catch \(err\)[\s\S]*scanGeneration === workspaceScanGeneration[\s\S]*isWorkspaceOperationCurrent\(operation\)/);
  assert.match(website, /createWorkspaceOperationState/);
  assert.match(website, /workspaceOperation\.isCurrent\(operation\)/);
  assert.match(website, /await BrowserRecentWorkspaces\.getHandle\(folderPath\);[\s\S]*if \(!workspaceOperation\.isCurrent\(operation\)\) break;/);
  assert.match(electron, /function captureWorkspaceRequest/);
  assert.match(electron, /if \(!isWorkspaceRequestCurrent\(request\)\) return;/);
});

test('all runtime hosts expose current/all scan cancellation and operation scoping', async () => {
  const [electron, chromium, website, tauri] = await Promise.all([
    read('electron/core/ipc-handlers.js'),
    read('chromium-xtension/src/chrome-host.ts'),
    read('website-app/src/web-host.ts'),
    read('tauri/src/dispatcher/commands.rs'),
  ]);
  for (const [name, source] of Object.entries({ electron, chromium, website, tauri })) {
    assert.ok(source.includes('cancelWorkspaceScan'), `${name} current cancellation missing`);
    assert.ok(source.includes('cancelAllWorkspaceScans'), `${name} all cancellation missing`);
  }
  assert.match(chromium, /workspaceOperationId/);
  assert.match(website, /workspaceOperationId/);
  assert.match(tauri, /workspace_operation_id/);
});

test('Tauri async workspace messages retain the operation captured when scanning starts', async () => {
  const [hostMessage, incremental, handlers] = await Promise.all([
    read('tauri/src/host_message.rs'),
    read('tauri/src/dispatcher/incremental_scan.rs'),
    read('tauri/src/dispatcher/handlers.rs'),
  ]);
  assert.match(hostMessage, /pub struct WorkspaceOperationMetadata/);
  assert.match(hostMessage, /pub fn emit_scoped/);
  assert.match(incremental, /let operation = WorkspaceOperationMetadata::from_parts/);
  assert.match(incremental, /emit_workspace_scan_progress_scoped\([\s\S]*operation\.as_ref\(\)/);
  assert.match(incremental, /emit_workspace_files_changed_scoped\([\s\S]*operation\.as_ref\(\)/);
  assert.match(handlers, /send_initial_content_for_scan/);
  assert.match(handlers, /is_workspace_request_current/);
});

test('workspace close acknowledgements keep the operation that was closed', async () => {
  const [electronCommands, electronUpdate, chromium, website, tauri, tauriReady] = await Promise.all([
    read('electron/core/runtime-command-handlers.js'),
    read('electron/core/runtime-update-handlers.js'),
    read('chromium-xtension/src/chrome-host.ts'),
    read('website-app/src/web-host.ts'),
    read('tauri/src/dispatcher/commands.rs'),
    read('tauri/src/dispatcher/ready.rs'),
  ]);
  assert.match(electronUpdate, /const operation = \{[\s\S]*workspaceOperationId[\s\S]*handleReady\(\{ workspaceOperationMetadata: operation \}\)/);
  assert.match(electronCommands, /workspaceOperationMetadata[\s\S]*sendHostMessage\(\{ \.\.\.ackMsg, \.\.\.workspaceOperationMetadata \}\)/);
  assert.match(chromium, /case "closeWorkspace":[\s\S]*const operation = currentWorkspaceOperationMetadata\(\)[\s\S]*\.\.\.operation/);
  assert.match(website, /case 'closeWorkspace':[\s\S]*const operation = workspaceOperation\.current\(\)[\s\S]*\.\.\.operation/);
  assert.match(tauri, /"closeWorkspace" => \{[\s\S]*WorkspaceOperationMetadata::from_parts[\s\S]*handle_ready\(&ready_message\)/);
  assert.match(tauriReady, /emit_ready_ack_scoped\(&self\.app, &ack, operation\.as_ref\(\)\)/);
  assert.match(tauriReady, /emit_render_content_empty_welcome_scoped\([\s\S]*operation\.as_ref\(\)/);
});

test('switching away from a loading workspace clears the cancelled tab loading marker', async () => {
  const hook = await read('ui/src/hooks/useDesktopTabs.ts');
  assert.match(hook, /markCancelledOperationIdle[\s\S]*operation\.workspaceTabId[\s\S]*workspaceLoadState === 'loading'[\s\S]*workspaceLoadState: 'idle'[\s\S]*workspaceOperationId: undefined/);
});

test('watch refreshes verify workspace generation and operation before publishing', async () => {
  const [electron, tauri, tauriRefresh] = await Promise.all([
    read('electron/core/runtime-workspace-handlers.js'),
    read('tauri/src/dispatcher/handlers.rs'),
    read('tauri/src/dispatcher/refresh.rs'),
  ]);
  assert.match(electron, /async function sendWorkspaceFilesChanged\(\)[\s\S]*scanGeneration[\s\S]*isWorkspaceRefreshCurrent[\s\S]*return false/);
  assert.match(tauri, /pub\(super\) fn send_workspace_files_changed\(&self\) -> bool[\s\S]*scan_generation[\s\S]*operation[\s\S]*return false/);
  assert.match(tauriRefresh, /if !self\.send_workspace_files_changed\(\) \{[\s\S]*return;/);
});
