import { describe, expect, it } from 'vitest';

import {
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} from '../../../website-app/src/web-file-mode';

describe('demo file-mode workspace loading', () => {
  it('reveals the workspace shell after the shared 3-second threshold', () => {
    expect(WORKSPACE_SCAN_REVEAL_DELAY_MS).toBe(3000);
  });

  it('publishes cumulative workspace refreshes in 32-file batches', () => {
    expect(WORKSPACE_SCAN_BATCH_SIZE).toBe(32);
  });
});
