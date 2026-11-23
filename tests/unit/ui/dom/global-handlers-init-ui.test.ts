import { afterEach, describe, expect, it } from 'vitest';
import { initGlobalHandlers } from '../../../../ui/src/dom/globalHandlers';

afterEach(() => { document.body.innerHTML = ''; });

describe('initGlobalHandlers window.UI and Sidebar', () => {
  it('installs section helpers that resync sticky headers and sidebar folder toggles', () => {
    const win = window as any;
    delete win.UI;
    delete win.Sidebar;
    initGlobalHandlers();
    const keepPreview = win.UI.openHtmlPreview;
    initGlobalHandlers();
    expect(win.UI.openHtmlPreview).toBe(keepPreview);
    document.body.innerHTML = `<div class="content__scroll"><section class="section"><div class="section__header" id="h">H</div><div class="section__content">c</div></section></div>
      <div class="tree-folder" id="f"><span id="lbl">x</span><div class="tree-folder__children is-hidden"></div></div><div class="tree-folder" id="f2"><span id="lbl2">y</span></div><span id="orphan"></span>`;
    win.UI.toggleSection(document.getElementById('h'));
    win.UI.expandAll();
    win.UI.collapseAll();
    win.UI.refresh();
    win.UI.openHtmlPreview();
    win.UI.openHtmlPreviewModal();
    win.Sidebar.toggleFolder(document.getElementById('lbl'));
    expect(document.getElementById('f')!.classList.contains('is-open')).toBe(true);
    expect(document.querySelector('.tree-folder__children')!.classList.contains('is-hidden')).toBe(false);
    win.Sidebar.toggleFolder(document.getElementById('lbl2'));
    expect(document.getElementById('f2')!.classList.contains('is-open')).toBe(true);
    win.Sidebar.toggleFolder(document.getElementById('orphan'));
  });
});
