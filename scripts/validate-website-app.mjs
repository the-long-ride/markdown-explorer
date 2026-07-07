// Quick validation script: verifies that the test markdown files exist
// and that the virtual-workspace logic would correctly build entries from them.
// Run with: node scripts/validate-website-app.mjs

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEST_DIR = join(__dirname, '..', 'test');
const DIST_DIR = join(__dirname, '..', 'website-app', 'dist');

const PASS = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

let failures = 0;

function check(label, cond, detail = '') {
  if (cond) {
    console.log(`  ${PASS}  ${label}`);
  } else {
    console.log(`  ${FAIL}  ${label}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
}

console.log('\n\x1b[1mValidating website-app build\x1b[0m\n');

// ── 1. Test markdown files ──────────────────────────────────────────────────
console.log('1. Test markdown files in test/');
let testFiles = [];
try {
  const entries = await readdir(TEST_DIR);
  testFiles = entries.filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  check(`Found ${testFiles.length} test files`, testFiles.length >= 5);
  for (const f of testFiles) {
    const content = await readFile(join(TEST_DIR, f), 'utf-8');
    check(`  ${f} — readable, ${content.length} chars`, content.length > 10);
  }
} catch (err) {
  check('test/ directory accessible', false, err.message);
}

// ── 2. Build output ────────────────────────────────────────────────────────
console.log('\n2. Build output in website-app/dist/');
try {
  const entries = await readdir(DIST_DIR);
  check('dist/index.html exists', entries.includes('index.html'));
  check('dist/assets/ exists', entries.includes('assets'));

  const assets = await readdir(join(DIST_DIR, 'assets'));
  const jsFiles = assets.filter(f => f.endsWith('.js'));
  const cssFiles = assets.filter(f => f.endsWith('.css'));
  const fonts = assets.filter(f => f.endsWith('.ttf') || f.endsWith('.woff2'));

  check(`JS chunks present (${jsFiles.length})`, jsFiles.length >= 10);
  check(`CSS files present (${cssFiles.length})`, cssFiles.length >= 1);
  check(`Fonts copied (${fonts.length})`, fonts.length >= 5);

  const hasVendorReact = jsFiles.some(f => f.includes('vendor-react'));
  const hasAppState = jsFiles.some(f => f.includes('AppStateContext'));
  const hasIndex = jsFiles.some(f => f === 'index.js');
  const hasAppShell = jsFiles.some(f => f.includes('AppShell'));

  check('vendor-react.js chunk', hasVendorReact);
  check('AppStateContext.js chunk', hasAppState);
  check('index.js (entry)', hasIndex);
  check('AppShell.js chunk', hasAppShell);

  // Read index.html and check base path
  const indexHtml = await readFile(join(DIST_DIR, 'index.html'), 'utf-8');
  check('Base path /markdown-explorer/app/ in index.html',
    indexHtml.includes('/markdown-explorer/app/assets/'));
  check('Splash screen in index.html', indexHtml.includes('class="splash"'));
  check('Module script tag', indexHtml.includes('type="module"'));
} catch (err) {
  check('dist/ directory accessible', false, err.message);
}

// ── 3. Source files ────────────────────────────────────────────────────────
console.log('\n3. Source files in website-app/src/');
const SRC_DIR = join(__dirname, '..', 'website-app', 'src');
try {
  const src = await readdir(SRC_DIR);
  check('main-web.tsx exists', src.includes('main-web.tsx'));
  check('web-host.ts exists', src.includes('web-host.ts'));
  check('virtual-workspace.ts exists', src.includes('virtual-workspace.ts'));

  // Check main-web.tsx imports
  const mainWeb = await readFile(join(SRC_DIR, 'main-web.tsx'), 'utf-8');
  check('main-web.tsx imports web-host', mainWeb.includes('web-host'));
  check('main-web.tsx imports ui/src/main', mainWeb.includes('ui/src/main'));

  // Check web-host.ts
  const webHost = await readFile(join(SRC_DIR, 'web-host.ts'), 'utf-8');
  check('web-host.ts sets up __webDemoBus', webHost.includes('__webDemoBus'));
  check('web-host.ts handles ready command', webHost.includes("'ready'"));
  check('web-host.ts handles navigate command', webHost.includes("'navigate'"));
  check('web-host.ts handles searchWorkspace', webHost.includes("'searchWorkspace'"));
  check('web-host.ts test mode', webHost.includes("mode === 'test'"));
  check('web-host.ts file mode (else branch)', webHost.includes('File mode') || webHost.includes('file mode') || webHost.includes("pickDirectory"));
  check('web-host.ts imports virtual-workspace', webHost.includes('virtual-workspace'));
  check('web-host.ts imports chromium scanner', webHost.includes('BrowserScanner'));

  // Check virtual-workspace.ts
  const vw = await readFile(join(SRC_DIR, 'virtual-workspace.ts'), 'utf-8');
  check('virtual-workspace.ts uses import.meta.glob', vw.includes('import.meta.glob'));
  check('virtual-workspace.ts exports virtualFiles', vw.includes('export const virtualFiles'));
  check('virtual-workspace.ts exports virtualTree', vw.includes('export const virtualTree'));
  check('virtual-workspace.ts exports getVirtualContent', vw.includes('export function getVirtualContent'));
} catch (err) {
  check('src/ files accessible', false, err.message);
}

// ── 4. GHA workflow ────────────────────────────────────────────────────────
console.log('\n4. GitHub Actions workflow');
const GHA = join(__dirname, '..', '.github', 'workflows', 'deploy-website.yml');
try {
  const yml = await readFile(GHA, 'utf-8');
  check('Watches website-app/** paths', yml.includes('website-app/**'));
  check('Installs pnpm', yml.includes('pnpm/action-setup'));
  check('Installs Node.js', yml.includes('actions/setup-node'));
  check('Installs dependencies', yml.includes('pnpm install'));
  check('Builds website-app', yml.includes('pnpm --filter ./website-app'));
  check('Copies dist to website/app', yml.includes('website/app'));
  check('Has separate build/deploy jobs', yml.includes('needs: build'));
} catch (err) {
  check('GHA workflow readable', false, err.message);
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log(`\x1b[32m✓ All checks passed!\x1b[0m\n`);
} else {
  console.log(`\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`);
  process.exit(1);
}
