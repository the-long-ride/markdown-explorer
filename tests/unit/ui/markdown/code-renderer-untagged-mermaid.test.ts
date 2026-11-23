import { describe, expect, it } from 'vitest';
import { renderCodeBlock } from '../../../../ui/src/markdown/codeRenderer';

const token = (content: string, lang = '') => ({ type: 'code', lang, content, sourceStart: 0, sourceEnd: content.length }) as any;
const isMermaid = (content: string, lang = '') => renderCodeBlock(token(content, lang), 'light').includes('mdn-mermaid-wrap');

describe('renderCodeBlock untagged mermaid detection', () => {
  it('skips frontmatter, comments and blank lines before the diagram keyword', () => {
    expect(isMermaid('\uFEFF\n---\ntitle: x\n---\n%% note\n\ngraph TD\nA-->B')).toBe(true);
    expect(isMermaid('---\ntitle: never closed')).toBe(false);
    expect(isMermaid('\n\n')).toBe(false);
    expect(isMermaid('hello\ngraph TD')).toBe(false);
    expect(isMermaid('sequenceDiagram\nA->>B: hi', 'text')).toBe(true);
    expect(isMermaid('graph TD', 'js')).toBe(false);
  });
});
