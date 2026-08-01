const DOLLAR_BRACE_LANGS = new Set([
  'javascript', 'js', 'typescript', 'ts', 'bash', 'sh', 'shell', 'php', 'hack',
  'perl', 'pl', 'kotlin', 'kt', 'scala', 'dart', 'csharp', 'cs', 'c#',
]);
const BARE_DOLLAR_LANGS = new Set([
  'bash', 'sh', 'shell', 'php', 'hack', 'perl', 'pl', 'kotlin', 'kt', 'scala', 'dart',
]);
const HASH_BRACE_LANGS = new Set(['ruby', 'rb', 'elixir', 'ex', 'exs']);
const PYTHON_LANGS = new Set(['python', 'py']);
const JAVASCRIPT_LANGS = new Set(['javascript', 'js', 'typescript', 'ts']);
const CSHARP_LANGS = new Set(['csharp', 'cs', 'c#']);

function isSingleQuotedString(value: string): boolean {
  return /^(?:[rRuUbBfF]+)?'''/.test(value) || /^(?:[rRuUbBfF]+)?'/.test(value);
}

function isPythonFString(value: string): boolean {
  return /^[rRuUbB]*[fF][rRuUbB]*(?=["'])/.test(value);
}

function isCSharpInterpolatedString(value: string): boolean {
  return /^\$@?"/.test(value) || /^@\$"/.test(value);
}

export function highlightStringInterpolations(value: string, lang: string): string {
  const canUseDollarBrace = DOLLAR_BRACE_LANGS.has(lang)
    && (!JAVASCRIPT_LANGS.has(lang) || value.startsWith('`'))
    && (!CSHARP_LANGS.has(lang) || isCSharpInterpolatedString(value));
  const canUseBareDollar = BARE_DOLLAR_LANGS.has(lang) && !isSingleQuotedString(value) && !/^r["']/.test(value);
  const canUseHashBrace = HASH_BRACE_LANGS.has(lang) && !isSingleQuotedString(value);
  const canUsePythonBrace = PYTHON_LANGS.has(lang) && isPythonFString(value);
  const canUseSwiftParen = lang === 'swift' && !isSingleQuotedString(value);

  let result = value;
  if (canUseDollarBrace) result = result.replace(/(\$\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  if (canUseHashBrace) result = result.replace(/(#\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  if (canUseSwiftParen) result = result.replace(/(\\\()([^()\n]+)(\))/g, '$1<span class="hl-var">$2</span>$3');
  if (canUsePythonBrace || (CSHARP_LANGS.has(lang) && isCSharpInterpolatedString(value))) {
    result = result.replace(/(\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  }
  if (canUseBareDollar) result = result.replace(/(\$)(?!\{)([\w#@*!?-]+)/g, '$1<span class="hl-var">$2</span>');
  return result;
}
