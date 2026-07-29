import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readManifest = async () => JSON.parse(await readFile(new URL('../../vscode/package.json', import.meta.url), 'utf8'));
const readText = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('VS Code Explorer header opens Markdown Explorer with supplied stroke icons', async () => {
  const manifest = await readManifest();
  const openCommand = manifest.contributes.commands.find((command) => command.command === 'markdownExplorer.open');
  const explorerHeader = manifest.contributes.menus['view/title'].find((item) => item.command === 'markdownExplorer.open');

  assert.deepEqual(openCommand.icon, {
    light: './ui/assets/icons/markdown-explorer-dark-stroke.svg',
    dark: './ui/assets/icons/markdown-explorer-light-stroke.svg',
  });
  assert.equal(explorerHeader.when, 'view == workbench.explorer.fileView');
  assert.equal(explorerHeader.group, 'navigation');
  assert.equal(manifest.contributes.viewsContainers, undefined);
  assert.equal(manifest.contributes.views, undefined);

  const [lightIcon, darkIcon, readme] = await Promise.all([
    readText('../../vscode/ui/assets/icons/markdown-explorer-light-stroke.svg'),
    readText('../../vscode/ui/assets/icons/markdown-explorer-dark-stroke.svg'),
    readText('../../vscode/README.md'),
  ]);
  assert.match(lightIcon, /viewBox="80 90 864 844"/);
  assert.match(darkIcon, /viewBox="80 90 864 844"/);
  assert.match(readme, /## VS Code Extension Tutorial/);
  assert.match(readme, /Markdown Explorer button in the workspace header/);
});
