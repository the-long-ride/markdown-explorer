import type { MarkdownFormatCommand } from '../../editor/markdownFormatting';

export interface MarkdownEditorActions {
  format(command: MarkdownFormatCommand): void;
  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface MarkdownFormattingLabels {
  readonly toolbar: string;
  readonly bold: string;
  readonly italic: string;
  readonly heading: string;
  readonly quote: string;
  readonly inlineCode: string;
  readonly codeBlock: string;
  readonly link: string;
  readonly bulletList: string;
  readonly numberedList: string;
  readonly taskList: string;
  readonly table: string;
  readonly undo: string;
  readonly redo: string;
  readonly preview: string;
}

interface MarkdownFormattingToolbarProps {
  actions: MarkdownEditorActions;
  labels: MarkdownFormattingLabels;
  disabled?: boolean;
  onPreview: () => void;
}

function FormatButton({
  label,
  children,
  disabled,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="markdown-formatting-toolbar__button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function MarkdownFormattingToolbar({
  actions,
  labels,
  disabled = false,
  onPreview,
}: MarkdownFormattingToolbarProps) {
  return (
    <div className="markdown-formatting-toolbar" role="toolbar" aria-label={labels.toolbar}>
      <FormatButton label={labels.bold} disabled={disabled} onClick={() => actions.format('bold')}><strong>B</strong></FormatButton>
      <FormatButton label={labels.italic} disabled={disabled} onClick={() => actions.format('italic')}><em>I</em></FormatButton>
      {[1, 2, 3, 4, 5, 6].map((level) => (
        <FormatButton
          key={level}
          label={`${labels.heading} ${level}`}
          disabled={disabled}
          onClick={() => actions.format(`heading-${level}` as MarkdownFormatCommand)}
        >
          H{level}
        </FormatButton>
      ))}
      <FormatButton label={labels.quote} disabled={disabled} onClick={() => actions.format('quote')}>❯</FormatButton>
      <FormatButton label={labels.inlineCode} disabled={disabled} onClick={() => actions.format('inline-code')}>`</FormatButton>
      <FormatButton label={labels.codeBlock} disabled={disabled} onClick={() => actions.format('code-block')}>{'{ }'}</FormatButton>
      <FormatButton label={labels.link} disabled={disabled} onClick={() => actions.format('link')}>↗</FormatButton>
      <FormatButton label={labels.bulletList} disabled={disabled} onClick={() => actions.format('bullet-list')}>•</FormatButton>
      <FormatButton label={labels.numberedList} disabled={disabled} onClick={() => actions.format('numbered-list')}>1.</FormatButton>
      <FormatButton label={labels.taskList} disabled={disabled} onClick={() => actions.format('task-list')}>☑</FormatButton>
      <FormatButton label={labels.table} disabled={disabled} onClick={() => actions.format('table')}>▦</FormatButton>
      <span className="markdown-formatting-toolbar__spacer" aria-hidden="true" />
      <FormatButton label={labels.undo} disabled={disabled || !actions.canUndo} onClick={actions.undo}>↶</FormatButton>
      <FormatButton label={labels.redo} disabled={disabled || !actions.canRedo} onClick={actions.redo}>↷</FormatButton>
      <FormatButton label={labels.preview} onClick={onPreview}>▣</FormatButton>
    </div>
  );
}
