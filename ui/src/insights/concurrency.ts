export const INSIGHTS_SOURCE_READ_CONCURRENCY = 8;

export type AsyncLimiter = <T>(task: () => Promise<T> | T) => Promise<T>;

export function createAsyncLimiter(maxConcurrency = INSIGHTS_SOURCE_READ_CONCURRENCY): AsyncLimiter {
  const limit = Math.max(1, Math.floor(maxConcurrency) || 1);
  let active = 0;
  const queue: Array<() => void> = [];

  const drain = () => {
    while (active < limit && queue.length) queue.shift()?.();
  };

  return <T>(task: () => Promise<T> | T): Promise<T> => new Promise<T>((resolve, reject) => {
    queue.push(() => {
      active += 1;
      let result: Promise<T> | T;
      try {
        result = task();
      } catch (error) {
        active -= 1;
        reject(error);
        drain();
        return;
      }
      Promise.resolve(result)
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    });
    drain();
  });
}
