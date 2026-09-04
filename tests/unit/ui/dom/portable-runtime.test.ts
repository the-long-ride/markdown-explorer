import { describe, expect, it, vi } from 'vitest';
import { installPortableContentHandlers } from '../../../../ui/src/dom/portableContentHandlers';
import { installPortableInteractionController } from '../../../../ui/src/dom/portableInteractionController';
import { installPortableMediaViewer, openPortableMediaViewer } from '../../../../ui/src/dom/portableMediaViewer';

describe('portable export interactions', () => {
  it('copies code and keeps code/section collapse interactions host-free', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    document.body.innerHTML = `
      <div class="mdn-codeblock" data-collapsed="true">
        <button id="copy" class="mdn-copy-btn" data-copied-label="Copied"><span class="tooltip-text">Copy</span></button>
        <code>const answer = 42;</code>
        <button id="toggle" class="mdn-codeblock-toggle-btn" data-label-show-more="More" data-label-show-less="Less">More</button>
      </div>
      <section class="mdn-section" data-expanded="true"><header class="mdn-section-header"></header></section>`;

    installPortableContentHandlers(document, window);
    const ui = (window as any).UI;
    ui.copyCode(document.getElementById('copy'));
    ui.toggleCodeCollapse(document.getElementById('toggle'));
    ui.collapseAll();
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('const answer = 42;');
    expect(document.querySelector('.mdn-codeblock')?.getAttribute('data-collapsed')).toBe('false');
    expect(document.querySelector('.mdn-section')?.getAttribute('data-expanded')).toBe('false');
  });

  it('delegates exported Markdown Explorer controls after removing their inline handlers', () => {
    document.body.innerHTML = `
      <section class="mdn-section" data-expanded="true">
        <header class="mdn-section-header" onclick="UI.toggleSection(this)"><span id="section-target">Section</span></header>
      </section>
      <div class="mdn-codeblock" data-collapsed="true">
        <button id="code-toggle" class="mdn-codeblock-toggle-btn" onclick="UI.toggleCodeCollapse(this)">More</button>
      </div>
      <div class="mdn-table-wrap" id="tbl-wrap">
        <input id="table-search" class="mdn-table-input" oninput="Table.filter('tbl',this.value)" />
        <button id="tbl-toggle-btn" class="mdn-table-toggle-btn" onclick="Table.toggleCollapse('tbl')">More</button>
        <button id="tbl-wrap-toggle" class="mdn-table-wrap-toggle" onclick="Table.toggleWrap('tbl',this)">Wrap</button>
        <div class="mdn-table-columns" id="tbl-columns">
          <button id="tbl-columns-toggle" class="mdn-table-columns-toggle" onclick="Table.toggleColumnMenu('tbl',event)">Columns</button>
          <div id="tbl-columns-menu" class="mdn-table-columns-menu" hidden></div>
        </div>
        <div id="tbl-view-dropdown" class="mdn-table-view-dropdown">
          <button class="mdn-table-view-select">View</button>
          <div class="mdn-table-view-menu" role="listbox">
            <button class="mdn-table-view-menu__option" data-value="bar">Bar</button>
          </div>
        </div>
        <table id="tbl" class="mdn-table">
          <thead><tr><th class="mdn-th" data-col="1" onclick="Table.sort('tbl',1)"><span id="sort-target">Value</span></th></tr></thead>
          <tbody><tr><td>1</td></tr></tbody>
        </table>
      </div>`;

    const ui = {
      toggleSection: vi.fn(),
      toggleCodeCollapse: vi.fn(),
      copyCode: vi.fn(),
      copySection: vi.fn(),
      toggleHtmlMode: vi.fn(),
      toggleCsvMode: vi.fn(),
    };
    const table = {
      toggleCollapse: vi.fn(),
      toggleWrap: vi.fn(),
      toggleColumnMenu: vi.fn(),
      filter: vi.fn(),
      sort: vi.fn(),
      showFilterMenu: vi.fn(),
      toggleViewDropdown: vi.fn(),
      switchView: vi.fn(),
      closeViewDropdown: vi.fn(),
    };
    (window as any).UI = ui;
    (window as any).Table = table;

    installPortableInteractionController(document, window);

    expect(document.querySelector('.mdn-section-header')?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('.mdn-codeblock-toggle-btn')?.hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('.mdn-table-input')?.hasAttribute('oninput')).toBe(false);
    expect(document.querySelector('.mdn-th')?.hasAttribute('onclick')).toBe(false);

    document.getElementById('section-target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('code-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('tbl-toggle-btn')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('tbl-wrap-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.getElementById('tbl-columns-toggle')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const search = document.getElementById('table-search') as HTMLInputElement;
    search.value = 'needle';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('sort-target')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.mdn-table-view-select')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector('.mdn-table-view-menu__option')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(ui.toggleSection).toHaveBeenCalledTimes(1);
    expect(ui.toggleCodeCollapse).toHaveBeenCalledTimes(1);
    expect(table.toggleCollapse).toHaveBeenCalledWith('tbl');
    expect(table.toggleWrap).toHaveBeenCalledWith('tbl', document.getElementById('tbl-wrap-toggle'));
    expect(table.toggleColumnMenu).toHaveBeenCalledTimes(1);
    expect(table.filter).toHaveBeenCalledWith('tbl', 'needle');
    expect(table.sort).toHaveBeenCalledWith('tbl', 1);
    expect(table.toggleViewDropdown).toHaveBeenCalledTimes(1);
    expect(table.switchView).toHaveBeenCalledWith('tbl', 'bar');
    expect(table.closeViewDropdown).toHaveBeenCalledWith('tbl');
  });

  it('opens images in the lightweight exported media viewer and closes with Escape', () => {
    document.body.innerHTML = '<img id="hero" src="data:image/png;base64,AA==" alt="Hero">';
    const image = document.getElementById('hero') as HTMLImageElement;
    const modal = openPortableMediaViewer(image, document);
    expect(modal?.classList.contains('mdn-export-media-viewer')).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.mdn-export-media-viewer')).toBeNull();

    installPortableMediaViewer(document);
    image.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.mdn-export-media-viewer')).not.toBeNull();
  });

  it('handles html and csv mode toggles and section/document copy with clean text', () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    document.body.innerHTML = `
      <div class="mdn-export-document">
        <section class="mdn-section" data-expanded="false">
          <header class="mdn-section-header">
            <button id="copy-section" class="mdn-section-copy-btn">Copy</button>
          </header>
          <div class="mdn-section-body">
            <p>Section body content</p>
            <span class="tooltip-text">Hidden tip</span>
          </div>
        </section>
        <div class="mdn-html-preview-wrap" data-mode="code">
          <span class="mdn-codeblock-lang" data-code-label="HTML" data-preview-label="Preview">HTML</span>
          <button class="mdn-toggle-preview-btn" data-label-show-code="Code" data-label-show-preview="Preview"><span class="tooltip-text">Preview</span></button>
          <div class="mdn-code-source"><code>&lt;div&gt;Hello&lt;/div&gt;</code></div>
          <div class="mdn-html-preview-body" style="display: none"></div>
        </div>
        <div class="mdn-csv-preview-wrap" data-mode="code">
          <span class="mdn-codeblock-lang" data-code-label="CSV" data-preview-label="Table">CSV</span>
          <button class="mdn-toggle-csv-btn" data-label-show-code="Code" data-label-show-preview="Preview"><span class="tooltip-text">Preview</span></button>
          <div class="mdn-code-source"><code>a,b</code></div>
          <div class="mdn-csv-preview-body" style="display: none"></div>
        </div>
      </div>
    `;

    installPortableContentHandlers(document, window);
    const ui = (window as any).UI;

    // Toggle HTML mode
    const htmlToggle = document.querySelector('.mdn-toggle-preview-btn') as HTMLElement;
    ui.toggleHtmlMode(htmlToggle);
    const htmlWrap = document.querySelector('.mdn-html-preview-wrap') as HTMLElement;
    expect(htmlWrap.dataset.mode).toBe('preview');

    // Toggle CSV mode
    const csvToggle = document.querySelector('.mdn-toggle-csv-btn') as HTMLElement;
    ui.toggleCsvMode(csvToggle);
    const csvWrap = document.querySelector('.mdn-csv-preview-wrap') as HTMLElement;
    expect(csvWrap.dataset.mode).toBe('preview');

    // Copy Section
    const sectionCopyBtn = document.getElementById('copy-section') as HTMLElement;
    ui.copySection(sectionCopyBtn);
    expect(writeText).toHaveBeenCalledWith('Section body content');

    // Copy Document
    writeText.mockClear();
    ui.copyDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Section body content'));

    // Expand All
    ui.expandAll();
    expect(document.querySelector('.mdn-section')?.getAttribute('data-expanded')).toBe('true');
  });
});
