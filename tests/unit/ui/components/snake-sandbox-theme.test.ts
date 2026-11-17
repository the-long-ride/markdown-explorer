import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const TEST_CODE_PATH = path.resolve(__dirname, '../../../../manual-tests/test-code.md');

function extractSnakeHtmlBlock(): string {
  const markdown = fs.readFileSync(TEST_CODE_PATH, 'utf8');
  const match = markdown.match(/## HTML \(Isolated Sandbox Preview\)\s*```html\s*([\s\S]*?)```/);
  if (!match) {
    throw new Error('Could not find Snake HTML sandbox block in manual-tests/test-code.md');
  }
  return match[1];
}

describe('Snake game sandbox Default theme styling', () => {
  const snakeHtml = extractSnakeHtmlBlock();

  it('defines and uses all Default theme design system tokens', () => {
    const requiredTokens = [
      '--bg',
      '--bg-s',
      '--bg-e',
      '--bg-h',
      '--tx',
      '--tx2',
      '--txm',
      '--bd',
      '--bd-s',
      '--accent',
      '--accent-dim',
      '--r',
      '--r-lg',
      '--sh-md',
      '--font-sans',
      '--font-mono',
    ];

    for (const token of requiredTokens) {
      expect(snakeHtml).toContain(`${token}:`);
      expect(snakeHtml).toContain(`var(${token})`);
    }
  });

  it('supports light/dark theme tokens and host set-theme sync', () => {
    expect(snakeHtml).toContain(':root[data-theme="light"]');
    expect(snakeHtml).toContain('@media (prefers-color-scheme: light)');
    expect(snakeHtml).toContain("data.type === 'set-theme'");
  });

  it('removes legacy hardcoded retro colors from the Snake sandbox', () => {
    const legacyColors = ['#6d5ef0', '#111827', '#a78bfa', '#fb7185', 'CanvasText'];
    for (const color of legacyColors) {
      expect(snakeHtml).not.toContain(color);
    }
  });

  it('uses theme tokens for canvas board, snake, food, and game-over overlay', () => {
    expect(snakeHtml).toContain("token('--bg'");
    expect(snakeHtml).toContain("token('--bd'");
    expect(snakeHtml).toContain("token('--accent'");
    expect(snakeHtml).toContain("token('--snake-body'");
    expect(snakeHtml).toContain("token('--snake-food'");
    expect(snakeHtml).toContain("token('--snake-overlay'");
    expect(snakeHtml).toContain("token('--tx'");
  });
});
