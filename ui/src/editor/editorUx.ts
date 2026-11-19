import type { MarkdownFormatCommand } from './markdownFormatting';

export const EDITOR_SHORTCUT_COMMANDS: Readonly<Record<string, MarkdownFormatCommand>> = {
  editorBold: 'bold',
  editorItalic: 'italic',
  editorUnderline: 'underline',
  editorInlineCode: 'inline-code',
  editorLink: 'link',
  editorCodeBlock: 'code-block',
  editorQuote: 'quote',
  editorBulletList: 'bullet-list',
  editorNumberedList: 'numbered-list',
  editorTaskList: 'task-list',
};

export type EditorFontSizeAction = 'decrease' | 'increase';

export const EDITOR_FONT_SIZE_SHORTCUT_ACTIONS: Readonly<Record<string, EditorFontSizeAction>> = {
  editorDecreaseFontSize: 'decrease',
  editorIncreaseFontSize: 'increase',
};

export const DEFAULT_EDITOR_KEYBINDINGS: Readonly<Record<string, string>> = {
  editorBold: 'Ctrl+B',
  editorItalic: 'Ctrl+I',
  editorUnderline: 'Ctrl+U',
  editorInlineCode: 'Ctrl+`',
  editorLink: 'Ctrl+K',
  editorCodeBlock: 'Ctrl+Shift+C',
  editorQuote: 'Ctrl+Shift+Q',
  editorBulletList: 'Ctrl+Shift+8',
  editorNumberedList: 'Ctrl+Shift+7',
  editorTaskList: 'Ctrl+Shift+9',
  editorDecreaseFontSize: 'Ctrl+-',
  editorIncreaseFontSize: 'Ctrl+=',
};

export interface ChordLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

const NUM_SHIFT_KEYS: Record<string, string> = {
  '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
  '-': '_', '=': '+',
};

function currentPlatform(): string {
  return typeof navigator === 'undefined' ? '' : navigator.platform || '';
}

export function isApplePlatform(platform = currentPlatform()): boolean {
  return /mac|iphone|ipad|ipod/i.test(platform);
}

/** Modifier name shown in editor hints: `⌘` on Apple platforms, `Ctrl` elsewhere. */
export function editorModKeyLabel(platform = currentPlatform()): string {
  return isApplePlatform(platform) ? '⌘' : 'Ctrl';
}

/** Human shortcut label for tooltips, e.g. `Ctrl+B` or `⌘B`, `Ctrl+Shift+Z` or `⇧⌘Z`. */
export function formatShortcutLabel(key: string, options: { shift?: boolean; platform?: string } = {}): string {
  const platform = options.platform ?? currentPlatform();
  if (isApplePlatform(platform)) return `${options.shift ? '⇧' : ''}⌘${key}`;
  return `Ctrl+${options.shift ? 'Shift+' : ''}${key}`;
}

export function isUndoChord(event: ChordLike): boolean {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  if (!mod || event.altKey) return false;
  return !event.shiftKey && (event.key === 'z' || event.key === 'Z');
}

export function isRedoChord(event: ChordLike): boolean {
  const mod = Boolean(event.ctrlKey || event.metaKey);
  if (!mod || event.altKey) return false;
  return (event.shiftKey && (event.key === 'z' || event.key === 'Z')) || (!event.shiftKey && (event.key === 'y' || event.key === 'Y'));
}

export function matchesEditorShortcut(event: ChordLike, shortcutStr: string | undefined): boolean {
  if (!shortcutStr) return false;
  const parts = shortcutStr.split('+').map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return false;

  const reqCtrl = parts.includes('ctrl') || parts.includes('cmd') || parts.includes('mod');
  const reqShift = parts.includes('shift');
  const reqAlt = parts.includes('alt') || parts.includes('option');

  const actualCtrl = Boolean(event.ctrlKey || event.metaKey);
  const actualShift = Boolean(event.shiftKey);
  const actualAlt = Boolean(event.altKey);

  if (reqCtrl !== actualCtrl || reqShift !== actualShift || reqAlt !== actualAlt) return false;

  const keyPart = parts.find((p) => p !== 'ctrl' && p !== 'cmd' && p !== 'mod' && p !== 'shift' && p !== 'alt' && p !== 'option') ?? '';
  if (!keyPart) return false;

  let targetKey = keyPart;
  if (targetKey === '<-' || targetKey === 'left') targetKey = 'arrowleft';
  if (targetKey === '->' || targetKey === 'right') targetKey = 'arrowright';

  const eventKey = event.key.toLowerCase();
  if (eventKey === targetKey || (reqShift && NUM_SHIFT_KEYS[targetKey] === eventKey)) return true;
  if (!reqShift && targetKey === '=' && eventKey === '+') return true;
  if (!reqShift && targetKey === '-' && eventKey === '_') return true;
  return false;
}

/** Formatting command bound to an editor shortcut chord inside Markdown editors, if any. */
export function formatCommandForChord(
  event: ChordLike,
  keybindings?: Readonly<Record<string, string>>,
  disabledKeybindings?: Readonly<Record<string, boolean>>,
): MarkdownFormatCommand | null {
  for (const [actionId, command] of Object.entries(EDITOR_SHORTCUT_COMMANDS)) {
    if (disabledKeybindings?.[actionId]) continue;
    const shortcutStr = keybindings && actionId in keybindings
      ? keybindings[actionId]
      : DEFAULT_EDITOR_KEYBINDINGS[actionId];
    if (!shortcutStr) continue;
    if (matchesEditorShortcut(event, shortcutStr)) {
      return command;
    }
  }
  return null;
}

/** Font size action bound to an editor shortcut chord inside Markdown editors, if any. */
export function fontSizeActionForChord(
  event: ChordLike,
  keybindings?: Readonly<Record<string, string>>,
  disabledKeybindings?: Readonly<Record<string, boolean>>,
): EditorFontSizeAction | null {
  for (const [actionId, action] of Object.entries(EDITOR_FONT_SIZE_SHORTCUT_ACTIONS)) {
    if (disabledKeybindings?.[actionId]) continue;
    const shortcutStr = keybindings && actionId in keybindings
      ? keybindings[actionId]
      : DEFAULT_EDITOR_KEYBINDINGS[actionId];
    if (!shortcutStr) continue;
    if (matchesEditorShortcut(event, shortcutStr)) {
      return action;
    }
  }
  return null;
}

function formatAppleShortcut(shortcutStr: string): string {
  const parts = shortcutStr.split('+').map((p) => p.trim());
  let hasCtrl = false;
  let hasShift = false;
  let hasAlt = false;
  let key = '';

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'cmd' || lower === 'mod') {
      hasCtrl = true;
    } else if (lower === 'shift') {
      hasShift = true;
    } else if (lower === 'alt' || lower === 'option') {
      hasAlt = true;
    } else {
      key = part.toUpperCase();
    }
  }

  const modifiers = `${hasAlt ? '⌥' : ''}${hasShift ? '⇧' : ''}${hasCtrl ? '⌘' : ''}`;
  return `${modifiers}${key}`;
}

export function getEditorCommandShortcutLabel(
  command: MarkdownFormatCommand,
  keybindings?: Readonly<Record<string, string>>,
  disabledKeybindings?: Readonly<Record<string, boolean>>,
  platform?: string,
): string | undefined {
  const entry = Object.entries(EDITOR_SHORTCUT_COMMANDS).find(([, cmd]) => cmd === command);
  if (!entry) return undefined;
  const [actionId] = entry;
  if (disabledKeybindings?.[actionId]) return undefined;
  const shortcutStr = keybindings && actionId in keybindings
    ? keybindings[actionId]
    : DEFAULT_EDITOR_KEYBINDINGS[actionId];
  if (!shortcutStr) return undefined;

  const currentPlat = platform ?? currentPlatform();
  if (isApplePlatform(currentPlat)) {
    return formatAppleShortcut(shortcutStr);
  }
  return shortcutStr;
}

export function getEditorFontSizeShortcutLabel(
  action: EditorFontSizeAction,
  keybindings?: Readonly<Record<string, string>>,
  disabledKeybindings?: Readonly<Record<string, boolean>>,
  platform?: string,
): string | undefined {
  const entry = Object.entries(EDITOR_FONT_SIZE_SHORTCUT_ACTIONS).find(([, act]) => act === action);
  if (!entry) return undefined;
  const [actionId] = entry;
  if (disabledKeybindings?.[actionId]) return undefined;
  const shortcutStr = keybindings && actionId in keybindings
    ? keybindings[actionId]
    : DEFAULT_EDITOR_KEYBINDINGS[actionId];
  if (!shortcutStr) return undefined;

  const currentPlat = platform ?? currentPlatform();
  if (isApplePlatform(currentPlat)) {
    return formatAppleShortcut(shortcutStr);
  }
  return shortcutStr;
}

function closestIn(target: EventTarget | null, selector: string): boolean {
  if (typeof Element === 'undefined' || !(target instanceof Element)) return false;
  return target.closest(selector) !== null;
}

export function isMarkdownEditorTarget(target: EventTarget | null): boolean {
  return closestIn(target, '.markdown-source-editor, .markdown-inline-editor');
}

export function isInlineMarkdownEditorTarget(target: EventTarget | null): boolean {
  return closestIn(target, '.markdown-inline-editor');
}

/** Counts letter/number runs, so punctuation and Markdown markers are not words. */
export function countWords(source: string): number {
  return source.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
}

export function fillTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}

export const EDITOR_WORD_WRAP_STORAGE_KEY = 'markdown-explorer-plain-editor-wrap';

export function getInitialEditorWordWrap(): boolean {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(EDITOR_WORD_WRAP_STORAGE_KEY) : null;
    return saved !== 'false';
  } catch {
    return true;
  }
}

export function persistEditorWordWrap(enabled: boolean): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EDITOR_WORD_WRAP_STORAGE_KEY, String(enabled));
    }
  } catch {
    // Ignore storage errors.
  }
}

export const EDITOR_FONT_SIZE_STORAGE_KEY = 'markdown-explorer-editor-font-size';
export const EDITOR_FONT_SIZE_EVENT = 'markdown-explorer-editor-font-size-change';
export const DEFAULT_EDITOR_FONT_SIZE = 14;
export const MIN_EDITOR_FONT_SIZE = 8;
export const MAX_EDITOR_FONT_SIZE = 32;

export function clampEditorFontSize(size: number): number {
  if (!Number.isFinite(size)) return DEFAULT_EDITOR_FONT_SIZE;
  return Math.min(MAX_EDITOR_FONT_SIZE, Math.max(MIN_EDITOR_FONT_SIZE, Math.round(size)));
}

export function getInitialEditorFontSize(): number {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(EDITOR_FONT_SIZE_STORAGE_KEY) : null;
    if (!saved) return DEFAULT_EDITOR_FONT_SIZE;
    return clampEditorFontSize(Number(saved));
  } catch {
    return DEFAULT_EDITOR_FONT_SIZE;
  }
}

export function persistEditorFontSize(size: number): void {
  try {
    const clamped = clampEditorFontSize(size);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, String(clamped));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(EDITOR_FONT_SIZE_EVENT, { detail: clamped }));
    }
  } catch {
    // Ignore storage errors.
  }
}
