import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requestedOutput = process.argv[2];
const outDir = requestedOutput
  ? resolve(process.cwd(), requestedOutput)
  : resolve(uiRoot, 'public', 'export-runtime');

const entries = [
  ['core', 'src/export/runtime/entry-core.ts'],
  ['html-preview', 'src/export/runtime/entry-html-preview.ts'],
  ['media', 'src/export/runtime/entry-media.ts'],
  ['table', 'src/export/runtime/entry-table.ts'],
  ['charts', 'src/export/runtime/entry-charts.ts'],
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
const manifest = {};

for (const [name, relativeEntry] of entries) {
  const result = await build({
    configFile: false,
    root: uiRoot,
    logLevel: 'error',
    esbuild: { legalComments: 'none' },
    build: {
      outDir,
      emptyOutDir: false,
      sourcemap: false,
      minify: 'esbuild',
      lib: {
        entry: resolve(uiRoot, relativeEntry),
        name: `MarkdownExplorerExport${name.replace(/(^|-)([a-z])/g, (_match, _dash, letter) => letter.toUpperCase())}`,
        formats: ['iife'],
        fileName: () => `${name}.js`,
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  });

  const outputs = Array.isArray(result) ? result.flatMap((item) => item.output) : result.output;
  const chunk = outputs.find((output) => output.type === 'chunk');
  const modules = chunk ? Object.keys(chunk.modules) : [];
  manifest[name] = {
    file: `${name}.js`,
    chartJs: modules.some((id) => /(?:^|[/\\])chart\.js(?:[/\\]|$)/.test(id) || id.includes('/chart.js/')),
    mermaid: modules.some((id) => /(?:^|[/\\])mermaid(?:[/\\]|$)/.test(id) || id.includes('/mermaid/')),
  };
}

await writeFile(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
