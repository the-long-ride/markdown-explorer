import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scrollToRenderedSearchMatch } from '../../../ui/src/utils/searchJump';

describe('scrollToRenderedSearchMatch main exported function', () => {
  let root: HTMLElement;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    root = document.createElement('div');
    root.id = 'mdBody';
    document.body.appendChild(root);

    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    root.remove();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.useRealTimers();
  });

  it('1. returns false when root element is not found', () => {
    root.remove();
    expect(scrollToRenderedSearchMatch('test')).toBe(false);
  });

  it('2. returns false when no matches are found', () => {
    root.innerHTML = '<p>hello world</p>';
    expect(scrollToRenderedSearchMatch('xyz')).toBe(false);
  });

  it('3. creates primary mark with is-active class for selected match index', () => {
    root.innerHTML = '<p>alpha beta alpha gamma</p>';
    const result = scrollToRenderedSearchMatch('alpha', 1);

    expect(result).toBe(true);

    const marks = root.querySelectorAll('mark');
    expect(marks.length).toBe(2);

    const active = root.querySelector('mark.mdn-search-jump-mark');
    expect(active).not.toBeNull();
    expect(active!.textContent).toBe('alpha');

    // The active class is added asynchronously after 120 ms.
    expect(active!.classList.contains('is-active')).toBe(false);
    vi.advanceTimersByTime(120);
    expect(active!.classList.contains('is-active')).toBe(true);
  });

  it('4. creates secondary marks for other matches', () => {
    root.innerHTML = '<p>one two one three one</p>';
    scrollToRenderedSearchMatch('one', 1);

    const primary = root.querySelectorAll('mark.mdn-search-jump-mark');
    const secondary = root.querySelectorAll('mark.mdn-search-jump-mark-secondary');

    expect(primary.length).toBe(1);
    expect(secondary.length).toBe(2);
  });

  it('5. expands collapsed ancestor sections', () => {
    root.innerHTML = `
      <div class="mdn-section" data-expanded="false">
        <div class="mdn-section" data-expanded="false">
          <p>find me</p>
        </div>
      </div>
    `;
    scrollToRenderedSearchMatch('find');

    const sections = root.querySelectorAll('.mdn-section');
    sections.forEach((section) => {
      expect(section.getAttribute('data-expanded')).toBe('true');
    });
  });

  it('6. calls scrollIntoView on the active mark', () => {
    root.innerHTML = '<p>target here</p>';
    scrollToRenderedSearchMatch('target');

    const mark = root.querySelector('mark.mdn-search-jump-mark') as HTMLElement;
    expect(mark.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('7. handles timeout-based retry scrolling when mark is off-screen', () => {
    root.innerHTML = `
      <div class="content__scroll">
        <p>hidden target here</p>
      </div>
    `;

    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('content__scroll')) {
        return { top: 100, bottom: 200 } as DOMRect;
      }
      return { top: 0, bottom: 10 } as DOMRect;
    });

    scrollToRenderedSearchMatch('target');

    const mark = root.querySelector('mark.mdn-search-jump-mark') as HTMLElement;
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(350);
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(3);
  });

  it('8. does not retry scroll when the active mark is already visible', () => {
    root.innerHTML = `
      <div class="content__scroll">
        <p>visible target here</p>
      </div>
    `;

    HTMLElement.prototype.getBoundingClientRect = vi.fn(function (this: HTMLElement) {
      if (this.classList.contains('content__scroll')) {
        return { top: 100, bottom: 500 } as DOMRect;
      }
      return { top: 150, bottom: 160 } as DOMRect;
    });

    scrollToRenderedSearchMatch('target');

    const mark = root.querySelector('mark.mdn-search-jump-mark') as HTMLElement;
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(250);
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(350);
    expect(mark.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
