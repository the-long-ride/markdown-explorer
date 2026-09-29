import { afterEach, describe, expect, it, vi } from 'vitest';
import { scopeDocumentIds } from '../../../../ui/src/document/scopeDocumentIds';
import { registerDocumentRoot, resetDocumentRoots } from '../../../../ui/src/document/activeDocumentRoot';
import { registerCopyHandlers } from '../../../../ui/src/dom/copyHandlers';

const html = '<div id="tbl_ab12cd-wrap"><table id="tbl_ab12cd"></table><button onclick="Table.sort(\'tbl_ab12cd\', 0)"></button><iframe id="html_zz99yy"></iframe></div>';

afterEach(() => {
  resetDocumentRoots();
  document.body.innerHTML = '';
});

describe('scopeDocumentIds', () => {
  it('leaves main and primary html unchanged', () => {
    expect(scopeDocumentIds(html, 'main')).toBe(html);
    expect(scopeDocumentIds(html, 'primary')).toBe(html);
  });

  it('suffixes table and iframe ids consistently in the secondary pane', () => {
    const scoped = scopeDocumentIds(html, 'secondary');
    expect(scoped).toContain('id="tbl_ab12cd_s-wrap"');
    expect(scoped).toContain('id="tbl_ab12cd_s"');
    expect(scoped).toContain("Table.sort('tbl_ab12cd_s', 0)");
    expect(scoped).toContain('id="html_zz99yy_s"');
  });

  it('is idempotent', () => {
    const once = scopeDocumentIds(html, 'secondary');
    expect(scopeDocumentIds(once, 'secondary')).toBe(once);
  });
});

describe('copySection in split panes', () => {
  it('reads markdown from the clicked pane root instead of the global source', () => {
    const copyToClipboard = vi.fn();
    const win: any = { UI: { currentMarkdownSource: '# Intro\nfrom main' }, PlatformBridge: { copyToClipboard } };
    registerCopyHandlers(win);
    const pane = document.createElement('div');
    pane.innerHTML = '<section class="mdn-section" id="intro"><div class="mdn-section-body">x</div><button id="copy"></button></section>';
    document.body.appendChild(pane);
    registerDocumentRoot({ id: 'secondary', body: pane, scroll: null, filePath: '/b.md', markdownSource: '# Intro\nfrom pane' });

    win.UI.copySection(pane.querySelector('#copy'));

    expect(copyToClipboard).toHaveBeenCalledTimes(1);
    expect(copyToClipboard.mock.calls[0][0]).toContain('from pane');
  });
});
