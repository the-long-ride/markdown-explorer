import { render, screen } from '@testing-library/react';
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

function renderPlainMode() {
  const filePath = '/docs/a.md';
  const session = setDocumentEditMode(
    replaceWorkingSource(createEditableDocumentSession(filePath, '# A', 'rev-1'), '# Working'),
    'plain',
  );
  const state = {
    ...initialState,
    isLoading: false,
    currentFile: filePath,
    relativePath: 'docs/a.md',
    contentHtml: '<h1>Rendered</h1>',
    markdownSource: '# Working',
    documentSessions: { [documentSessionKey(filePath)]: session },
  };
  const View = ContentMainView as React.ComponentType<any>;
  const onWorkingDocumentSourceChange = vi.fn();
  const onSaveDocument = vi.fn();

  render(
    <View
      state={state}
      translations={getTranslations('en')}
      scrollRef={{ current: null }}
      bodyRef={{ current: null }}
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
      previewTitle=""
      previewWarning=""
      previewMeta=""
      frontmatterEntries={[]}
      renderedContentParts={{ leadingCommentsHtml: '', bodyHtml: '<h1>Rendered</h1>' }}
      onOpenWorkspaceAgain={vi.fn()}
      onDeleteUnavailableWorkspace={vi.fn()}
      onUpdateSettings={vi.fn()}
      onRefresh={vi.fn()}
      onHtmlPolicyReport={vi.fn()}
      onWorkingDocumentSourceChange={onWorkingDocumentSourceChange}
      onSaveDocument={onSaveDocument}
    />,
  );

  return { filePath, onWorkingDocumentSourceChange, onSaveDocument };
}

describe('ContentMainView plain Markdown mode', () => {
  it('shows the shared working source instead of rendered Markdown', () => {
    renderPlainMode();

    expect(screen.getByRole('textbox', { name: 'Markdown source' })).toHaveValue('# Working');
    expect(screen.queryByText('Rendered')).not.toBeInTheDocument();
  });
});
