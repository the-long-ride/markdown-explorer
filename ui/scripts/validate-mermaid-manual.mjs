import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mermaid from 'mermaid';
import zenuml from '@mermaid-js/mermaid-zenuml';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = path.resolve(uiRoot, '../manual-tests/test-diagrams.md');
const markdown = fs.readFileSync(fixturePath, 'utf8');

function extractFixtures(source) {
  const headings = [...source.matchAll(/^(#{2,3})\s+((?:\d+|8b)\.)\s+([^\r\n]+)/gm)];
  return headings.map((match, index) => {
    const end = headings[index + 1]?.index ?? source.length;
    const section = source.slice(match.index, end);
    const fence = section.match(/```\r?\n([\s\S]*?)\r?\n```/);
    if (!fence) throw new Error(`Missing untagged diagram fence under ${match[2]} ${match[3]}`);
    return {
      label: `${match[2]} ${match[3]}`,
      source: fence[1].trim(),
    };
  });
}

await mermaid.registerExternalDiagrams([zenuml]);
mermaid.initialize({ startOnLoad: false, securityLevel: 'loose' });

const fixtures = extractFixtures(markdown);
const failures = [];
for (const fixture of fixtures) {
  try {
    await mermaid.parse(fixture.source, { suppressErrors: false });
  } catch (error) {
    failures.push({ fixture, error });
  }
}

if (failures.length > 0) {
  for (const { fixture, error } of failures) {
    console.error(`\n[Mermaid syntax error] ${fixture.label}`);
    console.error(fixture.source.split(/\r?\n/).slice(0, 8).join('\n'));
    console.error(error instanceof Error ? error.message : String(error));
  }
  process.exitCode = 1;
} else {
  console.log(`Validated ${fixtures.length} Mermaid manual fixtures from ${path.relative(uiRoot, fixturePath)}.`);
}
