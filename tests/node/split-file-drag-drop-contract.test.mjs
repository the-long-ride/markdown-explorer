import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function read(path) {
  return readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');
}

const menuItems = read('ui/src/components/Sidebar/sidebarItemMenuItems.tsx');
const appShell = read('ui/src/AppShell.tsx');
const dropHelper = read('ui/src/components/Content/documentFileDrop.ts');

assert.match(menuItems, /id:\s*['"]open-in-split['"]/);
assert.match(menuItems, /requestOpenInSplit/);
assert.match(appShell, /DocumentFileDragBridge/);
assert.match(appShell, /writeDraggedDocumentPath/);
assert.match(appShell, /readDraggedDocumentPath/);
assert.match(appShell, /SET_SPLIT_PANE_FILE/);
assert.match(dropHelper, /application\/x-markdown-explorer-file/);
