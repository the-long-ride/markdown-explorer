import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const mocks = vi.hoisted(() => ({
  loadDocumentSnapshot: vi.fn(),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: {
      theme: 'light', themeStyle: 'default', defaultExpanded: true,
      settings: {
        language: 'en', keybindings: { back: 'Alt+Left', forward: 'Alt+Right' }, disabledKeybindings: {},
        activeCustomThemeId: null, customThemes: [], fontBindings: {},
      },
    },
  }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({ postMessage: vi.fn(), onMessage: () => () => {}, getState: () => undefined, setState: () => {}, copyToClipboard: () => {} }),
}));

vi.mock('../../../../ui/src/export/documentSnapshot', () => ({
  loadDocumentSnapshot: mocks.loadDocumentSnapshot,
  findScopeFile: () => null,
}));

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidAppearance', () => ({
  syncMermaidAppearance: () => ({ key: 'light', changed: false }),
  subscribeToAutoMermaidTheme: () => () => {},
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRerenderLifecycle', () => ({
  createMermaidRerenderLifecycle: () => ({ schedule: vi.fn(), dispose: vi.fn() }),
}));

import { ScopeViewModal } from '../../../../ui/src/components/Modal/ScopeViewModal';

const target: MdFile = {
  fsPath: '/docs/readme.md', relativePath: 'readme.md', parts: ['readme.md'],
  fileName: 'readme.md', title: 'Readme', extension: '.md', documentKind: 'markdown',
};

describe('ScopeViewModal navigation controls', () => {
  beforeEach(() => {
    mocks.loadDocumentSnapshot.mockResolvedValue({ file: target, markdownSource: '# Readme', html: '<h1>Readme</h1>' });
  });

  it('shows configured history shortcuts and Escape in Previous, Next, and Close tooltips', async () => {
    const { container } = render(<ScopeViewModal initialFile={target} files={[target]} onClose={() => {}} />);
    await screen.findByText('Readme');

    const previous = screen.getByRole('button', { name: 'Previous scope' });
    const next = screen.getByRole('button', { name: 'Next scope' });
    const openFile = screen.getByRole('button', { name: 'Open file' });
    const close = screen.getByRole('button', { name: 'Close scope view' });

    expect(previous.querySelector('.tooltip-text')?.textContent).toContain('Alt');
    expect(next.querySelector('.tooltip-text')?.textContent).toContain('Alt');
    expect(openFile.querySelector('.tooltip-text')?.textContent).toBe('Open file');
    expect(close.querySelector('.tooltip-text')?.textContent).toContain('Esc');
    expect(container.querySelectorAll('.tooltip-text')).toHaveLength(4);
  });
});
