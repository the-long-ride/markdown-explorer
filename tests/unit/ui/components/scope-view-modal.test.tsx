import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';

const mocks = vi.hoisted(() => ({
  loadDocumentSnapshot: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: { theme: 'light', settings: { language: 'en' } } }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mocks.postMessage,
    onMessage: () => () => {},
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  }),
}));

vi.mock('../../../../ui/src/export/documentSnapshot', async () => {
  const actual = await vi.importActual<any>('../../../../ui/src/export/documentSnapshot');
  return { ...actual, loadDocumentSnapshot: mocks.loadDocumentSnapshot };
});

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));

import { ScopeViewModal } from '../../../../ui/src/components/Modal/ScopeViewModal';

function file(index: number): MdFile {
  return {
    fsPath: `/docs/${index}.md`, relativePath: `${index}.md`, parts: [`${index}.md`],
    fileName: `${index}.md`, title: `Doc ${index}`, extension: '.md', documentKind: 'markdown',
  };
}

const files = Array.from({ length: 11 }, (_, index) => file(index + 1));

function snapshot(target: MdFile) {
  const next = Number.parseInt(target.title.replace('Doc ', ''), 10) + 1;
  return {
    file: target,
    markdownSource: `# ${target.title}`,
    html: `<h1>${target.title}</h1>${next <= 11 ? `<a href="./${next}.md">Open ${next}</a>` : ''}`,
  };
}

describe('ScopeViewModal', () => {
  beforeEach(() => {
    mocks.loadDocumentSnapshot.mockReset();
    mocks.postMessage.mockReset();
    mocks.loadDocumentSnapshot.mockImplementation(async (_bridge: unknown, target: MdFile) => snapshot(target));
  });

  it('renders ten depth segments and enlarges the active segment marker', async () => {
    const { container } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    const segments = container.querySelectorAll('.scope-view__depth-segment');
    expect(segments).toHaveLength(10);
    expect(segments[0]).toHaveClass('is-filled', 'is-current');
    expect(container.querySelectorAll('.scope-view__depth-segment.is-current')).toHaveLength(1);
    expect(screen.getByLabelText('Scope level 1 of 10')).toBeTruthy();
  });

  it('opens nested workspace documents without touching main navigation and supports previous/next', async () => {
    const { container } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    fireEvent.click(screen.getByText('Open 2'));
    await screen.findByText('Doc 2');
    expect(container.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(2);

    fireEvent.click(screen.getByLabelText('Previous scope'));
    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByLabelText('Next scope'));
    await screen.findByText('Doc 2');
    expect(mocks.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ command: 'navigate' }));
  });

  it('blocks the eleventh nested scope and keeps level ten active', async () => {
    const { container } = render(<ScopeViewModal initialFile={files[0]} files={files} onClose={() => {}} />);
    await screen.findByText('Doc 1');

    for (let i = 2; i <= 10; i += 1) {
      fireEvent.click(screen.getByText(`Open ${i}`));
      await screen.findByText(`Doc ${i}`);
    }
    fireEvent.click(screen.getByText('Open 11'));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Maximum scope depth reached'));
    expect(container.querySelectorAll('.scope-view__depth-segment.is-filled')).toHaveLength(10);
    expect(screen.getByText('Doc 10')).toBeTruthy();
  });
});
