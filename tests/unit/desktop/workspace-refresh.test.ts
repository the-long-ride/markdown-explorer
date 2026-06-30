import { describe, expect, test } from 'vitest';

import {
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
});
