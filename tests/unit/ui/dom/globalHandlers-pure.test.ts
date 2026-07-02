import { describe, it, expect, beforeEach } from 'vitest';
import {
  toggleSection,
  expandAll,
  collapseAll,
  setHtmlMode,
  toggleHtmlMode,
  triggerToggleCodeCollapse,
  initGlobalHandlers,
} from '../../../../ui/src/dom/globalHandlers';

describe('globalHandlers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('toggleSection', () => {
    it('toggles expanded state off to on', () => {
      document.body.innerHTML = `
        <div class="mdn-section" data-expanded="false">
          <div class="mdn-section-header" aria-expanded="false"></div>
        </div>
      `;
      const header = document.querySelector('.mdn-section-header') as HTMLElement;
      toggleSection(header);
      const section = document.querySelector('.mdn-section') as HTMLElement;
      expect(section.dataset.expanded).toBe('true');
      expect(header.getAttribute('aria-expanded')).toBe('true');
    });

    it('toggles expanded state on to off', () => {
      document.body.innerHTML = `
        <div class="mdn-section" data-expanded="true">
          <div class="mdn-section-header" aria-expanded="true"></div>
        </div>
      `;
      const header = document.querySelector('.mdn-section-header') as HTMLElement;
      toggleSection(header);
      const section = document.querySelector('.mdn-section') as HTMLElement;
      expect(section.dataset.expanded).toBe('false');
      expect(header.getAttribute('aria-expanded')).toBe('false');
    });

    it('does nothing if no section found', () => {
      const header = document.createElement('div');
      expect(() => toggleSection(header)).not.toThrow();
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

    it('does nothing when no sections', () => {
      expect(() => expandAll()).not.toThrow();
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
    it('sets preview mode correctly', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-mode="code">
          <span class="mdn-codeblock-lang">HTML</span>
          <div class="mdn-html-preview-body" style="display:none"></div>
          <div class="mdn-codeblock-body" style="display:flex"></div>
          <button class="mdn-toggle-preview-btn">
            <span class="tooltip-text"></span>
            <svg></svg>
          </button>
        </div>
      `;
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      setHtmlMode(wrap, 'preview');
      expect(wrap.dataset.mode).toBe('preview');
      expect(document.querySelector('.mdn-codeblock-lang')?.textContent).toBe('HTML Preview');
      expect((document.querySelector('.mdn-html-preview-body') as HTMLElement).style.display).toBe('');
      expect((document.querySelector('.mdn-codeblock-body') as HTMLElement).style.display).toBe('none');
    });

    it('sets code mode correctly', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-mode="preview">
          <span class="mdn-codeblock-lang">HTML Preview</span>
          <div class="mdn-html-preview-body" style="display:block"></div>
          <div class="mdn-codeblock-body" style="display:none"></div>
          <button class="mdn-toggle-preview-btn">
            <span class="tooltip-text"></span>
            <svg></svg>
          </button>
        </div>
      `;
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      setHtmlMode(wrap, 'code');
      expect(wrap.dataset.mode).toBe('code');
      expect(document.querySelector('.mdn-codeblock-lang')?.textContent).toBe('HTML');
      expect((document.querySelector('.mdn-html-preview-body') as HTMLElement).style.display).toBe('none');
      expect((document.querySelector('.mdn-codeblock-body') as HTMLElement).style.display).toBe('flex');
    });
  });

  describe('toggleHtmlMode', () => {
    it('toggles from preview to code', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-mode="preview">
          <span class="mdn-codeblock-lang">HTML Preview</span>
          <div class="mdn-html-preview-body" style="display:block"></div>
          <div class="mdn-codeblock-body" style="display:none"></div>
          <button class="mdn-toggle-preview-btn">
            <span class="tooltip-text"></span>
            <svg></svg>
          </button>
        </div>
      `;
      const btn = document.querySelector('.mdn-toggle-preview-btn') as HTMLElement;
      toggleHtmlMode(btn);
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      expect(wrap.dataset.mode).toBe('code');
    });

    it('toggles from code to preview', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-mode="code">
          <span class="mdn-codeblock-lang">HTML</span>
          <div class="mdn-html-preview-body" style="display:none"></div>
          <div class="mdn-codeblock-body" style="display:flex"></div>
          <button class="mdn-toggle-preview-btn">
            <span class="tooltip-text"></span>
            <svg></svg>
          </button>
        </div>
      `;
      const btn = document.querySelector('.mdn-toggle-preview-btn') as HTMLElement;
      toggleHtmlMode(btn);
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      expect(wrap.dataset.mode).toBe('preview');
    });

    it('does nothing if no wrap found', () => {
      const btn = document.createElement('button');
      expect(() => toggleHtmlMode(btn)).not.toThrow();
    });
  });

  describe('triggerToggleCodeCollapse', () => {
    it('toggles collapsed state off to on', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-collapsed="false">
          <button class="mdn-codeblock-toggle-btn">Show More</button>
        </div>
      `;
      const btn = document.querySelector('.mdn-codeblock-toggle-btn') as HTMLElement;
      triggerToggleCodeCollapse(btn);
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      expect(wrap.dataset.collapsed).toBe('true');
      expect(btn.textContent).toBe('Show More');
    });

    it('toggles collapsed state on to off', () => {
      document.body.innerHTML = `
        <div class="mdn-codeblock" data-collapsed="true">
          <button class="mdn-codeblock-toggle-btn">Show Less</button>
        </div>
      `;
      const btn = document.querySelector('.mdn-codeblock-toggle-btn') as HTMLElement;
      triggerToggleCodeCollapse(btn);
      const wrap = document.querySelector('.mdn-codeblock') as HTMLElement;
      expect(wrap.dataset.collapsed).toBe('false');
      expect(btn.textContent).toBe('Show Less');
    });

    it('does nothing if no wrap found', () => {
      const btn = document.createElement('button');
      expect(() => triggerToggleCodeCollapse(btn)).not.toThrow();
    });
  });

  describe('initGlobalHandlers', () => {
    it('registers UI methods on window', () => {
      const win = window as any;
      initGlobalHandlers();
      expect(win.UI).toBeDefined();
      expect(typeof win.UI.toggleSection).toBe('function');
      expect(typeof win.UI.expandAll).toBe('function');
      expect(typeof win.UI.collapseAll).toBe('function');
      expect(typeof win.UI.setHtmlMode).toBe('function');
      expect(typeof win.UI.toggleHtmlMode).toBe('function');
      expect(typeof win.UI.refresh).toBe('function');
      expect(typeof win.Sidebar.toggleFolder).toBe('function');
      expect(typeof win.Nav.go).toBe('function');
    });

    it('handles resize-iframe message with valid iframe', () => {
      document.body.innerHTML = '<iframe id="test-iframe" style="height:100px"></iframe>';
      initGlobalHandlers();
      window.dispatchEvent(new MessageEvent('message', {
        data: { type: 'resize-iframe', id: 'test-iframe', height: 500 },
      }));
      const iframe = document.getElementById('test-iframe') as HTMLIFrameElement;
      expect(iframe.style.height).not.toBe('100px');
    });

    it('ignores non-resize-iframe messages', () => {
      initGlobalHandlers();
      expect(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'other', id: 'test' },
        }));
      }).not.toThrow();
    });

    it('ignores resize-iframe message for missing iframe', () => {
      initGlobalHandlers();
      expect(() => {
        window.dispatchEvent(new MessageEvent('message', {
          data: { type: 'resize-iframe', id: 'nonexistent', height: 500 },
        }));
      }).not.toThrow();
    });

    it('Sidebar.toggleFolder toggles folder and children classes', () => {
      document.body.innerHTML = `
        <div class="tree-folder is-open">
          <div class="tree-folder__children is-hidden"></div>
          <span class="clicker">x</span>
        </div>
      `;
      initGlobalHandlers();
      const el = document.querySelector('.clicker') as HTMLElement;
      (window as any).Sidebar.toggleFolder(el);
      const folder = document.querySelector('.tree-folder') as HTMLElement;
      expect(folder.classList.contains('is-open')).toBe(false);
    });

    it('Sidebar.toggleFolder does nothing if no folder found', () => {
      initGlobalHandlers();
      const el = document.createElement('span');
      expect(() => (window as any).Sidebar.toggleFolder(el)).not.toThrow();
    });
  });
});
