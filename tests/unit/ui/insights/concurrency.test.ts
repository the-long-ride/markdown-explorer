import { describe, expect, it } from 'vitest';
import { createAsyncLimiter } from '../../../../ui/src/insights/concurrency';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('Insights async limiter', () => {
  it('caps concurrent source work while preserving all queued tasks', async () => {
    const gate = deferred();
    let active = 0;
    let maxActive = 0;
    let completed = 0;
    const limit = createAsyncLimiter(3);
    const tasks = Array.from({ length: 12 }, (_, index) => limit(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (index < 3) await gate.promise;
      active -= 1;
      completed += 1;
    }));

    await Promise.resolve();
    expect(maxActive).toBe(3);
    expect(completed).toBe(0);
    gate.resolve();
    await Promise.all(tasks);
    expect(maxActive).toBe(3);
    expect(completed).toBe(12);
  });
});
