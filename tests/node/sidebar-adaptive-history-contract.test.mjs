import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('sidebar tab registry supports optional bookmarks and capability-aware history', async () => {
  const [helper, sidebar, model] = await Promise.all([
    read('ui/src/components/Sidebar/sidebarTabs.ts'),
    read('ui/src/components/Sidebar/Sidebar.tsx'),
    read('ui/src/contexts/appStateModel.ts'),
  ]);

  assert.match(model, /export type SidebarTabId = 'files' \| 'search' \| 'bookmarks' \| 'history'/);
  assert.match(helper, /buildVisibleSidebarTabs/);
  assert.match(helper, /id: 'files'/);
  assert.match(helper, /id: 'search'/);
  assert.match(helper, /if \(input\.bookmarksEnabled\)/);
  assert.match(helper, /if \(input\.historyEnabled\)/);
  assert.match(sidebar, /historyEnabled = state\.settings\.historySidebarEnabled && repositoryHistoryCapability\?\.supported === true/);
  assert.match(sidebar, /useRepositorySnapshot\(\)/);
  assert.match(sidebar, /isHistory && !historyEnabled/);
  assert.match(sidebar, /SET_SIDEBAR_ACTIVE_TAB", tab: "files"/);
  assert.match(sidebar, /sidebarTabIndex\(visibleTabs, prevTab\)/);
  assert.match(sidebar, /sidebarTabIndex\(visibleTabs, currentTab\)/);
});

test('more than three visible sidebar tabs switch to icon-only accessible tooltip buttons', async () => {
  const [header, css] = await Promise.all([
    read('ui/src/components/Sidebar/SidebarTabsHeader.tsx'),
    read('ui/src/styles/global/global-shell-control-sizing.css'),
  ]);

  assert.match(header, /const iconOnly = tabs\.length > 3/);
  assert.match(header, /<TooltipButton/);
  assert.match(header, /aria-label=\{tab\.label\}/);
  assert.match(header, /tooltip=\{tab\.label\}/);
  assert.match(header, /!iconOnly && <span className="sidebar__tab-label">\{tab\.label\}<\/span>/);
  assert.match(css, /\.sidebar__tab-strip\.is-icon-only/);
  assert.match(css, /\.sidebar__tab-strip\.is-icon-only \.sidebar__tab-btn/);
});
