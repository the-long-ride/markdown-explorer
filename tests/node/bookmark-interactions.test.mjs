import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('selection hook captures source-anchored mixed text and whole rendered objects', async () => {
  const source = await read('ui/src/components/Content/useBookmarkSelection.ts');
  assert.match(source, /captureDomBookmarkTarget/);
  assert.match(source, /selection\.isCollapsed/);
  assert.match(source, /event\.target instanceof Element/);
  assert.match(source, /openBookmarkDialogForElement/);
  assert.doesNotMatch(source, /body\.innerText/);
});

test('bookmark menu sends one source payload through the verified save command', async () => {
  const [menu, commands] = await Promise.all([
    read('ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx'),
    read('ui/src/bookmarks/bookmarkCommands.ts'),
  ]);
  assert.match(menu, /saveBookmarkCapture/);
  assert.match(menu, /state\.sourceStart/);
  assert.match(menu, /state\.sourceEnd/);
  assert.match(menu, /state\.objectIdentity/);
  assert.match(commands, /createTextBookmarkRecord/);
  assert.match(commands, /createObjectBookmarkRecord/);
});

test('link menu keeps open and copy actions and adds bookmark action only when enabled', async () => {
  const [menu, content, effects] = await Promise.all([
    read('ui/src/components/shared/LinkContextMenu.tsx'),
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/useContentEffects.ts'),
  ]);
  assert.match(menu, /onOpen/);
  assert.match(menu, /onCopy/);
  assert.match(menu, /onBookmark/);
  assert.match(menu, /bookmarkLabel/);
  assert.match(content, /openBookmarkDialogForElement/);
  assert.match(content, /onBookmark=/);
  assert.match(effects, /event\.preventDefault\(\)/);
  assert.match(effects, /resolveRenderedLink/);
});

test('native content context-menu dispatch handles bookmark objects before the normal link menu', async () => {
  const [content, effects, mainView] = await Promise.all([
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/useContentEffects.ts'),
    read('ui/src/components/Content/ContentMainView.tsx'),
  ]);
  assert.match(effects, /onBookmarkContextMenu/);
  assert.match(effects, /if \(onBookmarkContextMenu\?\.\(event\)\) return/);
  assert.match(content, /onBookmarkContextMenu: handleBookmarkContextMenu/);
  assert.doesNotMatch(mainView, /onContextMenu\?:/);
  assert.doesNotMatch(content, /onContextMenu=\{handleBookmarkContextMenu\}/);
});

test('link bookmark action opens the name dialog directly and captures the chosen bookmark target once', async () => {
  const [content, hook, menu, selectionMenu] = await Promise.all([
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Content/useBookmarkSelection.ts'),
    read('ui/src/components/shared/LinkContextMenu.tsx'),
    read('ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx'),
  ]);
  assert.match(menu, /bookmarkTarget/);
  assert.match(content, /openBookmarkDialogForElement\(linkMenu\.bookmarkTarget, linkMenu\.x, linkMenu\.y\)/);
  assert.match(hook, /openCapture\(element, x, y, 'dialog'\)/);
  assert.match(selectionMenu, /state\?\.presentation === 'dialog'/);
  assert.match(selectionMenu, /if \(!result\.ok\)/);
});
