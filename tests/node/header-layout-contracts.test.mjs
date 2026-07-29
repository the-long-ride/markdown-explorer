import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

function indexOrFail(source, token, label) {
  const index = source.indexOf(token);
  assert.notEqual(index, -1, `${label} is missing`);
  return index;
}

test('Tabs view header uses separators and places New workspace before document actions', async () => {
  const source = await read('ui/src/components/Desktop/DesktopTabBar.tsx');

  const brand = indexOrFail(source, 'className="desktop-tabbar__brand', 'brand');
  const navigationSeparator = indexOrFail(
    source,
    'className="topbar__crumb-separator desktop-tabbar__navigation-separator"',
    'navigation separator',
  );
  const navigation = indexOrFail(source, '<NavigationHeaderActions', 'navigation actions');
  const tabs = indexOrFail(source, 'className="desktop-tabbar__tabs-wrap"', 'workspace tabs');
  const newWorkspace = indexOrFail(
    source,
    'className="btn btn--icon desktop-tabbar__new',
    'New workspace button',
  );
  const documentActions = indexOrFail(source, '<DocumentHeaderActions', 'document actions');
  const moreActions = indexOrFail(source, '<ToolbarActionMenu', 'More actions');
  const windowSeparator = indexOrFail(
    source,
    'className="topbar__crumb-separator desktop-tabbar__window-separator"',
    'window-controls separator',
  );
  const windowControls = indexOrFail(
    source,
    'className="desktop-tabbar__window-controls"',
    'window controls',
  );

  assert.ok(brand < navigationSeparator);
  assert.ok(navigationSeparator < navigation);
  assert.ok(navigation < tabs);
  assert.ok(tabs < newWorkspace);
  assert.ok(newWorkspace < documentActions);
  assert.ok(documentActions < moreActions);
  assert.ok(moreActions < windowSeparator);
  assert.ok(windowSeparator < windowControls);

  const separators = source.match(/topbar__crumb-separator desktop-tabbar__/g) ?? [];
  assert.equal(separators.length, 2);
});

test('Focus view separates document actions and More actions from window controls with a crumb separator', async () => {
  const source = await read('ui/src/components/Topbar/Topbar.tsx');

  const documentActions = indexOrFail(source, '<DocumentHeaderActions', 'document actions');
  const moreActions = indexOrFail(source, '<ToolbarActionMenu', 'More actions');
  const windowSeparator = indexOrFail(
    source,
    'className="topbar__crumb-separator topbar__crumb-separator--window-controls"',
    'window-controls separator',
  );
  const windowControls = indexOrFail(
    source,
    'className="window-controls topbar__window-controls"',
    'window controls',
  );

  assert.ok(documentActions < moreActions);
  assert.ok(moreActions < windowSeparator);
  assert.ok(windowSeparator < windowControls);
  assert.doesNotMatch(source, /topbar__divider topbar__divider--actions/);
});
