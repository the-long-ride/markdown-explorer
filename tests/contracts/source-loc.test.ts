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


// Existing decomposition debt is capped at its current size. New files must
// meet the default limits, and grandfathered files may not grow further.
const LEGACY_FILE_LIMITS: Record<string, number> = {
  'chromium-xtension/src/chrome-host.ts': 597,
  'tauri/src/dispatcher/commands.rs': 535,
  'ui/src/hooks/useDesktopTabs.ts': 584,
  'ui/src/components/Content/Content.tsx': 571,
  'ui/src/components/Content/ContentTabs.tsx': 538,
  'ui/src/contexts/translations.ts': 574,
  'ui/src/components/Desktop/DesktopTabBar.tsx': 527,
  'website-app/src/web-host.ts': 525,
  'ui/src/components/Content/ContentTabs.tsx': 539,
  'ui/src/components/Sidebar/Sidebar.tsx': 517,
  'tauri/src/dispatcher/handlers.rs': 462,
  'electron/core/runtime-workspace-handlers.js': 441,
  'ui/src/styles/global/global-markdown-base.css': 589,
  'ui/src/markdown/highlighter.ts': 472,
  'vscode/src/core/panel.ts': 500,
  'ui/src/contexts/appStateReducer.ts': 466,
  'ui/src/types.ts': 463,
  'ui/src/styles/global/global-code.css': 544,
  'ui/src/components/Content/useContentEffects.ts': 434,
  'electron/core/runtime-command-handlers.js': 378,
  'ui/src/styles/global/global-topbar-tabs.part1.css': 526,
  'ui/src/components/Content/WelcomePage.tsx': 446,
  'ui/src/components/Settings/SettingsModal.tsx': 413,
  'ui/src/App.tsx': 411,
  'ui/src/styles/tokens/tokens-style-themes.css': 559,
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
        const relativePath = relative(process.cwd(), filePath).replaceAll('\\', '/');
        const limit = LEGACY_FILE_LIMITS[relativePath] ?? LIMITS[extension];
        return { filePath, extension, loc, limit };
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

export { isExcluded, sourceLines, sourceFiles, LIMITS, LEGACY_FILE_LIMITS };
