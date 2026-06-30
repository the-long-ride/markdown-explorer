function createPerfTimer({ hrtime, isEnabled } = {}) {
  const enabled = isEnabled === true;
  const marks = new Map();
  const rendererMarks = new Map();

  function now() {
    return Number(hrtime.bigint()) / 1_000_000;
  }

  function mark(name) {
    if (!enabled) return;
    marks.set(name, now());
    console.log(`[perf] mark ${name}`);
  }

  function measure(name, startName, endName = name) {
    if (!enabled) return;
    const start = marks.get(startName);
    const end = marks.get(endName) ?? now();
    if (typeof start === "number") {
      console.log(`[perf] ${name}: ${Math.round(end - start)}ms`);
    }
  }

  function setRendererMarks(entries) {
    if (!enabled || !entries) return;
    Object.assign(rendererMarks, entries);
  }

  function printSummary() {
    if (!enabled) return;
    const pairs = [];
    if (marks.has("main:required") && marks.has("electron:ready")) {
      pairs.push(["Module require", marks.get("main:required"), marks.get("electron:ready")]);
    }
    if (marks.has("electron:ready") && marks.has("window:created")) {
      pairs.push(["Window create", marks.get("electron:ready"), marks.get("window:created")]);
    }
    if (marks.has("window:created") && marks.has("renderer:did-finish-load")) {
      pairs.push(["HTML load + renderer boot", marks.get("window:created"), marks.get("renderer:did-finish-load")]);
    }
    console.log("\n[perf] ==== COLD START SUMMARY ====");
    let totalStart = null;
    let totalEnd = null;
    for (const [label, start, end] of pairs) {
      console.log(`[perf]   ${label}: ${Math.round(end - start)}ms`);
      if (totalStart === null) totalStart = start;
      totalEnd = end;
    }
    if (totalStart !== null && totalEnd !== null) {
      console.log(`[perf]   TOTAL (main require → renderer load): ${Math.round(totalEnd - totalStart)}ms`);
    }
    if (rendererMarks["renderer:entry"] != null) {
      const rtEntry = rendererMarks["renderer:entry"];
      console.log(`[perf]   Renderer JS entry: ${rtEntry}ms (from nav start)`);
    }
    if (rendererMarks["renderer:react-mounted"] != null) {
      console.log(`[perf]   React mounted: ${rendererMarks["renderer:react-mounted"]}ms (from nav start)`);
    }
    console.log("[perf] ================================\n");
  }

  return { mark, measure, setRendererMarks, printSummary };
}

const perf = createPerfTimer({
  hrtime: process.hrtime,
  isEnabled: process.env.MDN_PERF === "1",
});

module.exports = { mark: perf.mark, measure: perf.measure, setRendererMarks: perf.setRendererMarks, printSummary: perf.printSummary, createPerfTimer };
