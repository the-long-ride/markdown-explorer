import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installPortableContentHandlers, setPortableCsvMode, setPortableHtmlMode } from '../../../../ui/src/dom/portableContentHandlers';

let ui: any;

beforeEach(() => {
  delete (window as any).UI;
  installPortableContentHandlers(document, window as any);
  ui = (window as any).UI;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
});

describe('portable content handlers', () => {
  it('falls back to execCommand copy and restores the copied tooltip', () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    const execCommand = vi.fn(() => true);
    (document as any).execCommand = execCommand;
    document.body.innerHTML = `<div class="mdn-codeblock"><button class="mdn-copy-btn"><span class="tooltip-text">Copy</span></button><div class="mdn-code-source"><code>x = 1</code></div></div>
      <button id="bare" class="mdn-copy-btn"></button>`;
    const button = document.querySelector<HTMLElement>('.mdn-copy-btn')!;
    ui.copyCode(button);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(button.querySelector('.tooltip-text')!.textContent).toBe('Copied');
    expect(document.querySelector('textarea')).toBeNull();
    vi.advanceTimersByTime(1600);
    expect(button.classList.contains('is-copied')).toBe(false);
    expect(button.querySelector('.tooltip-text')!.textContent).toBe('Copy');
    execCommand.mockClear();
    ui.copyCode(document.getElementById('bare'));
    expect(execCommand).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1600);
  });

  it('copies cleaned section and document text', () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    document.body.innerHTML = `<div class="mdn-body"><section class="mdn-section"><button class="mdn-section-copy-btn">c</button><div class="mdn-section-body">Hello<span class="mdn-anchor">#</span>\n\n\n\nWorld</div></section></div><button id="orphan"></button>`;
    const stop = vi.fn();
    ui.copySection(document.querySelector('.mdn-section-copy-btn'), { stopPropagation: stop });
    expect(stop).toHaveBeenCalled();
    expect(writeText).toHaveBeenLastCalledWith('Hello\n\nWorld');
    ui.copySection(document.getElementById('orphan'));
    ui.copyDocument();
    expect(writeText).toHaveBeenCalledTimes(2);
    document.body.innerHTML = '';
    ui.copyDocument();
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('toggles code collapse labels with defaults and ignores detached buttons', () => {
    document.body.innerHTML = '<div class="mdn-codeblock"><button>x</button></div><button id="lone"></button>';
    const button = document.querySelector<HTMLElement>('.mdn-codeblock button')!;
    ui.toggleCodeCollapse(button);
    expect(button.textContent).toBe('Show more');
    ui.toggleCodeCollapse(button);
    expect(button.textContent).toBe('Show less');
    ui.toggleCodeCollapse(document.getElementById('lone'));
  });

  it('switches HTML and CSV preview modes with translated and default labels', () => {
    document.body.innerHTML = `
      <div class="mdn-html-preview-wrap" data-mode="code"><span class="mdn-codeblock-lang" data-translated-preview-label="Vorschau"></span><div class="mdn-html-preview-body"></div><div class="mdn-codeblock-body"></div><button class="mdn-toggle-preview-btn"><span class="tooltip-text"></span></button></div>
      <div class="mdn-csv-preview-wrap" data-mode="code"><span class="mdn-codeblock-lang" data-code-label="Data"></span><div class="mdn-csv-preview-body"></div><div class="mdn-code-source"></div><button class="mdn-toggle-csv-btn" data-label-show-code="Code!"><span class="tooltip-text"></span></button></div>
      <div id="empty-html" class="mdn-html-preview-wrap"></div><div id="empty-csv" class="mdn-csv-preview-wrap"></div><button id="lone"></button>`;
    const html = document.querySelector<HTMLElement>('.mdn-html-preview-wrap')!;
    ui.toggleHtmlMode(html.querySelector('button'));
    expect(html.querySelector('.mdn-codeblock-lang')!.textContent).toBe('Vorschau');
    expect(html.querySelector<HTMLElement>('.mdn-codeblock-body')!.style.display).toBe('none');
    expect(html.querySelector('.tooltip-text')!.textContent).toBe('Show code');
    ui.toggleHtmlMode(html.querySelector('button'));
    expect(html.querySelector('.mdn-codeblock-lang')!.textContent).toBe('HTML');
    expect(html.querySelector('.tooltip-text')!.textContent).toBe('Show preview');
    const csv = document.querySelector<HTMLElement>('.mdn-csv-preview-wrap')!;
    ui.toggleCsvMode(csv.querySelector('button'));
    expect(csv.querySelector('.mdn-codeblock-lang')!.textContent).toBe('Preview');
    expect(csv.querySelector('.tooltip-text')!.textContent).toBe('Code!');
    ui.toggleCsvMode(csv.querySelector('button'));
    expect(csv.querySelector('.mdn-codeblock-lang')!.textContent).toBe('Data');
    setPortableHtmlMode(document.getElementById('empty-html')!, 'preview');
    setPortableHtmlMode(document.getElementById('empty-html')!, 'code');
    setPortableCsvMode(document.getElementById('empty-csv')!, 'preview');
    setPortableCsvMode(document.getElementById('empty-csv')!, 'code');
    ui.toggleHtmlMode(document.getElementById('lone'));
    ui.toggleCsvMode(document.getElementById('lone'));
    expect(document.getElementById('empty-csv')!.dataset.mode).toBe('code');
  });

  it('toggles and expands sections', () => {
    document.body.innerHTML = '<section class="mdn-section" data-expanded="false"><header class="mdn-section-header"></header></section><header id="loose"></header>';
    ui.toggleSection(document.querySelector('.mdn-section-header'));
    expect(document.querySelector('.mdn-section')!.getAttribute('data-expanded')).toBe('true');
    ui.toggleSection(document.getElementById('loose'));
    ui.collapseAll();
    ui.expandAll();
    expect(document.querySelector('.mdn-section')!.getAttribute('data-expanded')).toBe('true');
  });

  it('reuses an existing UI namespace', () => {
    const existing = { custom: 1 };
    const win = { UI: existing } as any;
    installPortableContentHandlers(document, win);
    expect(win.UI).toBe(existing);
    expect(typeof win.UI.copyCode).toBe('function');
  });
});
