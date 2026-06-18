let highlightPromise: Promise<any> | null = null;
let mermaidPromise: Promise<any> | null = null;
let chartPromise: Promise<any> | null = null;
let katexPromise: Promise<any> | null = null;

function getWindowObject() {
  return window as any;
}

export function getHighlightJs() {
  if (!highlightPromise) {
    highlightPromise = Promise.all([
      import("highlight.js/lib/core"),
      import("highlight.js/lib/languages/javascript"),
      import("highlight.js/lib/languages/typescript"),
      import("highlight.js/lib/languages/json"),
      import("highlight.js/lib/languages/css"),
      import("highlight.js/lib/languages/xml"),
      import("highlight.js/lib/languages/markdown"),
      import("highlight.js/lib/languages/bash"),
      import("highlight.js/lib/languages/powershell"),
      import("highlight.js/lib/languages/yaml"),
      import("highlight.js/lib/languages/python"),
    ]).then(([{ default: hljs }, ...languages]) => {
      const names = [
        "javascript",
        "typescript",
        "json",
        "css",
        "xml",
        "markdown",
        "bash",
        "powershell",
        "yaml",
        "python",
      ];

      names.forEach((name, index) => {
        hljs.registerLanguage(name, languages[index].default);
      });

      hljs.registerAliases(["js", "jsx", "mjs", "cjs"], { languageName: "javascript" });
      hljs.registerAliases(["ts", "tsx"], { languageName: "typescript" });
      hljs.registerAliases(["html", "xhtml", "svg"], { languageName: "xml" });
      hljs.registerAliases(["sh", "shell"], { languageName: "bash" });
      hljs.registerAliases(["ps1", "pwsh"], { languageName: "powershell" });
      hljs.registerAliases(["yml"], { languageName: "yaml" });

      getWindowObject().hljs = hljs;
      return hljs;
    });
  }

  return highlightPromise;
}

export function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([
      import("mermaid"),
      import("@mermaid-js/mermaid-zenuml"),
    ]).then(async ([{ default: mermaid }, { default: zenuml }]) => {
      try {
        await mermaid.registerExternalDiagrams([zenuml]);
      } catch (err) {
        console.error("Failed to register ZenUML:", err);
      }

      getWindowObject().mermaid = mermaid;
      return mermaid;
    });
  }

  return mermaidPromise;
}

export function getChart() {
  if (!chartPromise) {
    chartPromise = import("chart.js").then((mod) => {
      mod.Chart.register(
        mod.ArcElement,
        mod.BarController,
        mod.BarElement,
        mod.CategoryScale,
        mod.DoughnutController,
        mod.Legend,
        mod.LineController,
        mod.LineElement,
        mod.LinearScale,
        mod.PointElement,
        mod.Tooltip,
      );

      getWindowObject().Chart = mod.Chart;
      return mod.Chart;
    });
  }

  return chartPromise;
}

export function getKatex() {
  if (!katexPromise) {
    katexPromise = import("katex").then((mod) => mod.default);
  }

  return katexPromise;
}
