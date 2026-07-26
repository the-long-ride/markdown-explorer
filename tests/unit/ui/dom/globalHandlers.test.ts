import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  toggleSection,
  expandAll,
  collapseAll,
  setHtmlMode,
  toggleHtmlMode,
  setCsvMode,
  toggleCsvMode,
  triggerToggleCodeCollapse,
  initGlobalHandlers,
} from '../../../../ui/src/dom/globalHandlers';

describe('globalHandlers pure functions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('toggleSection', () => {
    it('toggles expanded section to collapsed', () => {
      const section = document.createElement('div');
      section.className = 'mdn-section';
      section.dataset.expanded = 'true';
      const header = document.createElement('div');
      header.setAttribute('aria-expanded', 'true');
      section.appendChild(header);
      document.body.appendChild(section);

      toggleSection(header);
      expect(section.dataset.expanded).toBe('false');
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    it('toggles collapsed section to expanded', () => {
      const section = document.createElement('div');
      section.className = 'mdn-section';
      section.dataset.expanded = 'false';
      const header = document.createElement('div');
      section.appendChild(header);
      document.body.appendChild(section);

      toggleSection(header);
      expect(section.dataset.expanded).toBe('true');
    });

    it('does nothing when header is not in a section', () => {
      const header = document.createElement('div');
      document.body.appendChild(header);

      toggleSection(header);
      expect(header.getAttribute('aria-expanded')).toBeNull();
    });
  });

  describe('expandAll', () => {
    it('expands all sections', () => {
      document.body.innerHTML = `
        <div class="mdn-section" data-expanded="false"></div>
        <div class="mdn-section" data-expanded="false"></div>
      `;
      expandAll();
      document.querySelectorAll('.mdn-section').forEach((s) => {
        expect((s as HTMLElement).dataset.expanded).toBe('true');
      });
    });
  });

  describe('collapseAll', () => {
    it('collapses all sections', () => {
      document.body.innerHTML = `
        <div class="mdn-section" data-expanded="true"></div>
        <div class="mdn-section" data-expanded="true"></div>
      `;
      collapseAll();
      document.querySelectorAll('.mdn-section').forEach((s) => {
        expect((s as HTMLElement).dataset.expanded).toBe('false');
      });
    });
  });

  describe('setHtmlMode', () => {
    it('sets preview mode', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.innerHTML = `
        <span class="mdn-codeblock-lang">HTML</span>
        <div class="mdn-html-preview-body" style="display: none"></div>
        <div class="mdn-code-source" style="display: flex"><div class="mdn-codeblock-body"></div></div>
        <button class="mdn-toggle-preview-btn"><span class="tooltip-text">Show Preview</span></button>
      `;
      document.body.appendChild(wrap);

      setHtmlMode(wrap, 'preview');
      expect(wrap.dataset.mode).toBe('preview');
      expect(wrap.querySelector('.mdn-codeblock-lang')!.textContent).toBe('HTML Preview');
      expect((wrap.querySelector('.mdn-html-preview-body') as HTMLElement).style.display).toBe('');
      expect((wrap.querySelector('.mdn-code-source') as HTMLElement).style.display).toBe('none');
      expect(wrap.querySelector('.tooltip-text')!.textContent).toBe('Show Code');
    });

    it('sets code mode', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.innerHTML = `
        <span class="mdn-codeblock-lang">HTML</span>
        <div class="mdn-html-preview-body"></div>
        <div class="mdn-code-source"><div class="mdn-codeblock-body"></div></div>
        <button class="mdn-toggle-preview-btn"><span class="tooltip-text">Show Preview</span></button>
      `;
      document.body.appendChild(wrap);

      setHtmlMode(wrap, 'code');
      expect(wrap.dataset.mode).toBe('code');
      expect(wrap.querySelector('.mdn-codeblock-lang')!.textContent).toBe('HTML');
      expect((wrap.querySelector('.mdn-html-preview-body') as HTMLElement).style.display).toBe('none');
      expect((wrap.querySelector('.mdn-code-source') as HTMLElement).style.display).toBe('');
      expect(wrap.querySelector('.tooltip-text')!.textContent).toBe('Show Preview');
    });

    it('handles missing elements gracefully', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      document.body.appendChild(wrap);

      expect(() => setHtmlMode(wrap, 'preview')).not.toThrow();
      expect(wrap.dataset.mode).toBe('preview');
    });
  });

  describe('toggleHtmlMode', () => {
    it('toggles from preview to code', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.mode = 'preview';
      const btn = document.createElement('button');
      btn.className = 'mdn-toggle-preview-btn';
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      toggleHtmlMode(btn);
      expect(wrap.dataset.mode).toBe('code');
    });

    it('toggles from code to preview', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.mode = 'code';
      const btn = document.createElement('button');
      btn.className = 'mdn-toggle-preview-btn';
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      toggleHtmlMode(btn);
      expect(wrap.dataset.mode).toBe('preview');
    });

    it('defaults to preview when no mode set', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      const btn = document.createElement('button');
      btn.className = 'mdn-toggle-preview-btn';
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      toggleHtmlMode(btn);
      expect(wrap.dataset.mode).toBe('code');
    });

    it('does nothing when not inside codeblock', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);

      toggleHtmlMode(btn);
      expect(document.querySelector('.mdn-codeblock')).toBeNull();
    });
  });

  describe('CSV preview mode', () => {
    it('shows the parsed table and hides the code source in preview mode', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock mdn-csv-preview-wrap" data-mode="code">
          <span class="mdn-codeblock-lang" data-code-label="CSV" data-preview-label="CSV Preview">CSV</span>
          <div class="mdn-csv-preview-body" style="display:none"></div>
          <div class="mdn-code-source"></div>
          <button class="mdn-toggle-csv-btn" data-label-show-code="Show Code" data-label-show-preview="Show Preview"><span class="tooltip-text"></span><svg></svg></button>
        </div>
      `;
      const wrap = document.querySelector('.mdn-csv-preview-wrap') as HTMLElement;

      setCsvMode(wrap, 'preview');

      expect(wrap.dataset.mode).toBe('preview');
      expect(document.querySelector('.mdn-codeblock-lang')?.textContent).toBe('CSV Preview');
      expect((document.querySelector('.mdn-csv-preview-body') as HTMLElement).style.display).toBe('');
      expect((document.querySelector('.mdn-code-source') as HTMLElement).style.display).toBe('none');
      expect(document.querySelector('.mdn-toggle-csv-btn')?.getAttribute('aria-label')).toBe('Show Code');
    });

    it('shows source code and hides the parsed table in code mode', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock mdn-csv-preview-wrap" data-mode="preview">
          <span class="mdn-codeblock-lang" data-code-label="TSV" data-preview-label="TSV Preview">TSV Preview</span>
          <div class="mdn-csv-preview-body"></div>
          <div class="mdn-code-source" style="display:none"></div>
          <button class="mdn-toggle-csv-btn" data-label-show-code="Show Code" data-label-show-preview="Show Preview"><span class="tooltip-text"></span><svg></svg></button>
        </div>
      `;
      const wrap = document.querySelector('.mdn-csv-preview-wrap') as HTMLElement;

      setCsvMode(wrap, 'code');

      expect(document.querySelector('.mdn-codeblock-lang')?.textContent).toBe('TSV');
      expect((document.querySelector('.mdn-csv-preview-body') as HTMLElement).style.display).toBe('none');
      expect((document.querySelector('.mdn-code-source') as HTMLElement).style.display).toBe('');
      expect(document.querySelector('.mdn-toggle-csv-btn')?.getAttribute('aria-label')).toBe('Show Preview');
    });

    it('toggles the nearest CSV preview block', () => {
      document.body.innerHTML = `
        <div class="mdn-csv-preview-wrap" data-mode="preview">
          <button class="mdn-toggle-csv-btn"></button>
        </div>
      `;
      toggleCsvMode(document.querySelector('.mdn-toggle-csv-btn') as HTMLElement);
      expect((document.querySelector('.mdn-csv-preview-wrap') as HTMLElement).dataset.mode).toBe('code');
    });
  });

  describe('triggerToggleCodeCollapse', () => {
    it('toggles from collapsed to expanded', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.collapsed = 'true';
      const btn = document.createElement('button');
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      triggerToggleCodeCollapse(btn);
      expect(wrap.dataset.collapsed).toBe('false');
      expect(btn.textContent).toBe('Show Less');
    });

    it('toggles from expanded to collapsed', () => {
      const wrap = document.createElement('div');
      wrap.className = 'mdn-codeblock';
      wrap.dataset.collapsed = 'false';
      const btn = document.createElement('button');
      wrap.appendChild(btn);
      document.body.appendChild(wrap);

      triggerToggleCodeCollapse(btn);
      expect(wrap.dataset.collapsed).toBe('true');
      expect(btn.textContent).toBe('Show More');
    });

    it('does nothing when not inside codeblock', () => {
      const btn = document.createElement('button');
      document.body.appendChild(btn);
      expect(() => triggerToggleCodeCollapse(btn)).not.toThrow();
    });
  });

  describe('initGlobalHandlers', () => {
    afterEach(() => {
      const win = window as any;
      delete win.UI;
      delete win.Sidebar;
      delete win.Nav;
      delete win.Table;
    });

    it('registers UI namespace on window', () => {
      initGlobalHandlers();
      expect((window as any).UI).toBeDefined();
    });

    it('registers toggleSection on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.toggleSection).toBe('function');
    });

    it('registers expandAll on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.expandAll).toBe('function');
    });

    it('registers collapseAll on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.collapseAll).toBe('function');
    });

    it('registers setHtmlMode on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.setHtmlMode).toBe('function');
    });

    it('registers toggleHtmlMode on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.toggleHtmlMode).toBe('function');
    });

    it('registers CSV preview handlers on UI', () => {
      initGlobalHandlers();
      expect(typeof (window as any).UI.setCsvMode).toBe('function');
      expect(typeof (window as any).UI.toggleCsvMode).toBe('function');
    });

    it('registers Sidebar namespace on window', () => {
      initGlobalHandlers();
      expect((window as any).Sidebar).toBeDefined();
    });

    it('registers Nav namespace on window', () => {
      initGlobalHandlers();
      expect((window as any).Nav).toBeDefined();
    });
  });
});
