import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readManifest = async () => JSON.parse(await readFile(new URL('../../vscode/package.json', import.meta.url), 'utf8'));
const readText = async (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('VS Code Explorer header opens Markdown Explorer with supplied stroke icons', async () => {
  const manifest = await readManifest();
  const openCommand = manifest.contributes.commands.find((command) => command.command === 'markdownExplorer.open');
  const openFolderCommand = manifest.contributes.commands.find((command) => command.command === 'markdownExplorer.openFolder');
  const explorerHeader = manifest.contributes.menus['view/title'].find((item) => item.command === 'markdownExplorer.open');
  const folderContext = manifest.contributes.menus['explorer/context'].find((item) => item.command === 'markdownExplorer.openFolder');

  assert.deepEqual(openCommand.icon, {
    light: './ui/assets/icons/markdown-explorer-dark-stroke.svg',
    dark: './ui/assets/icons/markdown-explorer-light-stroke.svg',
  });
  assert.equal(openFolderCommand.title, 'Open Folder in Markdown Explorer');
  assert.equal(folderContext.when, 'explorerResourceIsFolder');
  assert.equal(folderContext.group, 'navigation');
  assert.equal(explorerHeader.when, 'view == workbench.explorer.fileView');
  assert.equal(explorerHeader.group, 'navigation');
  assert.equal(manifest.contributes.viewsContainers, undefined);
  assert.equal(manifest.contributes.views, undefined);

  const readIcon = async (filename) => {
    try {
      return await readText(`../../vscode/ui/assets/icons/${filename}`);
    } catch {
      return await readText(`../../ui/assets/icons/${filename}`);
    }
  };

  const [lightIcon, darkIcon, readme] = await Promise.all([
    readIcon('markdown-explorer-light-stroke.svg'),
    readIcon('markdown-explorer-dark-stroke.svg'),
    readText('../../vscode/README.md'),
  ]);
  assert.match(lightIcon, /viewBox="80 90 864 844"/);
  assert.match(darkIcon, /viewBox="80 90 864 844"/);
  assert.match(readme, /## VS Code Extension Tutorial/);
  assert.match(readme, /Markdown Explorer button in the workspace header/);
  assert.match(readme, /Open Folder in Markdown Explorer/);
});
