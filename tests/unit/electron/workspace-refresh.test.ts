import { describe, expect, test } from 'vitest';

import {
  isSupportedWatchPath,
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
} from '../../../desktop/workspace-refresh.js';

describe('workspace-refresh', () => {
  test('watch refresh ignores extra document changes when document conversion is disabled', () => {
    expect(
      isWatchChangeRelevant({
        changedPath: 'C:/docs/report.xlsx',
        documentConversionEnabled: false,
      }),
    ).toBe(false);
  });

  test('watch refresh accepts extra document changes when document conversion is enabled', () => {
    expect(
      isWatchChangeRelevant({
        changedPath: 'C:/docs/report.xlsx',
        documentConversionEnabled: true,
      }),
    ).toBe(true);
  });

  test('watch refresh accepts markdown changes when document conversion is disabled', () => {
    expect(
      isWatchChangeRelevant({
        changedPath: 'C:/docs/guide.md',
        documentConversionEnabled: false,
      }),
    ).toBe(true);
  });

  test('watch refresh notifies when the current open file changed', () => {
    expect(
      shouldNotifyCurrentFileChanged({
        currentFile: 'C:/docs/guide.md',
        changedPath: 'C:/docs/GUIDE.MD',
        currentFileStillAvailable: true,
      }),
    ).toBe(true);
  });

  test('watch refresh notifies when the current open file is no longer available after scan', () => {
    expect(
      shouldNotifyCurrentFileChanged({
        currentFile: 'C:/docs/guide.md',
        changedPath: 'C:/docs/other.md',
        currentFileStillAvailable: false,
      }),
    ).toBe(true);
  });

  test('isWatchChangeRelevant returns true when changedPath is empty', () => {
    expect(isWatchChangeRelevant({ changedPath: '', documentConversionEnabled: false })).toBe(true);
  });

  test('isWatchChangeRelevant returns true when changedPath is undefined', () => {
    expect(isWatchChangeRelevant({ documentConversionEnabled: false })).toBe(true);
  });

  test('isWatchChangeRelevant returns true for file with no extension', () => {
    expect(isWatchChangeRelevant({ changedPath: 'C:/docs/Makefile', documentConversionEnabled: false })).toBe(true);
  });

  test('shouldNotifyCurrentFileChanged returns false when currentFile is empty', () => {
    expect(shouldNotifyCurrentFileChanged({ currentFile: '', changedPath: 'C:/docs/guide.md' })).toBe(false);
  });

  test('shouldNotifyCurrentFileChanged returns false when currentFile is undefined', () => {
    expect(shouldNotifyCurrentFileChanged({ changedPath: 'C:/docs/guide.md' })).toBe(false);
  });

  test('shouldNotifyCurrentFileChanged returns false when changedPath is empty and file still available', () => {
    expect(shouldNotifyCurrentFileChanged({ currentFile: 'C:/docs/guide.md', changedPath: '' })).toBe(false);
  });

  test('shouldNotifyCurrentFileChanged returns false for different file paths', () => {
    expect(
      shouldNotifyCurrentFileChanged({
        currentFile: 'C:/docs/guide.md',
        changedPath: 'C:/docs/other.md',
        currentFileStillAvailable: true,
      }),
    ).toBe(false);
  });

  test('isSupportedWatchPath returns false for unsupported extension with conversion enabled and ext not in EXTRA set', () => {
    expect(isWatchChangeRelevant({ changedPath: 'C:/docs/image.xyz', documentConversionEnabled: true })).toBe(false);
  });

  test('isSupportedWatchPath !ext returns true for file with no extension via isWatchChangeRelevant', () => {
    expect(isWatchChangeRelevant({ changedPath: 'Makefile', documentConversionEnabled: true })).toBe(true);
  });

  test('isWatchChangeRelevant !changedPath returns true for undefined', () => {
    expect(isWatchChangeRelevant({ })).toBe(true);
  });

  test('shouldNotifyCurrentFileChanged !currentFile returns false for undefined', () => {
    expect(shouldNotifyCurrentFileChanged({ })).toBe(false);
  });

  test('shouldNotifyCurrentFileChanged !changedPath returns false for undefined with currentFile set', () => {
    expect(shouldNotifyCurrentFileChanged({ currentFile: 'C:/docs/guide.md' })).toBe(false);
  });

  test('isSupportedWatchPath returns true for .markdown extension', () => {
    expect(isWatchChangeRelevant({ changedPath: 'C:/docs/guide.markdown', documentConversionEnabled: false })).toBe(true);
  });

  test('isSupportedWatchPath null filePath passes through String()', () => {
    expect(isWatchChangeRelevant({ changedPath: null, documentConversionEnabled: false })).toBe(true);
  });
});

describe('isSupportedWatchPath', () => {
  test('returns true when ext is empty (no extension)', () => {
    expect(isSupportedWatchPath('Makefile', false)).toBe(true);
  });

  test('returns true for base supported extension', () => {
    expect(isSupportedWatchPath('guide.md', false)).toBe(true);
    expect(isSupportedWatchPath('notes.markdown', false)).toBe(true);
  });

  test('returns false for extra document extension when conversion disabled', () => {
    expect(isSupportedWatchPath('report.doc', false)).toBe(false);
  });

  test('returns true for extra document extension when conversion enabled', () => {
    expect(isSupportedWatchPath('report.doc', true)).toBe(true);
  });

  test('returns false for unsupported extension even with conversion enabled', () => {
    expect(isSupportedWatchPath('image.xyz', true)).toBe(false);
  });

  test('handles empty and null filePath', () => {
    expect(isSupportedWatchPath('', false)).toBe(true);
    expect(isSupportedWatchPath(null as any, false)).toBe(true);
  });
});
