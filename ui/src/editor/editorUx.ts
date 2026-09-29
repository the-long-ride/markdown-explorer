import type { MarkdownFormatCommand } from './markdownFormatting';

const FORMAT_KEYS: Readonly<Record<string, MarkdownFormatCommand>> = {
  b: 'bold',
  i: 'italic',
  k: 'link',
  e: 'inline-code',
};

interface ChordLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
}

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

/** Formatting command bound to a Mod+key chord inside Markdown editors, if any. */
export function formatCommandForChord(event: ChordLike): MarkdownFormatCommand | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
  return FORMAT_KEYS[event.key.toLowerCase()] ?? null;
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
