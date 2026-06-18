const enabled = process.env.MDN_PERF === "1";
const marks = new Map();

function now() {
  return Number(process.hrtime.bigint()) / 1_000_000;
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

module.exports = { mark, measure };
