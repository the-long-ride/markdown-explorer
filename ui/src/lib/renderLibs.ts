import "highlight.js/styles/github-dark.css";
import "katex/dist/katex.min.css";

let highlightPromise: Promise<any> | null = null;
let mermaidPromise: Promise<any> | null = null;
let chartPromise: Promise<any> | null = null;
let katexPromise: Promise<any> | null = null;

function getWindowObject() {
  return window as any;
}

function makeRetryable<T>(
  load: () => Promise<T>,
  reset: (promise: Promise<T>) => void,
): Promise<T> {
  const promise = load().catch((error) => {
    reset(promise);
    throw error;
  });
  return promise;
}

export function getHighlightJs() {
  if (!highlightPromise) {
    highlightPromise = makeRetryable(async () => {
      const [{ default: hljs }, ...languages] = await Promise.all([
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
      ]);
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
    }, (promise) => {
      if (highlightPromise === promise) highlightPromise = null;
    });
  }

  return highlightPromise;
}

export function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = makeRetryable(
      () => Promise.all([
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
      }),
      (promise) => {
        if (mermaidPromise === promise) mermaidPromise = null;
      },
    );
  }

  return mermaidPromise;
}

export function getChart() {
  if (!chartPromise) {
    chartPromise = makeRetryable(
      () => import("chart.js").then((mod) => {
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
      }),
      (promise) => {
        if (chartPromise === promise) chartPromise = null;
      },
    );
  }

  return chartPromise;
}

export function getKatex() {
  if (!katexPromise) {
    katexPromise = makeRetryable(
      () => import("katex").then((mod) => mod.default),
      (promise) => {
        if (katexPromise === promise) katexPromise = null;
      },
    );
  }

  return katexPromise;
}
