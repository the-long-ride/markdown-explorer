import { useRef } from 'react';
import { getEditorUiTranslations } from '../../contexts/editorUiTranslations';
import type { DocumentViewMode } from '../../split-view/paneState';
import { InlineMarkdownEditor } from './InlineMarkdownEditor';
import { MarkdownSourceEditor } from './MarkdownSourceEditor';
import { useInlineMarkdownEditing } from './useInlineMarkdownEditing';

interface DocumentSurfaceProps {
  filePath: string;
  relativePath: string;
  mode: DocumentViewMode;
  contentHtml: string;
  source: string;
  stale: boolean;
  language: string;
  renderVersion?: number;
  disabled?: boolean;
  onSourceChange: (source: string) => void;
  onSave: () => void | Promise<unknown>;
  onModeChange?: (mode: DocumentViewMode) => void;
}

export function DocumentSurface({
  filePath,
  relativePath,
  mode,
  contentHtml,
  source,
  stale,
  language,
  renderVersion = 0,
  disabled = false,
  onSourceChange,
  onSave,
  onModeChange,
}: DocumentSurfaceProps) {
  const editorT = getEditorUiTranslations(language);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inlineEditing = useInlineMarkdownEditing({
    enabled: mode === 'inline-edit',
    bodyRef,
    source,
    renderVersion,
    editLabel: editorT.inlineEdit,
    onSourceChange,
  });

  return (
    <>
      <div
        ref={bodyRef}
        className="mdn-body document-surface"
        data-testid="document-surface"
        data-file-path={filePath}
        data-stale={stale || undefined}
        data-mdn-source-document-path={relativePath || undefined}
        aria-live="polite"
      >
        {mode === 'plain' ? (
          <MarkdownSourceEditor
            value={source}
            disabled={disabled}
            ariaLabel={editorT.plainSourceLabel}
            language={language}
            onChange={onSourceChange}
            onSave={() => { void onSave(); }}
            onPreview={() => onModeChange?.('rendered')}
          />
        ) : (
          <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
        )}
      </div>
      {mode === 'inline-edit' && inlineEditing.activeTarget && (
        <InlineMarkdownEditor
          target={inlineEditing.activeTarget}
          source={source}
          labels={{
            sourceLabel: editorT.inlineSourceLabel,
            apply: editorT.apply,
            cancel: editorT.cancel,
          }}
          onApply={inlineEditing.apply}
          onCancel={inlineEditing.cancel}
        />
      )}
    </>
  );
}
