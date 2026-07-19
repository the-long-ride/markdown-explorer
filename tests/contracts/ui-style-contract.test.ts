import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');
const uiRoot = path.join(repoRoot, 'ui/src');

function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(filePath);
    return /\.tsx?$/.test(entry.name) ? [filePath] : [];
  });
}

type StyleViolation = {
  file: string;
  line: number;
  rule: string;
  excerpt: string;
};

function findStyleViolations(filePath: string): StyleViolation[] {
  const source = fs.readFileSync(filePath, 'utf8');
  const file = path.relative(repoRoot, filePath).replaceAll('\\', '/');
  const violations: StyleViolation[] = [];
  const addMatches = (pattern: RegExp, rule: string) => {
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      violations.push({
        file,
        line: source.slice(0, index).split('\n').length,
        rule,
        excerpt: source.slice(index, index + 100).split('\n')[0].trim(),
      });
    }
  };

  // JSX style props make presentation unavailable to shared stylesheets.
  if (/\.tsx$/.test(filePath)) {
    addMatches(/\bstyle\s*=\s*(?:\{\{|\{|['"])/g, 'JSX style prop');
  }
  // The old helper writes arbitrary CSS directly to DOM nodes. CSS variables
  // remain allowed through useCssVars because they carry runtime values only.
  addMatches(/\buseDomStyles\b/g, 'useDomStyles runtime inline CSS');

  return violations;
}

describe('UI style contract', () => {
  test('does not use JSX inline style props', () => {
    const violations = collectSourceFiles(uiRoot).flatMap(findStyleViolations);

    expect(
      violations,
      violations.length
        ? `Inline CSS violations:\n${violations
            .map(({ file, line, rule, excerpt }) => `${file}:${line} (${rule}) ${excerpt}`)
            .join('\n')}`
        : undefined,
    ).toEqual([]);
  });
});

export { findStyleViolations };
