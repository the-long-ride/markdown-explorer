// ============================================================
// markdown/highlighter.ts — Minimal regex-based syntax highlighting
// ============================================================

import { escHtml } from '../utils';

type Rule = [RegExp, string];

const RULES: Record<string, Rule[]> = {
  javascript: [
    [/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|import|export|default|from|of|in|typeof|instanceof|async|await|try|catch|finally|throw|void|delete|yield)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
  ],
  typescript: [
    [/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|import|export|default|from|of|in|typeof|instanceof|async|await|try|catch|finally|throw|void|delete|yield|interface|type|enum|extends|implements|readonly|public|private|protected|abstract|declare|namespace|module|as|satisfies|keyof|infer|never|unknown|any)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
  ],
  python: [
    [/\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|break|continue|and|or|not|in|is|lambda|True|False|None|yield|global|nonlocal|del|assert)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
  ],
  rust: [
    [/\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|where|for|while|if|else|match|return|break|continue|loop|type|const|static|unsafe|async|await|move|ref|in|as|dyn|Box|Option|Result|Some|None|Ok|Err|Vec|String|str|bool|true|false)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*")/g, 'str'],
    [/\b(\d+\.?\d*(?:u\d+|i\d+|f\d+)?)\b/g, 'num'],
  ],
  go: [
    [/\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|goto|defer|go|chan|map|make|new|nil|true|false|string|int|bool|error|any)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|`(?:[^`]*)`)/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
  ],
  bash: [
    [/\b(echo|cd|ls|mkdir|rm|cp|mv|cat|grep|sed|awk|if|then|else|elif|fi|for|do|done|while|until|function|return|export|source|sudo|chmod|chown|find|xargs|curl|wget|git)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'[^']*')/g, 'str'],
    [/(\$\{?[\w#@*!?-]+\}?)/g, 'var'],
  ],
  json: [
    [/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="hl-attr">$1</span>$2'],
    [/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="hl-str">$1</span>'],
    [/\b(true|false|null)\b/g, 'kw'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
  ],
  css: [
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/([.#:[\w-]+(?:\([^)]*\))?)\s*(?=\{)/g, '<span class="hl-sel">$1</span>'],
    [/([\w-]+)\s*(?=:(?!:))/g, '<span class="hl-prop">$1</span>'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/(#[0-9a-fA-F]{3,8})\b/g, 'num'],
  ],
  html: [
    [/(&lt;!--[\s\S]*?--&gt;)/g, 'cm'],
    [/(&lt;\/?)([\w-]+)/g, '$1<span class="hl-tag">$2</span>'],
    [/\s([\w-]+)(=)/g, ' <span class="hl-attr">$1</span>$2'],
    [/("(?:[^"\\]|\\.)*")/g, 'str'],
  ],
  sql: [
    [/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|AND|OR|NOT|IN|LIKE|IS|NULL|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|DROP|ALTER|ADD|COLUMN|INDEX|PRIMARY|KEY|FOREIGN|REFERENCES|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|COUNT|SUM|AVG|MIN|MAX|UNION|ALL)\b/gi, 'kw'],
    [/(--[^\n]*)/g, 'cm'],
    [/('(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
  ],
  diff: [
    // File headers (+++ / --- / ***)  must come before single +/-
    [/^(\+{3}.*|-{3}.*|\*{3}.*)$/gm, '<span class="hl-diff-meta">$1</span>'],
    // Hunk ranges @@ -x,y +a,b @@ …
    [/^(@@[^@\n]*@@.*)$/gm,          '<span class="hl-diff-hunk">$1</span>'],
    // Additions (single +)
    [/^(\+(?!\+{2}).*)$/gm,          '<span class="hl-diff-add">$1</span>'],
    // Deletions (single -)
    [/^(-(?!-{2}).*)$/gm,            '<span class="hl-diff-del">$1</span>'],
  ],
};

// Alias common shorthands
RULES.js = RULES.javascript;
RULES.ts = RULES.typescript;
RULES.py = RULES.python;
RULES.sh = RULES.bash;
RULES.shell = RULES.bash;
RULES.scss = RULES.css;

export function highlight(code: string, lang: string): string {
  const escaped = escHtml(code);
  if (!lang) return escaped;

  const lowerLang = lang.toLowerCase();
  if (lowerLang !== 'diff') {
    return escaped;
  }

  const rules = RULES[lowerLang];
  if (!rules) return escaped;

  let result = escaped;
  for (const [regex, cls] of rules) {
    if (cls.startsWith('<')) {
      // Raw replacement (e.g. JSON multi-group)
      result = result.replace(regex, cls);
    } else {
      result = result.replace(regex, (m) => `<span class="hl-${cls}">${m}</span>`);
    }
  }
  return result;
}
