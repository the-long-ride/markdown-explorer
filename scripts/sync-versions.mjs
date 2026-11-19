import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncReadme } from './sync-readme.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Read authoritative version from root package.json
const rootPackagePath = path.join(rootDir, 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const version = rootPackage.version;

console.log(`Authoritative root version: ${version}`);

// 2. Sync JSON files
const jsonFiles = [
  'ui/package.json',
  'vscode/package.json',
  'electron/package.json',
  'website-app/package.json',
  'tauri/package.json',
  'tauri/tauri.conf.json',
];

for (const file of jsonFiles) {
  const filePath = path.join(rootDir, file);
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.version !== version) {
      data.version = version;
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`Synced: ${file} -> ${version}`);
    }
  }
}

// 3. Sync tauri/Cargo.toml
const cargoPath = path.join(rootDir, 'tauri/Cargo.toml');
if (fs.existsSync(cargoPath)) {
  let content = fs.readFileSync(cargoPath, 'utf8');
  const versionRegex = /^(version\s*=\s*")[^"]*(")/m;
  if (versionRegex.test(content)) {
    const updated = content.replace(versionRegex, `$1${version}$2`);
    if (content !== updated) {
      fs.writeFileSync(cargoPath, updated, 'utf8');
      console.log(`Synced: tauri/Cargo.toml -> ${version}`);
    }
  }
}

// 4. Sync website/landing.html
const landingHtmlPath = path.join(rootDir, 'website/landing.html');
if (fs.existsSync(landingHtmlPath)) {
  let content = fs.readFileSync(landingHtmlPath, 'utf8');
  let updated = content.replace(/"softwareVersion":\s*"[^"]*"/, `"softwareVersion": "${version}"`);
  updated = updated.replace(/<span data-version-text>v[^<]*<\/span>/g, `<span data-version-text>v${version}</span>`);
  if (content !== updated) {
    fs.writeFileSync(landingHtmlPath, updated, 'utf8');
    console.log(`Synced: website/landing.html -> ${version}`);
  }
}

// 5. Sync website/llm.txt
const llmTxtPath = path.join(rootDir, 'website/llm.txt');
if (fs.existsSync(llmTxtPath)) {
  let content = fs.readFileSync(llmTxtPath, 'utf8');
  const updated = content.replace(/- (\*\*Current version\*\*|Current version):\s*\d+\.\d+\.\d+/, `- $1: ${version}`);
  if (content !== updated) {
    fs.writeFileSync(llmTxtPath, updated, 'utf8');
    console.log(`Synced: website/llm.txt -> ${version}`);
  }
}

// 6. Sync vscode/README.md from root README.md
syncReadme();

console.log('Version synchronization complete.');
