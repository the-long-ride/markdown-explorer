import type { DocumentSnapshot } from './documentSnapshot';
import type { ExportWorkspaceResourceReadResult } from './exportResources';

export interface ExportAsset {
  sourcePath: string;
  outputPath: string;
  bytes: Uint8Array;
  mimeType: string;
}

export type ExportResourceReader = (
  resourcePath: string,
  options?: { documentPath?: string },
) => Promise<ExportWorkspaceResourceReadResult>;

export interface ReferencedAssetResult {
  html: string;
  assets: readonly ExportAsset[];
  warnings: readonly string[];
}

const RESOURCE_PREFIX = '_assets';
const WINDOWS_FORBIDDEN_SEGMENT_CHARACTERS = new Set(['<', '>', ':', '"', '|', '?', '*', '\\']);
const WINDOWS_RESERVED_DEVICE_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

function normalizeRelativePath(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new Error(`Unsafe export resource path: ${value}`);
  }
  const parts = normalized.split('/').filter((part) => part && part !== '.');
  if (parts.some((part) => part === '..')) throw new Error(`Unsafe export resource path: ${value}`);
  return parts.join('/');
}

function isWindowsReservedDeviceSegment(value: string): boolean {
  const stem = value.split('.', 1)[0].replace(/[ .]+$/g, '');
  return WINDOWS_RESERVED_DEVICE_NAME.test(stem);
}

function portableSegment(value: string): string {
  const characters = Array.from(value);
  let trailingUnsafeStart = characters.length;
  while (trailingUnsafeStart > 0) {
    const character = characters[trailingUnsafeStart - 1];
    if (character !== '.' && character !== ' ') break;
    trailingUnsafeStart -= 1;
  }
  const forceEscapeFirst = isWindowsReservedDeviceSegment(value);
  let encoded = '';
  characters.forEach((character, index) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const upperAscii = codePoint >= 0x41 && codePoint <= 0x5a;
    const trailingUnsafe = index >= trailingUnsafeStart && (character === '.' || character === ' ');
    const mustEscape = character === '~'
      || upperAscii
      || codePoint < 0x20
      || codePoint > 0x7e
      || WINDOWS_FORBIDDEN_SEGMENT_CHARACTERS.has(character)
      || trailingUnsafe
      || (forceEscapeFirst && index === 0);
    encoded += mustEscape ? `~${codePoint.toString(16)}~` : character;
  });
  return encoded || 'resource';
}

function portableResourcePath(value: string): string {
  return normalizeRelativePath(value).split('/').map(portableSegment).join('/');
}

function dirname(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '' : normalized.slice(0, index);
}

function relativePath(fromFile: string, toFile: string): string {
  const fromParts = dirname(fromFile).split('/').filter(Boolean);
  const toParts = toFile.replace(/\\/g, '/').split('/').filter(Boolean);
  let common = 0;
  while (common < fromParts.length && common < toParts.length && fromParts[common] === toParts[common]) common += 1;
  return [
    ...Array.from({ length: fromParts.length - common }, () => '..'),
    ...toParts.slice(common),
  ].join('/') || './';
}

function isLocalReference(value: string): boolean {
  const trimmed = value.trim();
  return Boolean(trimmed) && !trimmed.startsWith('#') && !/^(?:data|blob|https?|mailto|tel|javascript):/i.test(trimmed);
}

function suffixForReference(value: string): string {
  const index = value.search(/[?#]/);
  return index >= 0 ? value.slice(index) : '';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
  }
  return globalThis.btoa(binary);
}

function dataUrl(asset: ExportAsset): string {
  return `data:${asset.mimeType};base64,${bytesToBase64(asset.bytes)}`;
}

function referencedOutputPath(relativePath: string): string {
  return `${RESOURCE_PREFIX}/${portableResourcePath(relativePath)}`;
}

export async function collectReferencedExportAssets(args: {
  snapshot: DocumentSnapshot;
  readResource: ExportResourceReader;
  mode: 'inline' | 'package';
  pageOutputPath?: string;
}): Promise<ReferencedAssetResult> {
  if (typeof DOMParser === 'undefined') return { html: args.snapshot.html, assets: [], warnings: [] };
  const parsed = new DOMParser().parseFromString(`<body>${args.snapshot.html}</body>`, 'text/html');
  const targets: Array<{ element: Element; attribute: string }> = [];
  parsed.body.querySelectorAll('img[src],source[src],audio[src],video[src]').forEach((element) => targets.push({ element, attribute: 'src' }));
  parsed.body.querySelectorAll('video[poster]').forEach((element) => targets.push({ element, attribute: 'poster' }));
  const assets = new Map<string, ExportAsset>();
  const warnings: string[] = [];

  for (const { element, attribute } of targets) {
    const raw = element.getAttribute(attribute);
    if (!raw || !isLocalReference(raw)) continue;
    const result = await args.readResource(raw, { documentPath: args.snapshot.file.fsPath });
    if (!result.ok) {
      warnings.push(`Unable to include referenced asset "${raw}" from ${args.snapshot.file.relativePath}: ${result.reason}`);
      continue;
    }
    const sourcePath = normalizeRelativePath(result.relativePath);
    let asset = assets.get(sourcePath);
    if (!asset) {
      asset = {
        sourcePath,
        outputPath: referencedOutputPath(sourcePath),
        bytes: result.bytes,
        mimeType: result.mimeType,
      };
      assets.set(sourcePath, asset);
    }
    const suffix = suffixForReference(raw);
    if (args.mode === 'inline') {
      element.setAttribute(attribute, `${dataUrl(asset)}${suffix}`);
    } else {
      const pagePath = args.pageOutputPath ?? 'index.html';
      element.setAttribute(attribute, `${relativePath(pagePath, asset.outputPath)}${suffix}`);
    }
  }

  return { html: parsed.body.innerHTML, assets: [...assets.values()], warnings };
}
