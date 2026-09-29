import { useCallback, useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ContentMainView } from '../../../../ui/src/components/Content/ContentMainView';
import { initialState } from '../../../../ui/src/contexts/appStateReducer';
import {
  createEditableDocumentSession,
  documentSessionKey,
  replaceWorkingSource,
  setDocumentEditMode,
} from '../../../../ui/src/editor/documentSession';
import { getTranslations } from '../../../../ui/src/contexts/translations';

vi.mock('../../../../ui/src/contexts/HistoryContext', () => ({
  useHistoryView: () => ({ historyViews: {}, clearHistoryView: vi.fn() }),
}));

const filePath = '/docs/a.md';

// Mirrors AppStateContext's real `saveDocument`: a useCallback whose closure
// reads `documentSessions` from the render it was created in. If a caller
// invokes the pre-update closure in the same tick as the source change, it
// reads stale (pre-edit) source — the exact regression this test guards.
function Harness({ onSavedSource }: { onSavedSource: (source: string) => void }) {
  const [documentSessions, setDocumentSessions] = useState(() => ({
    [documentSessionKey(filePath)]: setDocumentEditMode(
      createEditableDocumentSession(filePath, 'Alpha', 'rev-1'),
      'inline-edit',
    ),
  }));

  const onSaveDocument = useCallback((path: string) => {
    onSavedSource(documentSessions[documentSessionKey(path)].source);
  }, [documentSessions]);

  const onWorkingDocumentSourceChange = useCallback((path: string, source: string) => {
    setDocumentSessions((prev) => ({
      ...prev,
      [documentSessionKey(path)]: replaceWorkingSource(prev[documentSessionKey(path)], source),
    }));
  }, []);

  const bodyRef = useRef<HTMLDivElement>(null);
  const state = {
    ...initialState,
    isLoading: false,
    currentFile: filePath,
    relativePath: 'docs/a.md',
    contentHtml: '<p data-mdn-source-start="0" data-mdn-source-end="5">Alpha</p>',
    markdownSource: 'Alpha',
    documentSessions,
  };

  return (
    <ContentMainView
      state={state as any}
      translations={getTranslations('en')}
      scrollRef={{ current: null }}
      bodyRef={bodyRef}
      isFullHtmlPreview={false}
      workspaceUnavailablePath={null}
      isDesktopTabView={false}
      isUnavailableWorkspaceInHistory={false}
      suppressWelcome={false}
      hasRenderableDocumentContent
      isHtmlDocument={false}
      sourceDocumentText={null}
      htmlMarkdownRender={{ html: '', error: null }}
      htmlDocumentPreviewEnabled={false}
      frontmatterEntries={[]}
      onOpenWorkspaceAgain={vi.fn()}
      onDeleteUnavailableWorkspace={vi.fn()}
      onUpdateSettings={vi.fn()}
      onRefresh={vi.fn()}
      onHtmlPolicyReport={vi.fn()}
      onWorkingDocumentSourceChange={onWorkingDocumentSourceChange}
      onSaveDocument={onSaveDocument}
    />
  );
}

describe('ContentMainView inline-edit Ctrl+S', () => {
  it('saves the freshly edited source instead of the stale pre-edit source', () => {
    const onSavedSource = vi.fn();
    render(<Harness onSavedSource={onSavedSource} />);

    fireEvent.doubleClick(screen.getByText('Alpha'));
    const editor = screen.getByRole('textbox', { name: /markdown/i });
    fireEvent.change(editor, { target: { value: 'Beta' } });
    fireEvent.keyDown(editor, { key: 's', ctrlKey: true });

    expect(onSavedSource).toHaveBeenCalledTimes(1);
    expect(onSavedSource).toHaveBeenCalledWith('Beta');
  });
});
