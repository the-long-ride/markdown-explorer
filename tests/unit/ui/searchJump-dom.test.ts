import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToRenderedSearchMatch, scrollToRenderedSearchMatchInRoot, clearSearchJumpMarks } from '../../../ui/src/utils/searchJump';

describe('scrollToRenderedSearchMatch', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'mdBody';
    document.body.appendChild(root);

    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    root.remove();
    vi.useRealTimers();
  });

  it('returns false when mdBody element does not exist', () => {
    root.remove();
    expect(scrollToRenderedSearchMatch('test')).toBe(false);
  });

  it('returns false when query is empty', () => {
    root.textContent = 'hello world';
    expect(scrollToRenderedSearchMatch('')).toBe(false);
  });

  it('returns false when query is whitespace-only', () => {
    root.textContent = 'hello world';
    expect(scrollToRenderedSearchMatch('   ')).toBe(false);
  });

  it('returns false when no matches found', () => {
    root.textContent = 'hello world';
    expect(scrollToRenderedSearchMatch('xyz')).toBe(false);
  });

  it('returns true and creates mark elements for a single match', () => {
    root.innerHTML = '<p>Find the keyword here</p>';
    const result = scrollToRenderedSearchMatch('keyword');
    expect(result).toBe(true);

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('keyword');
    expect(marks[0].className).toBe('mdn-search-jump-mark');
  });

  it('creates secondary mark class for non-active matches', () => {
    root.innerHTML = '<p>alpha bravo alpha charlie alpha</p>';
    scrollToRenderedSearchMatch('alpha');

    const primary = root.querySelectorAll('mark.mdn-search-jump-mark');
    const secondary = root.querySelectorAll('mark.mdn-search-jump-mark-secondary');
    expect(primary.length).toBe(1);
    expect(secondary.length).toBe(2);
  });

  it('wraps active match with mdn-search-jump-mark class', () => {
    root.innerHTML = '<p>match one match two</p>';
    scrollToRenderedSearchMatch('match');

    const active = root.querySelector('mark.mdn-search-jump-mark');
    expect(active).not.toBeNull();
    expect(active!.textContent).toBe('match');
  });

  it('uses matchOrdinal to select active match', () => {
    root.innerHTML = '<p>find find find</p>';
    scrollToRenderedSearchMatch('find', 2);

    const secondary = root.querySelectorAll('mark.mdn-search-jump-mark-secondary');
    const active = root.querySelectorAll('mark.mdn-search-jump-mark');
    expect(secondary.length).toBe(2);
    expect(active.length).toBe(1);
  });

  it('calls scrollIntoView on active mark', () => {
    root.innerHTML = '<p>hello target world</p>';
    scrollToRenderedSearchMatch('target');

    const mark = root.querySelector('mark.mdn-search-jump-mark') as HTMLElement;
    expect(mark.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('expands collapsed section ancestors', () => {
    root.innerHTML = '<div class="mdn-section" data-expanded="false"><p>searchable content</p></div>';
    scrollToRenderedSearchMatch('searchable');

    const section = root.querySelector('.mdn-section');
    expect(section!.getAttribute('data-expanded')).toBe('true');
  });

  it('expands nested collapsed section ancestors', () => {
    root.innerHTML = `
      <div class="mdn-section" data-expanded="false">
        <div class="mdn-section" data-expanded="false">
          <p>deep content</p>
        </div>
      </div>`;
    scrollToRenderedSearchMatch('deep');

    const sections = root.querySelectorAll('.mdn-section');
    sections.forEach((s) => {
      expect(s.getAttribute('data-expanded')).toBe('true');
    });
  });

  it('preserves text content after marking', () => {
    root.innerHTML = '<p>before match after</p>';
    scrollToRenderedSearchMatch('match');

    const p = root.querySelector('p')!;
    expect(p.textContent).toBe('before match after');
  });

  it('handles multiple matches in one text node', () => {
    root.innerHTML = '<p>abc abc abc</p>';
    scrollToRenderedSearchMatch('abc');

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(3);
    const textContent = root.querySelector('p')!.textContent;
    expect(textContent).toBe('abc abc abc');
  });

  it('handles matches across multiple text nodes', () => {
    root.innerHTML = '<p>alpha</p><p>beta</p><p>gamma</p>';
    scrollToRenderedSearchMatch('alpha');

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(1);
  });

  it('skips text inside button elements', () => {
    root.innerHTML = '<p>good</p><button>good</button>';
    scrollToRenderedSearchMatch('good');

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(1);
  });

  it('skips text inside script elements', () => {
    root.innerHTML = '<p>target</p><script>target</script>';
    scrollToRenderedSearchMatch('target');

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(1);
  });

  it('clears previous marks before creating new ones', () => {
    root.innerHTML = '<p>searchable text</p>';

    scrollToRenderedSearchMatch('searchable');
    expect(root.querySelectorAll('mark').length).toBe(1);

    scrollToRenderedSearchMatch('text');
    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe('text');
    expect(root.querySelector('mark.mdn-search-jump-mark-secondary')).toBeNull();
  });

  it('handles unicode case-insensitive matching', () => {
    root.innerHTML = '<p>HELLO WORLD</p>';
    const result = scrollToRenderedSearchMatch('hello');
    expect(result).toBe(true);
    expect(root.querySelector('mark')!.textContent).toBe('HELLO');
  });

  it('adds is-active class after timeout', () => {
    root.innerHTML = '<p>findme here</p>';
    scrollToRenderedSearchMatch('findme');

    const mark = root.querySelector('mark.mdn-search-jump-mark') as HTMLElement;
    expect(mark.classList.contains('is-active')).toBe(false);

    vi.advanceTimersByTime(120);
    expect(mark.classList.contains('is-active')).toBe(true);
  });
});

describe('clearSearchJumpMarks integration', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'mdBody';
    document.body.appendChild(root);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    root.remove();
  });

  it('clears marks created by scrollToRenderedSearchMatch', () => {
    root.innerHTML = '<p>highlight this word</p>';
    scrollToRenderedSearchMatch('highlight');

    expect(root.querySelectorAll('mark').length).toBe(1);

    clearSearchJumpMarks(root);
    expect(root.querySelectorAll('mark').length).toBe(0);
    expect(root.querySelector('p')!.textContent).toBe('highlight this word');
  });
});

it('jumps only to an exact-case rendered match when match case is enabled', () => {
  const previewRoot = document.createElement('div');
  previewRoot.textContent = 'alpha Alpha';
  document.body.appendChild(previewRoot);
  HTMLElement.prototype.scrollIntoView = vi.fn();

  const result = scrollToRenderedSearchMatchInRoot(previewRoot, 'Alpha', 0, undefined, undefined, true);
  expect(result).toBe(true);
  const active = previewRoot.querySelector('mark.mdn-search-jump-mark');
  expect(active?.textContent).toBe('Alpha');

  previewRoot.remove();
});
