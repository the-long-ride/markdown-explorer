import type { ReactNode } from 'react';
import { formatShortcutLabel } from '../../editor/editorUx';
import type { MarkdownFormatCommand } from '../../editor/markdownFormatting';
import { parseShortcutText } from '../shared/parseShortcutText';
import { buildShortcutTooltip } from '../../utils/toolbar-menu.js';

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
  showUndoRedo?: boolean;
  showPreview?: boolean;
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  bold: <Icon><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" /><path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" /></Icon>,
  italic: <Icon><path d="M19 5h-9M14 19H5M15 5 9 19" /></Icon>,
  quote: <Icon><path d="M4 5v14M9 7h11M9 12h11M9 17h7" /></Icon>,
  inlineCode: <Icon><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></Icon>,
  codeBlock: <Icon><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m10 9-3 3 3 3M14 9l3 3-3 3" /></Icon>,
  link: <Icon><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>,
  bulletList: <Icon><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>,
  numberedList: <Icon><path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M4 9h2M6 19H4c0-1 2-2 2-3s-1-1.5-2-1" /></Icon>,
  taskList: <Icon><path d="m3 6 2 2 4-4M13 6h8M13 17h8" /><rect x="3" y="14" width="6" height="6" rx="1" /></Icon>,
  table: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M10 4v16" /></Icon>,
  undo: <Icon><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>,
  redo: <Icon><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Icon>,
  preview: <Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>,
};

function FormatButton({
  label,
  shortcut,
  children,
  disabled,
  className,
  onClick,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  const tooltipText = buildShortcutTooltip(label, shortcut);
  return (
    <button
      type="button"
      className={`markdown-formatting-toolbar__button tooltip-container${className ? ` ${className}` : ''}`}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      data-tooltip-pos="below"
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
      {tooltipText && <span className="tooltip-text">{parseShortcutText(tooltipText)}</span>}
    </button>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <span className="markdown-formatting-toolbar__group">{children}</span>;
}

export function MarkdownFormattingToolbar({
  actions,
  labels,
  disabled = false,
  onPreview,
  showUndoRedo = true,
  showPreview = true,
}: MarkdownFormattingToolbarProps) {
  const format = (command: MarkdownFormatCommand) => () => actions.format(command);
  return (
    <div className="markdown-formatting-toolbar" role="toolbar" aria-label={labels.toolbar}>
      <Group>
        <FormatButton label={labels.bold} shortcut={formatShortcutLabel('B')} disabled={disabled} onClick={format('bold')}>{ICONS.bold}</FormatButton>
        <FormatButton label={labels.italic} shortcut={formatShortcutLabel('I')} disabled={disabled} onClick={format('italic')}>{ICONS.italic}</FormatButton>
        <FormatButton label={labels.inlineCode} shortcut={formatShortcutLabel('E')} disabled={disabled} onClick={format('inline-code')}>{ICONS.inlineCode}</FormatButton>
        <FormatButton label={labels.link} shortcut={formatShortcutLabel('K')} disabled={disabled} onClick={format('link')}>{ICONS.link}</FormatButton>
      </Group>
      <Group>
        {[1, 2, 3, 4, 5, 6].map((level) => (
          <FormatButton
            key={level}
            label={`${labels.heading} ${level}`}
            className="markdown-formatting-toolbar__button--heading"
            disabled={disabled}
            onClick={format(`heading-${level}` as MarkdownFormatCommand)}
          >
            H<small>{level}</small>
          </FormatButton>
        ))}
      </Group>
      <Group>
        <FormatButton label={labels.quote} disabled={disabled} onClick={format('quote')}>{ICONS.quote}</FormatButton>
        <FormatButton label={labels.codeBlock} disabled={disabled} onClick={format('code-block')}>{ICONS.codeBlock}</FormatButton>
        <FormatButton label={labels.table} disabled={disabled} onClick={format('table')}>{ICONS.table}</FormatButton>
      </Group>
      <Group>
        <FormatButton label={labels.bulletList} disabled={disabled} onClick={format('bullet-list')}>{ICONS.bulletList}</FormatButton>
        <FormatButton label={labels.numberedList} disabled={disabled} onClick={format('numbered-list')}>{ICONS.numberedList}</FormatButton>
        <FormatButton label={labels.taskList} disabled={disabled} onClick={format('task-list')}>{ICONS.taskList}</FormatButton>
      </Group>
      <span className="markdown-formatting-toolbar__spacer" aria-hidden="true" />
      {showUndoRedo && (
        <Group>
          <FormatButton label={labels.undo} shortcut={formatShortcutLabel('Z')} disabled={disabled || !actions.canUndo} onClick={actions.undo}>{ICONS.undo}</FormatButton>
          <FormatButton label={labels.redo} shortcut={formatShortcutLabel('Z', { shift: true })} disabled={disabled || !actions.canRedo} onClick={actions.redo}>{ICONS.redo}</FormatButton>
        </Group>
      )}
      {showPreview && (
        <FormatButton label={labels.preview} className="markdown-formatting-toolbar__button--labelled" onClick={onPreview}>
          {ICONS.preview}<span aria-hidden="true">{labels.preview}</span>
        </FormatButton>
      )}
    </div>
  );
}
