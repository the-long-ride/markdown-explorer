import { expect, test } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const layoutCssPath = path.resolve(
  __dirname,
  '../../ui/src/styles/global/global-layout-sidebar.css',
);
const layoutCss = fs.readFileSync(layoutCssPath, 'utf8');

test('native fullscreen keeps the in-app header and desktop tab bar visible', () => {
  expect(layoutCss).not.toMatch(
    /\.app--fullscreen\s+\.topbar\s*,\s*\.app--fullscreen\s+\.desktop-tabbar\s*\{\s*display:\s*none\s*!important;/,
  );
});
