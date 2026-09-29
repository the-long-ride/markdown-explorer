import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// Markdown token styling for the plain source editor. Colours come from theme
// tokens so every theme (light, dark, auto) keeps its own palette.
export const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: '700', fontSize: '1.28em', color: 'var(--tx)' },
  { tag: tags.heading2, fontWeight: '700', fontSize: '1.18em', color: 'var(--tx)' },
  { tag: tags.heading3, fontWeight: '700', fontSize: '1.08em', color: 'var(--tx)' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '700', color: 'var(--tx)' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.monospace, class: 'cm-md-code' },
  { tag: tags.quote, color: 'var(--tx-2)', fontStyle: 'italic' },
  { tag: [tags.processingInstruction, tags.contentSeparator, tags.meta], color: 'var(--txm)' },
  { tag: tags.comment, color: 'var(--txm)', fontStyle: 'italic' },
]);

export const markdownHighlighting = syntaxHighlighting(markdownHighlightStyle);
