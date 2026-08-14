import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(repoRoot, 'manual-tests/test-diagrams.md');
const source = fs.readFileSync(fixturePath, 'utf8');

function fixtureBlocks(markdown) {
  const headings = [...markdown.matchAll(/^(#{2,3})\s+((?:\d+|8b)\.)\s+[^\r\n]+/gm)];
  const result = new Map();
  for (let index = 0; index < headings.length; index += 1) {
    const match = headings[index];
    const key = match[2].slice(0, -1);
    const end = headings[index + 1]?.index ?? markdown.length;
    const section = markdown.slice(match.index, end);
    const fence = section.match(/```\r?\n([\s\S]*?)\r?\n```/);
    if (fence) result.set(key, fence[1].trim());
  }
  return result;
}

const fixtures = fixtureBlocks(source);
const lines = (key) => fixtures.get(key).split(/\r?\n/).filter((line) => line.trim().length > 0);

test('manual Mermaid coverage keeps all 23 families plus the wide Gantt regression', () => {
  for (let number = 1; number <= 23; number += 1) {
    assert.ok(fixtures.has(String(number)), `missing fixture ${number}`);
  }
  assert.ok(fixtures.has('8b'), 'missing wide Gantt regression');
  assert.equal(fixtures.size, 24);
  assert.doesNotMatch(source, /```(?:mermaid|diagram)/i, 'fixtures must remain untagged code fences');
});

test('manual Mermaid fixtures are substantial stress cases rather than minimal smoke examples', () => {
  const minimumLines = {
    1: 14, 2: 10, 3: 18, 4: 18, 5: 15, 6: 24, 7: 14, 8: 16, '8b': 18,
    9: 7, 10: 14, 11: 7, 12: 15, 13: 9, 14: 16, 15: 13, 16: 9, 17: 11,
    18: 10, 19: 14, 20: 13, 21: 12, 22: 26,
  };
  for (const [key, minimum] of Object.entries(minimumLines)) {
    assert.ok(lines(key).length >= minimum, `fixture ${key} should have at least ${minimum} non-empty lines`);
  }
  assert.equal(fixtures.get('23'), 'info', 'info syntax has no structural body to expand');
});

test('manual Mermaid fixtures exercise family-specific readability pressure', () => {
  assert.match(fixtures.get('1'), /subgraph\s+/i);
  assert.match(fixtures.get('1'), /--[^\n]*\|[^\n]+\|/);

  assert.match(fixtures.get('3'), /\balt\b/);
  assert.match(fixtures.get('3'), /\bloop\b/);
  assert.ok((fixtures.get('3').match(/participant\s+/g) ?? []).length >= 4);

  assert.ok((fixtures.get('6').match(/\{[\s\S]*?\}/g) ?? []).length >= 3);
  assert.match(fixtures.get('8'), /\bafter\s+\w+/);
  assert.match(fixtures.get('8'), /\bmilestone\b/);
  assert.match(fixtures.get('8b'), /\bcrit\b/);

  assert.ok((fixtures.get('9').match(/^\s*"[^"]+"\s*:/gm) ?? []).length >= 5);
  assert.ok((fixtures.get('10').match(/:\s*\[[0-9.]+,\s*[0-9.]+\]/g) ?? []).length >= 6);
  assert.match(fixtures.get('11'), /^\s*bar\s+\[/m);
  assert.match(fixtures.get('11'), /^\s*line\s+\[/m);

  assert.ok(lines('12').some((line) => /^\s{8,}\S/.test(line)), 'mindmap should contain deep nesting');
  assert.ok((fixtures.get('14').match(/\bbranch\s+/g) ?? []).length >= 2);
  assert.ok((fixtures.get('14').match(/\bmerge\s+/g) ?? []).length >= 2);
  assert.match(fixtures.get('14'), /\btag\s*:/);

  assert.match(fixtures.get('15'), /\b(?:Boundary|System_Boundary)\s*\(/);
  assert.ok((fixtures.get('15').match(/\bRel\s*\(/g) ?? []).length >= 4);
  assert.ok(lines('16').filter((line) => line.includes(',')).length >= 8);

  assert.match(fixtures.get('17'), /\bblock:\w+/);
  assert.match(fixtures.get('17'), /--[^\n]*-->/);
  assert.ok(lines('18').filter((line) => /^\s*(?:\+\d+|\d+(?:-\d+)?):/.test(line)).length >= 8);
  assert.match(fixtures.get('19'), /@\{/);

  assert.match(fixtures.get('20'), /\bgroup\s+/);
  assert.match(fixtures.get('20'), /\bjunction\s+/);
  assert.ok((fixtures.get('20').match(/\bservice\s+/g) ?? []).length >= 4);

  assert.match(fixtures.get('21'), /@Actor|@Database/);
  assert.match(fixtures.get('21'), /\b(?:if|while|par)\s*\(/);
  assert.ok((fixtures.get('22').match(/\b(?:requirement|functionalRequirement|performanceRequirement|element)\s+/g) ?? []).length >= 4);
  assert.ok((fixtures.get('22').match(/\s-\s(?:contains|satisfies|verifies|traces|refines)\s->\s/g) ?? []).length >= 3);
});

test('manual Mermaid fixtures have a real parser validation command in the UI workspace', () => {
  const scriptPath = path.join(repoRoot, 'ui/scripts/validate-mermaid-manual.mjs');
  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'ui/package.json'), 'utf8'));
  assert.ok(fs.existsSync(scriptPath), 'missing Mermaid fixture parser validation script');
  assert.equal(packageJson.scripts['validate:mermaid-fixtures'], 'node scripts/validate-mermaid-manual.mjs');
  const validator = fs.readFileSync(scriptPath, 'utf8');
  assert.match(validator, /registerExternalDiagrams/);
  assert.match(validator, /mermaid\.parse/);
  assert.match(validator, /test-diagrams\.md/);
});

test('Flowchart and Requirement fixtures use parser-safe Mermaid syntax', () => {
  const flowchart = fixtures.get('1');
  assert.doesNotMatch(flowchart, /--\|(?:Yes|No)\|/, 'flowchart labels must be attached to an arrow');
  assert.match(flowchart, /Detect\s+-->\|Yes\|\s+Theme/);
  assert.match(flowchart, /Detect\s+-->\|No\|\s+Code/);

  const requirement = fixtures.get('22');
  assert.doesNotMatch(requirement, /^\s*type:\s+(?!")[^\r\n]+$/gm, 'free-form requirement element types must be quoted');
  assert.doesNotMatch(requirement, /^\s*docRef\s*:/gm, 'Requirement element property is documented as lowercase docref');
  assert.match(requirement, /^\s*type:\s*"automated test suite"$/m);
  assert.match(requirement, /^\s*docref:\s*"tests\/node\/mermaid-rendering-quality\.test\.mjs"$/m);
  assert.match(requirement, /^\s*type:\s*"manual renderer fixture"$/m);
  assert.match(requirement, /^\s*docref:\s*"manual-tests\/test-diagrams\.md"$/m);
  assert.match(requirement, /^\s*id:\s*1$/m);
  assert.match(requirement, /^\s*id:\s*1\.1$/m);
  assert.match(requirement, /^\s*id:\s*1\.2$/m);
  assert.doesNotMatch(requirement, /^\s*id:\s*"MDX-REQ-/m, 'manual fixture should use Mermaid documented numeric ids');

  const architecture = fixtures.get('20');
  assert.match(architecture, /^\s*browser:R\s+--\s+L:ingress$/m, 'junction feeder should not draw a floating arrowhead');
  assert.match(architecture, /^\s*extension:R\s+--\s+L:ingress$/m, 'junction feeder should not draw a floating arrowhead');
});
