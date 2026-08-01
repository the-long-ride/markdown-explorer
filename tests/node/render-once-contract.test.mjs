import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const nextExport = source.indexOf('\nexport function ', start + 1);
  return source.slice(start, nextExport === -1 ? source.length : nextExport);
}

describe('single Markdown render contract', () => {
  it('resolves one rendered document and shares it with the active state and tab cache', async () => {
    const reducer = await read('ui/src/contexts/appStateReducer.ts');
    assert.match(reducer, /resolveRenderedDocument\(action\.msg, state\.settings\)/);
    assert.match(reducer, /createContentTabFromMessage\(action\.msg, nextFileList, rendered\)/);

    const renderCase = reducer.slice(
      reducer.indexOf("case 'RENDER_CONTENT'"),
      reducer.indexOf("case 'WORKSPACE_FILES_CHANGED'"),
    );
    assert.equal((renderCase.match(/renderMarkdownClientSide\(/g) || []).length, 0);
    assert.equal((renderCase.match(/resolveRenderedDocument\(/g) || []).length, 1);
  });

  it('keeps tab construction pure by consuming pre-rendered output', async () => {
    const tabState = await read('ui/src/contexts/contentTabState.ts');
    const body = functionBody(tabState, 'createContentTabFromMessage');
    assert.match(body, /rendered:\s*RenderedDocument/);
    assert.doesNotMatch(body, /renderMarkdownClientSide\(/);
    assert.match(body, /contentHtml:\s*rendered\.html/);
  });

  it('uses host output without invoking client rendering', async () => {
    const resolver = await read('ui/src/contexts/renderedDocument.ts');
    assert.match(resolver, /if \(!msg\.markdownSource\)/);
    assert.match(resolver, /html:\s*msg\.html/);
    assert.match(resolver, /return renderMarkdownClientSide\(/);
  });
});
