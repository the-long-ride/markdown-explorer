import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const mocks = vi.hoisted(() => ({
  loadDocumentSnapshot: vi.fn(),
  syncStickyTableHeaders: vi.fn(),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      theme: 'light', themeStyle: 'default', defaultExpanded: true,
      settings: { language: 'en', keybindings: {}, disabledKeybindings: {}, activeCustomThemeId: null, customThemes: [], fontBindings: {} },
    },
  }),
}));
vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }),
}));
vi.mock('../../../../ui/src/export/documentSnapshot', () => ({ loadDocumentSnapshot: mocks.loadDocumentSnapshot, findScopeFile: () => null }));
vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({ scheduleContentEnhancements: () => () => {} }));
vi.mock('../../../../ui/src/components/Content/enhancements/mermaidAppearance', () => ({
  syncMermaidAppearance: () => ({ key: 'light', changed: false }), subscribeToAutoMermaidTheme: () => () => {},
}));
vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRerenderLifecycle', () => ({
  createMermaidRerenderLifecycle: () => ({ schedule: vi.fn(), dispose: vi.fn() }),
}));
vi.mock('../../../../ui/src/components/Content/contentUtils', () => ({ syncStickyTableHeaders: mocks.syncStickyTableHeaders }));

import { ScopeViewModal } from '../../../../ui/src/components/Modal/ScopeViewModal';

const target: MdFile = {
  fsPath: '/docs/table.md', relativePath: 'table.md', parts: ['table.md'], fileName: 'table.md',
  title: 'Table', extension: '.md', documentKind: 'markdown',
};

describe('Scope View rendered-content parity', () => {
  beforeEach(() => {
    mocks.syncStickyTableHeaders.mockReset();
    mocks.loadDocumentSnapshot.mockResolvedValue({
      file: target, markdownSource: '# Table',
      html: '<table class="mdn-table"><thead><tr><th>Head</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>',
    });
  });

  it('synchronizes sticky table headers when the Scope scroll container moves', async () => {
    const { container } = render(<ScopeViewModal initialFile={target} files={[target]} onClose={() => {}} />);
    await screen.findByText('Head');
    const scroll = container.querySelector<HTMLElement>('.scope-view__scroll');
    expect(scroll).not.toBeNull();
    mocks.syncStickyTableHeaders.mockClear();
    fireEvent.scroll(scroll!);
    expect(mocks.syncStickyTableHeaders).toHaveBeenCalledWith(scroll);
  });
});
