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
});
