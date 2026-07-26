import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileUrl } from '../../ui/src/dom/localFileUrl.ts';
import { computeSidebarItemMenuPosition } from '../../ui/src/components/Sidebar/sidebarItemMenuPosition.ts';
import { supportsLocalFileBrowserOpen } from '../../ui/src/dom/localFileBrowserSupport.ts';

test('pathToFileUrl preserves drive roots and escapes URL-significant file characters', () => {
  assert.equal(
    pathToFileUrl('C:\\Docs\\demo #1?.html'),
    'file:///C:/Docs/demo%20%231%3F.html',
  );
  assert.equal(
    pathToFileUrl('/Users/demo/site #1?.html'),
    'file:///Users/demo/site%20%231%3F.html',
  );
});

test('pathToFileUrl supports Windows UNC paths', () => {
  assert.equal(
    pathToFileUrl('\\\\server\\shared docs\\demo.html'),
    'file://server/shared%20docs/demo.html',
  );
});

test('sidebar item menu aligns to the three-dot button right edge and flips above near the viewport bottom', () => {
  const below = computeSidebarItemMenuPosition({
    anchorRect: { top: 100, bottom: 124, right: 280 },
    sidebarRect: { left: 0, right: 300 },
    menuWidth: 248,
    menuHeight: 44,
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.deepEqual(below, { left: 32, top: 128, placement: 'below' });

  const above = computeSidebarItemMenuPosition({
    anchorRect: { top: 760, bottom: 784, right: 280 },
    sidebarRect: { left: 0, right: 300 },
    menuWidth: 248,
    menuHeight: 80,
    viewportWidth: 1280,
    viewportHeight: 800,
  });
  assert.deepEqual(above, { left: 32, top: 676, placement: 'above' });
});

test('local HTML files can open in the system browser outside web and PWA runtimes', () => {
  assert.equal(supportsLocalFileBrowserOpen('desktop'), true);
  assert.equal(supportsLocalFileBrowserOpen('tauri'), true);
  assert.equal(supportsLocalFileBrowserOpen('vscode'), true);
  assert.equal(supportsLocalFileBrowserOpen('chrome'), false);
});
