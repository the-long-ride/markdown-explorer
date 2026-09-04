import { describe, expect, it, vi } from 'vitest';
import {
  findSourceElement,
  expandSectionAncestors,
  jumpToLintLocation,
} from '../../../../ui/src/insights/jumpToLocation';

describe('jumpToLocation', () => {
  it('locates the enclosing element matching sourceStart and sourceEnd', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <h1 data-mdn-source-start="0" data-mdn-source-end="10">Title</h1>
      <p data-mdn-source-start="11" data-mdn-source-end="50">First paragraph</p>
      <p data-mdn-source-start="51" data-mdn-source-end="120">Second paragraph</p>
    `;

    const el = findSourceElement(root, 25, 30);
    expect(el).not.toBeNull();
    expect(el?.textContent).toBe('First paragraph');
  });

  it('falls back to the closest element when offset is between blocks', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <h1 data-mdn-source-start="10" data-mdn-source-end="20">Title</h1>
      <p data-mdn-source-start="50" data-mdn-source-end="100">Paragraph</p>
    `;

    const el = findSourceElement(root, 30);
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-mdn-source-start')).toBe('10');
  });

  it('expands collapsed parent sections', () => {
    const section = document.createElement('section');
    section.className = 'mdn-section';
    section.dataset.expanded = 'false';

    const child = document.createElement('p');
    section.appendChild(child);

    expandSectionAncestors(child);
    expect(section.dataset.expanded).toBe('true');
  });

  it('jumps to location and applies the highlight class to target element', () => {
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/intro.md';
    body.innerHTML = `
      <p data-mdn-source-start="0" data-mdn-source-end="40">Introduction</p>
    `;
    document.body.appendChild(body);

    const target = body.querySelector('p')!;
    target.scrollIntoView = vi.fn();

    const cleanup = jumpToLintLocation('docs/intro.md', { sourceStart: 10, sourceEnd: 20 });
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(target.classList.contains('mdn-lint-jump-target')).toBe(true);

    cleanup();
    document.body.removeChild(body);
  });

  it('returns null when root has no source-range elements or ranges are invalid', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <p>No range</p>
      <p data-mdn-source-start="invalid" data-mdn-source-end="10">Invalid start</p>
      <p data-mdn-source-start="50" data-mdn-source-end="20">Inverted range</p>
    `;
    expect(findSourceElement(root, 10)).toBeNull();
  });

  it('selects the tightest enclosing element when ranges are nested', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div data-mdn-source-start="0" data-mdn-source-end="100">
        <p data-mdn-source-start="20" data-mdn-source-end="40">Inner paragraph</p>
      </div>
    `;
    const el = findSourceElement(root, 25);
    expect(el?.tagName.toLowerCase()).toBe('p');
    expect(el?.textContent).toBe('Inner paragraph');
  });

  it('expands multiple deeply nested section ancestors and handles non-section elements', () => {
    const outerSection = document.createElement('section');
    outerSection.className = 'mdn-section';
    outerSection.dataset.expanded = 'false';

    const innerSection = document.createElement('section');
    innerSection.className = 'mdn-section';
    innerSection.dataset.expanded = 'false';

    const target = document.createElement('span');
    innerSection.appendChild(target);
    outerSection.appendChild(innerSection);

    expandSectionAncestors(target);
    expect(innerSection.dataset.expanded).toBe('true');
    expect(outerSection.dataset.expanded).toBe('true');

    // Safe when no section exists
    const standalone = document.createElement('div');
    expect(() => expandSectionAncestors(standalone)).not.toThrow();
  });

  it('jumps by line number when sourceStart is omitted', () => {
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/guide.md';
    body.innerHTML = `
      Line 1
      Line 2
      <p data-mdn-source-start="14" data-mdn-source-end="30">Line 3 paragraph</p>
    `;
    document.body.appendChild(body);

    const target = body.querySelector('p')!;
    target.scrollIntoView = vi.fn();

    const cleanup = jumpToLintLocation('docs/guide.md', { line: 3 });
    expect(target.scrollIntoView).toHaveBeenCalled();
    cleanup();
    document.body.removeChild(body);
  });

  it('targets inner specific element like img or a when present', () => {
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/guide.md';
    body.innerHTML = `
      <p data-mdn-source-start="0" data-mdn-source-end="50">
        <a href="https://example.com">Specific Link</a>
      </p>
    `;
    document.body.appendChild(body);

    const link = body.querySelector('a')!;
    link.scrollIntoView = vi.fn();

    const cleanup = jumpToLintLocation('docs/guide.md', { sourceStart: 10 });
    expect(link.scrollIntoView).toHaveBeenCalled();
    expect(link.classList.contains('mdn-lint-jump-target')).toBe(true);

    cleanup();
    document.body.removeChild(body);
  });

  it('does not jump when document path does not match', () => {
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/other.md';
    body.innerHTML = '<p data-mdn-source-start="0" data-mdn-source-end="20">Other</p>';
    document.body.appendChild(body);

    const target = body.querySelector('p')!;
    target.scrollIntoView = vi.fn();

    const cleanup = jumpToLintLocation('docs/guide.md', { sourceStart: 5 }, 1);
    expect(target.scrollIntoView).not.toHaveBeenCalled();

    cleanup();
    document.body.removeChild(body);
  });

  it('retries with interval when mdBody appears dynamically', () => {
    vi.useFakeTimers();

    const cleanup = jumpToLintLocation('docs/guide.md', { sourceStart: 0 }, 5);

    // mdBody is not in DOM yet
    vi.advanceTimersByTime(100);

    // Now insert mdBody
    const body = document.createElement('div');
    body.id = 'mdBody';
    body.dataset.mdnSourceDocumentPath = 'docs/guide.md';
    body.innerHTML = '<p data-mdn-source-start="0" data-mdn-source-end="20">Guide</p>';
    document.body.appendChild(body);
    const target = body.querySelector('p')!;
    target.scrollIntoView = vi.fn();

    // Advance to trigger retry
    vi.advanceTimersByTime(100);
    expect(target.scrollIntoView).toHaveBeenCalled();

    cleanup();
    document.body.removeChild(body);
    vi.useRealTimers();
  });
});
