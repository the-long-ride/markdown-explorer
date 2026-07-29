import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  'chromium-xtension/package.json',
  'chromium-xtension/manifest.json',
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

// 4. Sync website/index.html
const indexHtmlPath = path.join(rootDir, 'website/index.html');
if (fs.existsSync(indexHtmlPath)) {
  let content = fs.readFileSync(indexHtmlPath, 'utf8');
  const updated = content.replace(/"softwareVersion":\s*"[^"]*"/, `"softwareVersion": "${version}"`);
  if (content !== updated) {
    fs.writeFileSync(indexHtmlPath, updated, 'utf8');
    console.log(`Synced: website/index.html -> ${version}`);
  }
}

// 5. Sync website/llm.txt
const llmTxtPath = path.join(rootDir, 'website/llm.txt');
if (fs.existsSync(llmTxtPath)) {
  let content = fs.readFileSync(llmTxtPath, 'utf8');
  const updated = content.replace(/- Current version:\s*\d+\.\d+\.\d+/, `- Current version: ${version}`);
  if (content !== updated) {
    fs.writeFileSync(llmTxtPath, updated, 'utf8');
    console.log(`Synced: website/llm.txt -> ${version}`);
  }
}

console.log('Version synchronization complete.');

