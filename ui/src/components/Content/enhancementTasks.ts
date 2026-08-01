export interface EnhancementTask {
  label: string;
  run: () => void | Promise<void>;
}

export async function runEnhancementTasks(
  tasks: readonly EnhancementTask[],
  isCancelled: () => boolean,
): Promise<void> {
  if (isCancelled()) return;

  await Promise.all(tasks.map(async ({ label, run }) => {
    if (isCancelled()) return;
    try {
      await run();
    } catch (error) {
      console.error(`${label} error:`, error);
    }
  }));
}
