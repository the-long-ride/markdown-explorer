import { useEffect, useState, type ReactNode } from 'react';
import {
  clampEditorFontSize,
  DEFAULT_EDITOR_FONT_SIZE,
  formatShortcutLabel,
  getEditorCommandShortcutLabel,
  getEditorFontSizeShortcutLabel,
  MAX_EDITOR_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
} from '../../editor/editorUx';
import type { MarkdownFormatCommand } from '../../editor/markdownFormatting';
import { TooltipButton } from '../shared/TooltipButton';

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
  readonly underline: string;
  readonly heading: string;
  readonly quote: string;
  readonly inlineCode: string;
  readonly codeBlock: string;
  readonly link: string;
  readonly bulletList: string;
  readonly numberedList: string;
  readonly taskList: string;
  readonly table: string;
  readonly properties?: string;
  readonly undo: string;
  readonly redo: string;
  readonly preview: string;
  readonly wrapText: string;
  readonly fontSize?: string;
  readonly decreaseFontSize?: string;
  readonly increaseFontSize?: string;
}

interface MarkdownFormattingToolbarProps {
  actions: MarkdownEditorActions;
  labels: MarkdownFormattingLabels;
  disabled?: boolean;
  onPreview: () => void;
  showUndoRedo?: boolean;
  showPreview?: boolean;
  wrapText?: boolean;
  onToggleWrapText?: () => void;
  onOpenTableDialog?: () => void;
  onOpenLinkDialog?: () => void;
  fontSize?: number;
  onChangeFontSize?: (nextSize: number) => void;
  keybindings?: Readonly<Record<string, string>>;
  disabledKeybindings?: Readonly<Record<string, boolean>>;
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
  underline: <Icon><path d="M6 3v7a6 6 0 0 0 12 0V3M4 21h16" /></Icon>,
  quote: <Icon><path d="M4 5v14M9 7h11M9 12h11M9 17h7" /></Icon>,
  inlineCode: <Icon><path d="m16 18 6-6-6-6M8 6l-6 6 6 6" /></Icon>,
  codeBlock: <Icon><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m10 9-3 3 3 3M14 9l3 3-3 3" /></Icon>,
  link: <Icon><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" /><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" /></Icon>,
  bulletList: <Icon><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01" /></Icon>,
  numberedList: <Icon><path d="M10 6h11M10 12h11M10 18h11M4 5h1v4M4 9h2M6 19H4c0-1 2-2 2-3s-1-1.5-2-1" /></Icon>,
  taskList: <Icon><path d="m3 6 2 2 4-4M13 6h8M13 17h8" /><rect x="3" y="14" width="6" height="6" rx="1" /></Icon>,
  table: <Icon><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 15h18M10 4v16" /></Icon>,
  properties: (
    <Icon>
      <path d="M4 5h16M4 19h16M8 9.5h8M8 14.5h5" />
      <path d="M5 9.5h.01M5 14.5h.01" />
    </Icon>
  ),
  decreaseFontSize: (
    <Icon>
      <path d="M4 19 8.5 6h1L14 19M5.5 15h7M16 13h5" />
    </Icon>
  ),
  increaseFontSize: (
    <Icon>
      <path d="M4 19 8.5 6h1L14 19M5.5 15h7M18 10v6M15 13h6" />
    </Icon>
  ),
  undo: <Icon><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></Icon>,
  redo: <Icon><path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" /></Icon>,
  preview: <Icon><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Icon>,
  wrapText: <Icon><path d="m16 16-2 2 2 2" /><path d="M4 12h11a3 3 0 0 1 3 3 3 3 0 0 1-3 3H14" /><path d="M4 6h16" /><path d="M4 18h4" /></Icon>,
};

function FormatButton({
  label,
  shortcut,
  children,
  disabled,
  className,
  ariaPressed,
  tooltipAlign,
  tooltipPos = 'below',
  onClick,
}: {
  label: string;
  shortcut?: string;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
  ariaPressed?: boolean;
  tooltipAlign?: 'center' | 'left' | 'right';
  tooltipPos?: 'above' | 'below';
  onClick: () => void;
}) {
  return (
    <TooltipButton
      className={`markdown-formatting-toolbar__button${className ? ` ${className}` : ''}`}
      label={label}
      shortcut={shortcut}
      tooltipPos={tooltipPos}
      tooltipAlign={tooltipAlign}
      portalTooltip
      aria-keyshortcuts={shortcut}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </TooltipButton>
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
  wrapText = true,
  onToggleWrapText,
  onOpenTableDialog,
  onOpenLinkDialog,
  fontSize = DEFAULT_EDITOR_FONT_SIZE,
  onChangeFontSize,
  keybindings,
  disabledKeybindings,
}: MarkdownFormattingToolbarProps) {
  const [fontSizeInput, setFontSizeInput] = useState(() => String(fontSize));
  useEffect(() => {
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  const format = (command: MarkdownFormatCommand) => () => actions.format(command);
  const shortcutFor = (command: MarkdownFormatCommand) =>
    getEditorCommandShortcutLabel(command, keybindings, disabledKeybindings);
  return (
    <div className="markdown-formatting-toolbar" role="toolbar" aria-label={labels.toolbar}>
      <Group>
        <FormatButton label={labels.bold} shortcut={shortcutFor('bold')} tooltipAlign="left" disabled={disabled} onClick={format('bold')}>{ICONS.bold}</FormatButton>
        <FormatButton label={labels.italic} shortcut={shortcutFor('italic')} tooltipAlign="left" disabled={disabled} onClick={format('italic')}>{ICONS.italic}</FormatButton>
        <FormatButton label={labels.underline} shortcut={shortcutFor('underline')} tooltipAlign="left" disabled={disabled} onClick={format('underline')}>{ICONS.underline}</FormatButton>
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
        <FormatButton label={labels.quote} shortcut={shortcutFor('quote')} disabled={disabled} onClick={format('quote')}>{ICONS.quote}</FormatButton>
        <FormatButton label={labels.inlineCode} shortcut={shortcutFor('inline-code')} disabled={disabled} onClick={format('inline-code')}>{ICONS.inlineCode}</FormatButton>
        <FormatButton label={labels.codeBlock} shortcut={shortcutFor('code-block')} disabled={disabled} onClick={format('code-block')}>{ICONS.codeBlock}</FormatButton>
        <FormatButton label={labels.link} shortcut={shortcutFor('link')} disabled={disabled} onClick={onOpenLinkDialog ?? format('link')}>{ICONS.link}</FormatButton>
        <FormatButton label={labels.table} disabled={disabled} onClick={onOpenTableDialog ?? format('table')}>{ICONS.table}</FormatButton>
        <FormatButton label={labels.properties ?? 'Insert properties'} disabled={disabled} onClick={format('properties')}>{ICONS.properties}</FormatButton>
      </Group>
      <Group>
        <FormatButton label={labels.bulletList} shortcut={shortcutFor('bullet-list')} disabled={disabled} onClick={format('bullet-list')}>{ICONS.bulletList}</FormatButton>
        <FormatButton label={labels.numberedList} shortcut={shortcutFor('numbered-list')} disabled={disabled} onClick={format('numbered-list')}>{ICONS.numberedList}</FormatButton>
        <FormatButton label={labels.taskList} shortcut={shortcutFor('task-list')} disabled={disabled} onClick={format('task-list')}>{ICONS.taskList}</FormatButton>
      </Group>
      {onToggleWrapText && (
        <Group>
          <FormatButton
            label={labels.wrapText}
            disabled={disabled}
            className={wrapText ? 'markdown-formatting-toolbar__button--active' : ''}
            ariaPressed={wrapText}
            tooltipAlign={(!showUndoRedo && !showPreview && !onChangeFontSize) ? "right" : undefined}
            onClick={onToggleWrapText}
          >
            {ICONS.wrapText}
          </FormatButton>
        </Group>
      )}
      {onChangeFontSize && (
        <Group>
          <FormatButton
            label={labels.decreaseFontSize ?? 'Decrease font size'}
            shortcut={getEditorFontSizeShortcutLabel('decrease', keybindings, disabledKeybindings)}
            disabled={disabled || fontSize <= MIN_EDITOR_FONT_SIZE}
            onClick={() => onChangeFontSize(clampEditorFontSize(fontSize - 1))}
          >
            {ICONS.decreaseFontSize}
          </FormatButton>
          <label className="markdown-formatting-toolbar__font-size" data-testid="editor-font-size-value">
            <input
              type="text"
              inputMode="numeric"
              className="markdown-formatting-toolbar__font-size-input"
              data-testid="editor-font-size-input"
              aria-label={labels.fontSize ?? 'Font size'}
              value={fontSizeInput}
              disabled={disabled}
              onChange={(event) => {
                const raw = event.currentTarget.value.replace(/[^\d]/g, '');
                setFontSizeInput(raw);
                if (raw !== '') {
                  const parsed = Number(raw);
                  if (parsed >= MIN_EDITOR_FONT_SIZE && parsed <= MAX_EDITOR_FONT_SIZE) {
                    onChangeFontSize(parsed);
                  }
                }
              }}
              onBlur={() => {
                const parsed = Number(fontSizeInput);
                const next = Number.isFinite(parsed) && fontSizeInput !== '' ? clampEditorFontSize(parsed) : fontSize;
                setFontSizeInput(String(next));
                if (next !== fontSize) onChangeFontSize(next);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  event.stopPropagation();
                  const parsed = Number(fontSizeInput);
                  const next = Number.isFinite(parsed) && fontSizeInput !== '' ? clampEditorFontSize(parsed) : fontSize;
                  setFontSizeInput(String(next));
                  onChangeFontSize(next);
                  event.currentTarget.blur();
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setFontSizeInput(String(fontSize));
                  event.currentTarget.blur();
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  const next = clampEditorFontSize(fontSize + 1);
                  setFontSizeInput(String(next));
                  onChangeFontSize(next);
                } else if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  const next = clampEditorFontSize(fontSize - 1);
                  setFontSizeInput(String(next));
                  onChangeFontSize(next);
                }
              }}
            />
            <span className="markdown-formatting-toolbar__font-size-unit" aria-hidden="true">px</span>
          </label>
          <FormatButton
            label={labels.increaseFontSize ?? 'Increase font size'}
            shortcut={getEditorFontSizeShortcutLabel('increase', keybindings, disabledKeybindings)}
            disabled={disabled || fontSize >= MAX_EDITOR_FONT_SIZE}
            onClick={() => onChangeFontSize(clampEditorFontSize(fontSize + 1))}
          >
            {ICONS.increaseFontSize}
          </FormatButton>
        </Group>
      )}
      {(showUndoRedo || showPreview) && (
        <Group>
          {showUndoRedo && (
            <>
              <FormatButton label={labels.undo} shortcut={formatShortcutLabel('Z')} disabled={disabled || !actions.canUndo} onClick={actions.undo}>{ICONS.undo}</FormatButton>
              <FormatButton label={labels.redo} shortcut={formatShortcutLabel('Z', { shift: true })} disabled={disabled || !actions.canRedo} onClick={actions.redo}>{ICONS.redo}</FormatButton>
            </>
          )}
          {showPreview && (
            <FormatButton label={labels.preview} onClick={onPreview}>
              {ICONS.preview}
            </FormatButton>
          )}
        </Group>
      )}
    </div>
  );
}
