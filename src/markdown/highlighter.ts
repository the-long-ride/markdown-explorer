// ============================================================
// markdown/highlighter.ts — Minimal regex-based syntax highlighting
// ============================================================

type Rule = [RegExp, string];

const RULES: Record<string, Rule[]> = {
  javascript: [
    [/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|import|export|default|from|of|in|typeof|instanceof|async|await|try|catch|finally|throw|void|delete|yield|this)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
    [/(<span class="hl-kw">(const|let|var)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/(<span class="hl-kw">class<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$2</span>'],
    [/(<span class="hl-kw">function<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)\s*(?=\??\s*:)/g, 'prop'],
    [/\b([A-Z][a-z0-9]\w*)\b/g, 'sel'],
  ],
  typescript: [
    [/\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|class|new|import|export|default|from|of|in|typeof|instanceof|async|await|try|catch|finally|throw|void|delete|yield|interface|type|enum|extends|implements|readonly|public|private|protected|abstract|declare|namespace|module|as|satisfies|keyof|infer|never|unknown|any|this)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
    [/(<span class="hl-kw">(const|let|var)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/(<span class="hl-kw">(class|interface|type|enum)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">function<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)\s*(?=\??\s*:)/g, 'prop'],
    [/\b(number|string|boolean|void|any|unknown|never|symbol|bigint|object)\b/g, 'sel'],
    [/\b([A-Z][a-z0-9]\w*)\b/g, 'sel'],
  ],
  python: [
    [/\b(def|class|return|if|elif|else|for|while|import|from|as|with|try|except|finally|raise|pass|break|continue|and|or|not|in|is|lambda|True|False|None|yield|global|nonlocal|del|assert)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">class<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$2</span>'],
    [/(<span class="hl-kw">def<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  rust: [
    [/\b(fn|let|mut|pub|use|mod|struct|enum|impl|trait|where|for|while|if|else|match|return|break|continue|loop|type|const|static|unsafe|async|await|move|ref|in|as|dyn|Box|Option|Result|Some|None|Ok|Err|Vec|String|str|bool|true|false)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*")/g, 'str'],
    [/\b(\d+\.?\d*(?:u\d+|i\d+|f\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">(struct|enum|trait|mod|type)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">fn<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/(<span class="hl-kw">let<\/span>\s+(?:mut\s+)?)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*::\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\s*!\s*\()/g, 'func'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  go: [
    [/\b(func|var|const|type|struct|interface|package|import|return|if|else|for|range|switch|case|default|break|continue|goto|defer|go|chan|map|make|new|nil|true|false|string|int|bool|error|any)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|`(?:[^`]*)`)/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
    [/(<span class="hl-kw">package<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-pkg">$2</span>'],
    [/(<span class="hl-kw">import<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-pkg">$2</span>'],
    [/(<span class="hl-kw">func<\/span>\s+(?:\([^)]+\)\s+)?)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/(<span class="hl-kw">(var|const)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*:=)/g, 'var'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
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
    [/\b([\w-]+)\s*:\s*([^;}\n]+)(?=;|})/g, '<span class="hl-prop">$1</span>: $2'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/(#[0-9a-fA-F]{3,8})\b/g, 'num'],
    [/(--[\w-]+)/g, 'var'],
    [/\b([\w-]+)(?=\()/g, 'func'],
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
  c: [
    [/\b(auto|break|case|char|const|continue|default|do|double|else|enum|extern|float|for|goto|if|int|long|register|return|short|signed|sizeof|static|struct|switch|typedef|union|unsigned|void|volatile|while|_Alignas|_Alignof|_Atomic|_Bool|_Complex|_Generic|_Imaginary|_Noreturn|_Static_assert|_Thread_local)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(#[ \t]*\w+)/g, 'kw'],
    [/(<span class="hl-kw">(struct|union|enum)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  cpp: [
    [/\b(alignas|alignof|and|and_eq|asm|atomic_cancel|atomic_commit|atomic_noexcept|auto|bitand|bitor|bool|break|case|catch|char|char8_t|char16_t|char32_t|class|compl|concept|const|consteval|constexpr|constinit|const_cast|continue|co_await|co_return|co_yield|decltype|default|delete|do|double|dynamic_cast|else|enum|explicit|export|extern|false|float|for|friend|goto|if|inline|int|long|mutable|namespace|new|noexcept|not|not_eq|nullptr|operator|or|or_eq|private|protected|public|reflexpr|register|reinterpret_cast|requires|return|short|signed|sizeof|static|static_assert|static_cast|struct|switch|template|this|thread_local|throw|true|try|typedef|typeid|typename|union|unsigned|using|virtual|void|volatile|wchar_t|while|xor|xor_eq)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(#[ \t]*\w+)/g, 'kw'],
    [/(<span class="hl-kw">(class|struct|union|enum|namespace)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\s*-&gt;\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  java: [
    [/\b(abstract|assert|boolean|break|byte|case|catch|char|class|const|continue|default|do|double|else|enum|extends|final|finally|float|for|goto|if|implements|import|instanceof|int|interface|long|native|new|package|private|protected|public|return|short|static|strictfp|super|switch|synchronized|this|throw|throws|transient|try|void|volatile|while|exports|opens|requires|uses|provides|transition|to|with|open|module|record|non-sealed|sealed|permits|yield|var)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">package<\/span>\s+)([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g, '$1<span class="hl-pkg">$2</span>'],
    [/(<span class="hl-kw">(class|interface|record|enum)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  csharp: [
    [/\b(abstract|as|base|bool|break|byte|case|catch|char|checked|class|const|continue|decimal|default|delegate|do|double|else|enum|event|explicit|extern|false|finally|fixed|float|for|foreach|goto|if|implicit|in|int|interface|internal|is|lock|long|namespace|new|null|object|operator|out|override|params|private|protected|public|readonly|ref|return|sbyte|sealed|short|sizeof|stackalloc|static|string|struct|switch|this|throw|true|try|typeof|uint|ulong|unchecked|unsafe|ushort|using|virtual|void|volatile|while|add|alias|and|ascending|args|async|await|by|descending|dynamic|equals|from|get|global|group|init|into|join|let|managed|nameof|not|notnull|on|or|orderby|partial|record|remove|select|set|unmanaged|value|var|when|where|with|yield)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|@"(?:[^"]|"")*")/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">namespace<\/span>\s+)([a-zA-Z_]\w*(?:\.[a-zA-Z_]\w*)*)/g, '$1<span class="hl-pkg">$2</span>'],
    [/(<span class="hl-kw">(class|interface|struct|record)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  php: [
    [/\b(__halt_compiler|abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|foreach|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|from|parent|self)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
    [/(\$[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/g, 'var'],
    [/(<span class="hl-kw">class<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$2</span>'],
    [/(<span class="hl-kw">function<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  ruby: [
    [/\b(alias|and|begin|break|case|class|def|define_method|defined\?|do|else|elsif|end|ensure|false|for|if|in|module|next|nil|not|or|redo|rescue|retry|return|self|super|then|true|undef|unless|until|when|while|yield|__FILE__|__LINE__)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(@[a-zA-Z_]\w*|@@[a-zA-Z_]\w*|\$[a-zA-Z_]\w*)/g, 'var'],
    [/(<span class="hl-kw">(class|module)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">def<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  swift: [
    [/\b(associatedtype|class|deinit|enum|extension|fileprivate|func|import|init|inout|internal|let|open|operator|private|precedencegroup|protocol|public|rethrows|static|struct|subscript|typealias|var|break|case|catch|continue|default|defer|do|else|fallthrough|for|guard|if|in|repeat|return|throw|throws|switch|where|while|any|as|false|is|nil|self|Self|super|true)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|"""[\s\S]*?"""|'[^']')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">(class|struct|enum|protocol)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">func<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/(<span class="hl-kw">(let|var)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  kotlin: [
    [/\b(as|as\?|break|class|continue|do|else|false|for|fun|if|in|interface|is|null|object|package|return|super|this|throw|true|try|typealias|val|var|when|while|by|constructor|delegate|dynamic|field|file|get|init|param|property|receiver|set|setparam|value|where|actual|abstract|annotation|companion|const|crossinline|data|enum|expect|external|final|infix|inline|inner|internal|lateinit|noinline|open|operator|out|override|private|protected|public|reified|sealed|suspend|tailrec|vararg)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|"""[\s\S]*?""")/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">(class|interface|object)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">fun<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/(<span class="hl-kw">(val|var)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  r: [
    [/\b(if|else|repeat|while|function|for|in|next|break|TRUE|FALSE|NULL|Inf|NaN|NA|NA_integer_|NA_real_|NA_complex_|NA_character_)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  scala: [
    [/\b(abstract|case|catch|class|def|do|else|extends|false|final|finally|for|forSome|if|implicit|import|lazy|match|new|null|object|override|package|private|protected|return|sealed|super|this|throw|trait|true|try|type|val|var|while|with|yield|macro)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|"""[\s\S]*?""")/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)\b/g, 'num'],
    [/(<span class="hl-kw">(class|trait|object)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">def<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/(<span class="hl-kw">(val|var)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\s*\.\s*[a-zA-Z_]\w*)/g, 'pkg'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  elixir: [
    [/\b(def|defmodule|defmacro|defp|defmacrop|defstruct|defimpl|defprotocol|defdelegate|defguard|defguardp|fn|do|end|after|else|rescue|catch|throw|receive|case|cond|if|unless|try|raise|quote|unquote|alias|require|import|use|true|false|nil|__DIR__|__FILE__|__MODULE__|__ENV__|__CALLER__)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|~[a-zA-Z]?(?:\{[^}]*\}|\[[^\]]*\]|\([^)]*\)|"[^"]*"))/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*)\b/g, 'num'],
    [/(\b:[a-zA-Z_]\w*)/g, 'sel'],
    [/(<span class="hl-kw">(defmodule|defmacro)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">(def|defp)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  dart: [
    [/\b(abstract|as|assert|async|await|break|case|catch|class|const|continue|covariant|default|deferred|do|dynamic|else|enum|export|extends|extension|external|factory|false|final|finally|for|Function|get|hide|if|implements|import|in|interface|is|late|library|mixin|new|null|on|operator|part|required|rethrow|return|set|show|static|super|switch|sync|this|throw|true|try|typedef|var|void|when|while|with|yield)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|r"(?:[^"])*"|r'(?:[^'])*')/g, 'str'],
    [/\b(0x[0-9a-fA-F]+|\d+\.?\d*)\b/g, 'num'],
    [/(<span class="hl-kw">(class|mixin|extension)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$3</span>'],
    [/(<span class="hl-kw">(var|const|final)<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-var">$3</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  hack: [
    [/\b(__halt_compiler|abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|die|do|echo|else|elseif|empty|enddeclare|endfor|foreach|endforeach|endif|endswitch|endwhile|eval|exit|extends|final|finally|fn|for|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|from|parent|self|async|await|awaitall|category|children|classish|dict|enum|keyset|vec|newtype|shape|super|type|tuple|using|where)\b/g, 'kw'],
    [/(\/\/[^\n]*)/g, 'cm'],
    [/(\/\*[\s\S]*?\*\/)/g, 'cm'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
    [/(\$[a-zA-Z_\x80-\xff][a-zA-Z0-9_\x80-\xff]*)/g, 'var'],
    [/(<span class="hl-kw">class<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-sel">$2</span>'],
    [/(<span class="hl-kw">function<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
  perl: [
    [/\b(accept|alarm|atan2|bind|binmode|bless|break|caller|chdir|chmod|chomp|chop|chown|chr|chroot|close|closedir|connect|continue|cos|crypt|dbmclose|dbmopen|defined|delete|die|do|dump|each|else|elsif|endgrent|endhostent|endnetent|endprotoent|endpwent|endservent|eof|eval|exec|exists|exit|exp|fcntl|fileno|flock|for|foreach|fork|format|formline|getc|getgrent|getgrgid|getgrnam|gethostbyaddr|gethostbyname|gethostent|getlogin|getnetbyaddr|getnetbyname|getnetent|getpeername|getpgrp|getppid|getpriority|getprotobyname|getprotobynumber|getprotoent|getpwent|getpwnam|getpwuid|getservbyname|getservbyport|getservent|getsockname|getsockopt|glob|gmtime|goto|grep|hex|if|import|index|int|ioctl|join|keys|kill|last|lc|lcfirst|length|link|listen|local|localtime|log|lstat|map|mkdir|msgctl|msgget|msgrcv|msgsnd|my|next|no|oct|open|opendir|ord|our|pack|package|pipe|pop|pos|print|printf|prototype|push|quotemeta|rand|read|readdir|readline|readlink|recv|redo|ref|rename|require|reset|return|reverse|rewinddir|rindex|rmdir|say|scalar|seek|seekdir|select|semctl|semget|semop|send|setgrent|sethostent|setnetent|setprotoent|setpwent|setservent|setsockopt|shift|shmctl|shmget|shmread|shmwrite|shutdown|sin|sleep|socket|socketpair|sort|splice|split|sprintf|sqrt|srand|stat|state|study|sub|substr|symlink|syscall|sysopen|sysread|sysseek|system|syswrite|tell|telldir|tie|tied|time|times|truncate|uc|ucfirst|umask|undef|unless|unlink|unpack|unshift|untie|until|use|utime|values|vec|wait|waitpid|wantarray|warn|while|write|sub|my|our|local|use|require|package)\b/g, 'kw'],
    [/(#[^\n]*)/g, 'cm'],
    [/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, 'str'],
    [/\b(\d+\.?\d*)\b/g, 'num'],
    [/([$@%][a-zA-Z_]\w*)/g, 'var'],
    [/(<span class="hl-kw">sub<\/span>\s+)([a-zA-Z_]\w*)/g, '$1<span class="hl-func">$2</span>'],
    [/\b([a-zA-Z_]\w*)(?=\()/g, 'func'],
  ],
};

// Alias common shorthands
RULES.js = RULES.javascript;
RULES.ts = RULES.typescript;
RULES.py = RULES.python;
RULES.sh = RULES.bash;
RULES.shell = RULES.bash;
RULES.scss = RULES.css;
RULES['c++'] = RULES.cpp;
RULES.cs = RULES.csharp;
RULES['c#'] = RULES.csharp;
RULES.golang = RULES.go;
RULES.rb = RULES.ruby;
RULES.rs = RULES.rust;
RULES.kt = RULES.kotlin;
RULES.ex = RULES.elixir;
RULES.exs = RULES.elixir;
RULES.pl = RULES.perl;

export function highlight(code: string, lang: string): string {
  // Escape &, <, > initially, but keep literal double quotes so string regexes can match them.
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (!lang) return escaped;

  const lowerLang = lang.toLowerCase();
  
  let result = escaped;
  const placeholders: string[] = [];

  function getPlaceholder(index: number): string {
    return '\x00' + '\x01'.repeat(index) + '\x00';
  }

  // Handle embedded style/script tags and inline style/on* attributes in HTML before general parsing
  if (lowerLang === 'html') {
    // 1. Highlight inline style="..." attributes
    const inlineStyleRegex = /(\bstyle=")([^"]*)(")/gi;
    result = result.replace(inlineStyleRegex, (_, _openStyle, cssContent, _closeQuote) => {
      const highlightedCss = highlight(cssContent, 'css');
      const replacement = `<span class="hl-attr">style</span>=<span class="hl-str">"</span>${highlightedCss}<span class="hl-str">"</span>`;
      const idx = placeholders.length;
      placeholders.push(replacement);
      return getPlaceholder(idx);
    });

    // 2. Highlight inline on...="..." event handler attributes
    const inlineJsRegex = /(\bon[a-z]+=")([^"]*)(")/gi;
    result = result.replace(inlineJsRegex, (_, openAttr, jsContent, _closeQuote) => {
      const highlightedJs = highlight(jsContent, 'javascript');
      const attrName = openAttr.slice(0, -2);
      const replacement = `<span class="hl-attr">${attrName}</span>=<span class="hl-str">"</span>${highlightedJs}<span class="hl-str">"</span>`;
      const idx = placeholders.length;
      placeholders.push(replacement);
      return getPlaceholder(idx);
    });

    // 3. Highlight <style>...</style> blocks
    const styleRegex = /(&lt;style\b[\s\S]*?&gt;)([\s\S]*?)(&lt;\/style&gt;)/gi;
    result = result.replace(styleRegex, (_, openTag, styleContent, closeTag) => {
      const rawStyleContent = styleContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const highlightedStyle = highlight(rawStyleContent, 'css');
      const idx = placeholders.length;
      placeholders.push(highlightedStyle);
      return openTag + getPlaceholder(idx) + closeTag;
    });

    // 4. Highlight <script>...</script> blocks
    const scriptRegex = /(&lt;script\b[\s\S]*?&gt;)([\s\S]*?)(&lt;\/script&gt;)/gi;
    result = result.replace(scriptRegex, (_, openTag, scriptContent, closeTag) => {
      const rawScriptContent = scriptContent
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
      const highlightedScript = highlight(rawScriptContent, 'javascript');
      const idx = placeholders.length;
      placeholders.push(highlightedScript);
      return openTag + getPlaceholder(idx) + closeTag;
    });
  }

  const rules = RULES[lowerLang];
  if (!rules) return result;

  // Partition rules into Group A (comments, strings, attributes) and Group B (all others)
  const groupA: Rule[] = [];
  const groupB: Rule[] = [];
  for (const rule of rules) {
    const [_, cls] = rule;
    const isGroupA = cls === 'cm' || cls === 'str' || cls === 'attr' ||
                     cls.includes('hl-cm') || cls.includes('hl-str') || cls.includes('hl-attr');
    if (isGroupA) {
      groupA.push(rule);
    } else {
      groupB.push(rule);
    }
  }

  // Phase 1: Run Group A rules and mask their matched spans immediately to isolate comments/strings
  for (const [regex, cls] of groupA) {
    if (cls.includes('<') || cls.includes('$')) {
      result = result.replace(regex, cls);
    } else {
      result = result.replace(regex, (m) => `<span class="hl-${cls}">${m}</span>`);
    }

    // Find and mask all newly created Group A spans
    const spanRegex = /<span class="hl-(?:cm|str|attr)">([\s\S]*?)<\/span>/g;
    result = result.replace(spanRegex, (fullMatch) => {
      const idx = placeholders.length;
      placeholders.push(fullMatch);
      return getPlaceholder(idx);
    });
  }

  // Phase 2: Run Group B rules (keywords, variables, functions, types, etc.)
  for (const [regex, cls] of groupB) {
    if (cls.includes('<') || cls.includes('$')) {
      result = result.replace(regex, cls);
    } else {
      result = result.replace(regex, (m) => `<span class="hl-${cls}">${m}</span>`);
    }
  }

  // Phase 3: Restore the masked comments/strings
  const placeholderRegex = /\x00(\x01*)\x00/g;
  result = result.replace(placeholderRegex, (_, p1) => placeholders[p1.length]);

  return result;
}
