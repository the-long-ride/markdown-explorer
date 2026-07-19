import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { describe, expect, test } from 'vitest';

const LIMITS: Record<string, number> = {
  '.ts': 400,
  '.tsx': 400,
  '.css': 500,
  '.rs': 350,
  '.js': 350,
};

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  'coverage',
  'vendor',
]);

function isExcluded(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  const parts = normalized.split('/');
  const fileName = parts.at(-1) ?? '';
  return (
    parts.some((part) => EXCLUDED_DIRECTORY_NAMES.has(part)) ||
    parts.some((part) => /^(test|tests|__tests__)$/i.test(part)) ||
    /\.(test|spec)\.[^.]+$/i.test(fileName) ||
    fileName.endsWith('.d.ts') ||
    fileName.endsWith('.map') ||
    /(?:translationsData|welcomeTranslations)\.(?:ts|tsx)$/i.test(fileName)
  );
}

function withoutRustTestModules(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  let testModuleDepth = 0;
  let awaitingTestModuleBody = false;

  for (const line of lines) {
    if (testModuleDepth === 0 && !awaitingTestModuleBody && /#\[cfg\(test\)\]/.test(line)) {
      awaitingTestModuleBody = true;
      continue;
    }
    if (awaitingTestModuleBody) {
      testModuleDepth += (line.match(/{/g) ?? []).length;
      testModuleDepth -= (line.match(/}/g) ?? []).length;
      if (testModuleDepth > 0) awaitingTestModuleBody = false;
      continue;
    }
    if (testModuleDepth > 0) {
      testModuleDepth += (line.match(/{/g) ?? []).length;
      testModuleDepth -= (line.match(/}/g) ?? []).length;
      if (testModuleDepth <= 0) testModuleDepth = 0;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

function sourceLines(text: string, extension?: string): number {
  if (extension === '.rs') text = withoutRustTestModules(text);
  let inBlockComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplate = false;
  let escaped = false;
  let lines = 0;

  for (const rawLine of text.split(/\r?\n/)) {
    let hasCode = false;
    for (let index = 0; index < rawLine.length; index += 1) {
      const character = rawLine[index];
      const next = rawLine[index + 1];

      if (escaped) {
        escaped = false;
        if (!inBlockComment) hasCode = true;
        continue;
      }
      if (character === '\\' && (inSingleQuote || inDoubleQuote || inTemplate)) {
        escaped = true;
        hasCode = true;
        continue;
      }
      if (inBlockComment) {
        if (character === '*' && next === '/') {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && character === '/' && next === '*') {
        inBlockComment = true;
        index += 1;
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && character === '/' && next === '/') break;
      if (character === '"' && !inSingleQuote && !inTemplate) inDoubleQuote = !inDoubleQuote;
      else if (character === "'" && !inDoubleQuote && !inTemplate) inSingleQuote = !inSingleQuote;
      else if (character === '`' && !inSingleQuote && !inDoubleQuote) inTemplate = !inTemplate;
      if (!/\s/.test(character)) hasCode = true;
    }
    if (hasCode) lines += 1;
  }
  return lines;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return isExcluded(relative(process.cwd(), filePath)) ? [] : sourceFiles(filePath);
    }
    const extension = extname(entry.name).toLowerCase();
    return LIMITS[extension] && !isExcluded(relative(process.cwd(), filePath)) ? [filePath] : [];
  });
}

describe('source file size limits', () => {
  test('production source files stay within their type-specific LOC budget', () => {
    const failures = sourceFiles(process.cwd())
      .map((filePath) => {
        const extension = extname(filePath).toLowerCase();
        const loc = sourceLines(readFileSync(filePath, 'utf8'), extension);
        return { filePath, extension, loc, limit: LIMITS[extension] };
      })
      .filter(({ loc, limit }) => loc > limit)
      .sort((left, right) => right.loc - right.limit - (left.loc - left.limit));

    expect(
      failures,
      failures.length
        ? `Oversized production files:\n${failures
            .map(({ filePath, extension, loc, limit }) => `${relative(process.cwd(), filePath)}: ${loc} LOC (max ${limit} for ${extension})`)
            .join('\n')}`
        : undefined,
    ).toEqual([]);
  });
});

export { isExcluded, sourceLines, sourceFiles, LIMITS };
