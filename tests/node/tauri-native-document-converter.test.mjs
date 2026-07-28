import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function collectTextFiles(rootRelativePath) {
  const root = path.join(repoRoot, rootRelativePath);
  if (!fs.existsSync(root)) return '';
  const chunks = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && /\.(?:rs|json|ya?ml|toml|mjs|js)$/.test(entry.name)) {
        chunks.push(fs.readFileSync(absolute, 'utf8'));
      }
    }
  };
  visit(root);
  return chunks.join('\n');
}

test('Tauri document conversion stays in-process and ships no Node sidecar', () => {
  const sourcesAndConfig = [
    collectTextFiles('tauri/src'),
    collectTextFiles('tauri/scripts'),
    collectTextFiles('tauri/sidecar'),
    read('tauri/tauri.conf.json'),
    read('tauri/package.json'),
    read('pnpm-workspace.yaml'),
    collectTextFiles('.github/workflows'),
    collectTextFiles('snap'),
  ].join('\n');

  assert.doesNotMatch(sourcesAndConfig, /prepare-document-sidecar|mdthem-sidecar|markdown-them-node|externalBin/);
  assert.doesNotMatch(sourcesAndConfig, /Command::new\([^)]*(?:node|npm|pnpm)/i);
  assert.match(read('tauri/src/render/mod.rs'), /pub mod native_document_converter;/);
  assert.match(read('tauri/src/render/document_converter.rs'), /native_document_converter::convert_file/);
});

test('Tauri native converter declares every supported document extension', () => {
  const converter = read('tauri/src/render/native_document_converter/mod.rs');
  for (const extension of ['doc', 'docx', 'pdf', 'html', 'xls', 'xlsx', 'xlm', 'pptx', 'odt', 'odp', 'ods', 'rtf']) {
    assert.match(converter, new RegExp(`\\"${extension}\\"`));
  }
  assert.match(converter, /ConversionQuality::BestEffortLegacy/);
});


test('Tauri native converter uses only approved local Rust adapters', () => {
  const cargo = read('tauri/Cargo.toml');
  assert.match(cargo, /office_oxide = \{ version = "0\.1\.8", default-features = false \}/);
  assert.match(cargo, /pdf-extract = "0\.12"/);
  assert.match(cargo, /html2markdown = \{ version = "0\.2\.0", default-features = false \}/);
  assert.match(cargo, /rtf-parser = \{ version = "0\.4\.3", default-features = false \}/);
  assert.match(cargo, /quick-xml = "0\.41"/);
  assert.match(cargo, /calamine = "0\.36"/);
  assert.doesNotMatch(cargo, /^html2md\s*=/m);
});

test('Tauri HTML Markdown view uses the native Rust converter while keeping source preview', () => {
  const handlers = read('tauri/src/dispatcher/handlers.rs');
  const content = read('ui/src/components/Content/Content.tsx');

  assert.match(handlers, /let conversion_enabled = if is_html_document \{ true \} else \{ doc_conv \};/);
  assert.match(handlers, /converter\.read_markdown\(&file_path_str, conversion_enabled\)/);
  assert.doesNotMatch(handlers, /let result = if is_html_document \{\s*None/);
  assert.match(content, /hostHtmlMarkdownSource/);
  assert.match(content, /if \(hostHtmlMarkdownSource\)[\s\S]{0,120}return \{ html: hostHtmlMarkdownHtml/);
});
