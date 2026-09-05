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

  it('catches synchronous errors in tasks and continues processing queue', async () => {
    const limit = createAsyncLimiter(1);
    const results: string[] = [];

    const p1 = limit(() => {
      throw new Error('sync-failure');
    }).catch(err => err.message);

    const p2 = limit(() => {
      results.push('task-2');
      return 'ok';
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('sync-failure');
    expect(r2).toBe('ok');
    expect(results).toEqual(['task-2']);
  });

  it('handles async rejections and drains subsequent tasks', async () => {
    const limit = createAsyncLimiter(1);
    const p1 = limit(async () => {
      throw new Error('async-failure');
    }).catch(err => err.message);

    const p2 = limit(async () => 'recovered');

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('async-failure');
    expect(r2).toBe('recovered');
  });

  it('handles synchronous non-promise return values and invalid limit inputs', async () => {
    const defaultLimiter = createAsyncLimiter(0); // 0 or negative falls back to 1
    const result = await defaultLimiter(() => 42);
    expect(result).toBe(42);

    const nanLimiter = createAsyncLimiter(NaN);
    expect(await nanLimiter(() => 'nan-handled')).toBe('nan-handled');
  });
});
