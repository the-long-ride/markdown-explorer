import { generateMarkdown } from "@the-long-ride/markdown-them";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line.trim());
  } catch {
    console.error("[sidecar] invalid json line:", line);
    return;
  }

  const { id, command, path } = request;
  if (!id || command !== "convert") {
    console.error("[sidecar] unknown request:", request);
    return;
  }

  try {
    const markdown = await generateMarkdown(path);
    process.stdout.write(
      JSON.stringify({ id, ok: true, markdown }) + "\n"
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({ id, ok: false, error }) + "\n"
    );
  }
});

rl.on("close", () => {
  process.exit(0);
});

console.error("[sidecar] markdown-them sidecar ready");