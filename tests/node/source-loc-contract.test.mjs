import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import test from 'node:test';

const LIMITS = { '.ts': 400, '.tsx': 400, '.css': 500, '.rs': 350, '.js': 350 };
const EXCLUDED = new Set(['.git', 'node_modules', 'dist', 'build', 'out', 'target', 'coverage', 'vendor']);

function isExcluded(filePath) {
  const parts = filePath.replaceAll('\\', '/').split('/');
  const fileName = parts.at(-1) ?? '';
  return parts.some(part => EXCLUDED.has(part))
    || parts.some(part => /^(test|tests|__tests__)$/i.test(part))
    || /\.(test|spec)\.[^.]+$/i.test(fileName)
    || fileName.endsWith('.d.ts')
    || fileName.endsWith('.map')
    || /(?:translationsData|welcomeTranslations)\.(?:ts|tsx)$/i.test(fileName);
}

function withoutRustTestModules(text) {
  const kept = [];
  let depth = 0;
  let awaitingBody = false;
  for (const line of text.split(/\r?\n/)) {
    if (depth === 0 && !awaitingBody && /#\[cfg\(test\)\]/.test(line)) {
      awaitingBody = true;
      continue;
    }
    if (awaitingBody) {
      depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
      if (depth > 0) awaitingBody = false;
      continue;
    }
    if (depth > 0) {
      depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
      if (depth <= 0) depth = 0;
      continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

function sourceLines(source, extension) {
  const text = extension === '.rs' ? withoutRustTestModules(source) : source;
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
      if (escaped) { escaped = false; if (!inBlockComment) hasCode = true; continue; }
      if (character === '\\' && (inSingleQuote || inDoubleQuote || inTemplate)) {
        escaped = true; hasCode = true; continue;
      }
      if (inBlockComment) {
        if (character === '*' && next === '/') { inBlockComment = false; index += 1; }
        continue;
      }
      if (!inSingleQuote && !inDoubleQuote && !inTemplate && character === '/' && next === '*') {
        inBlockComment = true; index += 1; continue;
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

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = join(directory, entry.name);
    const rel = relative(process.cwd(), filePath);
    if (entry.isDirectory()) return isExcluded(rel) ? [] : sourceFiles(filePath);
    const extension = extname(entry.name).toLowerCase();
    return LIMITS[extension] && !isExcluded(rel) ? [filePath] : [];
  });
}

test('all production files satisfy standard LOC budgets without legacy exceptions', () => {
  const failures = sourceFiles(process.cwd()).flatMap(filePath => {
    const extension = extname(filePath).toLowerCase();
    const loc = sourceLines(readFileSync(filePath, 'utf8'), extension);
    const limit = LIMITS[extension];
    return loc > limit ? [`${relative(process.cwd(), filePath)}: ${loc} LOC (max ${limit})`] : [];
  });
  assert.deepEqual(failures, [], `Oversized production files:\n${failures.join('\n')}`);
});


test('split CSS files use responsibility-based names', () => {
  const styleFiles = sourceFiles(process.cwd())
    .map(filePath => relative(process.cwd(), filePath).replaceAll('\\', '/'))
    .filter(filePath => filePath.endsWith('.css'));
  const vague = styleFiles.filter(filePath => /(?:\.part\d+|(?:^|[-_])[ab]\.css$)/i.test(filePath));
  assert.deepEqual(vague, [], `Vague CSS filenames:\n${vague.join('\n')}`);
});
