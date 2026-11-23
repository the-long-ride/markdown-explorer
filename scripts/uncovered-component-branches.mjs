import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const reportPath = process.argv[2] ?? 'coverage/coverage-final.json';
const filter = process.argv[3] ?? '';
const coverage = JSON.parse(readFileSync(reportPath, 'utf8'));
const files = [];

for (const [file, { branchMap, b }] of Object.entries(coverage)) {
  const path = relative(process.cwd(), file).replaceAll('\\', '/');
  if (!path.startsWith('ui/src/components/') || !path.includes(filter)) continue;

  const lines = new Map();
  let total = 0;
  for (const [id, hits] of Object.entries(b)) {
    const branch = branchMap[id];
    for (const [index, count] of hits.entries()) {
      if (count !== 0) continue;
      const start = branch.locations?.[index]?.start ?? branch.loc?.start;
      const line = start?.line ?? branch.line ?? 0;
      const entries = lines.get(line) ?? [];
      entries.push(`${branch.type} ${id}:${index}@${start?.column ?? '?'}`);
      lines.set(line, entries);
      total++;
    }
  }
  if (total > 0) files.push({ path, total, lines });
}

for (const { path, total, lines } of files.sort((a, b) => b.total - a.total || a.path.localeCompare(b.path))) {
  console.log(`${total} ${path}`);
  for (const [line, entries] of [...lines].sort(([a], [b]) => a - b)) {
    console.log(`  ${line} (${entries.length}): ${entries.join(', ')}`);
  }
}
