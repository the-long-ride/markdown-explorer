import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HEADING_SECTION_STATE_CHANGE_EVENT } from '../../../ui/src/dom/headingSectionHandlers';
import { createHeadingSectionInteractions } from '../../../ui/src/components/Content/headingSectionInteractions';

describe('heading section interactions write-through', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  test('remember() reports captured state through onRemember', () => {
    const body = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'mdn-section';
    const header = document.createElement('div');
    header.className = 'mdn-section-header';
    section.appendChild(header);
    body.appendChild(section);

    const onRemember = vi.fn();
    const interactions = createHeadingSectionInteractions({
      body,
      currentFile: '/tmp/a.md',
      defaultExpanded: true,
      stateByFile: new Map(),
      onRemember,
    });

    window.dispatchEvent(new CustomEvent(HEADING_SECTION_STATE_CHANGE_EVENT, {
      detail: { section },
    }));

    expect(onRemember).toHaveBeenCalledTimes(1);
    expect(onRemember.mock.calls[0][0]).toBeInstanceOf(Map);
    interactions.dispose();
  });

  test('remembers keyboard toggles with no file but leaves copy and unrelated keys alone', () => {
    const body = document.createElement('div');
    body.innerHTML = '<section class="mdn-section"><div class="mdn-section-header"><button class="mdn-section-copy-btn">Copy</button></div></section>';
    const section = body.querySelector('section')!;
    const header = body.querySelector('.mdn-section-header')!;
    const copy = body.querySelector('button')!;
    const stateByFile = new Map();
    const interactions = createHeadingSectionInteractions({ body, currentFile: '', defaultExpanded: true, stateByFile });
    const key = (element: Element, value: string) =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
    try {
      expect(key(body, 'Enter')).toBe(true);
      expect(key(copy, 'Enter')).toBe(true);
      expect(key(header, 'Tab')).toBe(true);
      expect(stateByFile.size).toBe(0);
      expect(key(header, ' ')).toBe(false);
      expect(section).toHaveAttribute('data-expanded', 'false');
      expect(stateByFile.get('__current-document__')).toBeInstanceOf(Map);
      expect(key(header, 'Enter')).toBe(false);
      expect(section).toHaveAttribute('data-expanded', 'true');
    } finally {
      interactions.dispose();
    }
  });
});
