// ============================================================
// markdown/highlighter.ts — Minimal regex-based syntax highlighting
// ============================================================

type Rule = [RegExp, string];

type TokenMatch = {
  start: number;
  end: number;
  cls: string;
  text: string;
};

const SIMPLE_GROUP_A_CLASSES = new Set(['cm', 'str', 'attr']);
const DOLLAR_BRACE_LANGS = new Set([
  'javascript', 'js',
  'typescript', 'ts',
  'bash', 'sh', 'shell',
  'php', 'hack',
  'perl', 'pl',
  'kotlin', 'kt',
  'scala',
  'dart',
  'csharp', 'cs', 'c#',
]);
const BARE_DOLLAR_LANGS = new Set([
  'bash', 'sh', 'shell',
  'php', 'hack',
  'perl', 'pl',
  'kotlin', 'kt',
  'scala',
  'dart',
]);
const HASH_BRACE_LANGS = new Set(['ruby', 'rb', 'elixir', 'ex', 'exs']);
const PYTHON_LANGS = new Set(['python', 'py']);
const JAVASCRIPT_LANGS = new Set(['javascript', 'js', 'typescript', 'ts']);
const CSHARP_LANGS = new Set(['csharp', 'cs', 'c#']);

function cloneGlobalRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
}

function isSingleQuotedString(value: string): boolean {
  return /^(?:[rRuUbBfF]+)?'''/.test(value) || /^(?:[rRuUbBfF]+)?'/.test(value);
}

function isPythonFString(value: string): boolean {
  return /^[rRuUbB]*[fF][rRuUbB]*(?=["'])/.test(value);
}

function isCSharpInterpolatedString(value: string): boolean {
  return /^\$@?"/.test(value) || /^@\$"/.test(value);
}

function highlightStringInterpolations(value: string, lang: string): string {
  const canUseDollarBrace = DOLLAR_BRACE_LANGS.has(lang) &&
    (!JAVASCRIPT_LANGS.has(lang) || value.startsWith('`')) &&
    (!CSHARP_LANGS.has(lang) || isCSharpInterpolatedString(value));
  const canUseBareDollar = BARE_DOLLAR_LANGS.has(lang) && !isSingleQuotedString(value) && !/^r["']/.test(value);
  const canUseHashBrace = HASH_BRACE_LANGS.has(lang) && !isSingleQuotedString(value);
  const canUsePythonBrace = PYTHON_LANGS.has(lang) && isPythonFString(value);
  const canUseSwiftParen = lang === 'swift' && !isSingleQuotedString(value);

  let result = value;
  if (canUseDollarBrace) {
    result = result.replace(/(\$\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  }
  if (canUseHashBrace) {
    result = result.replace(/(#\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  }
  if (canUseSwiftParen) {
    result = result.replace(/(\\\()([^()\n]+)(\))/g, '$1<span class="hl-var">$2</span>$3');
  }
  if (canUsePythonBrace || (CSHARP_LANGS.has(lang) && isCSharpInterpolatedString(value))) {
    result = result.replace(/(\{)([^{}\n]+)(\})/g, '$1<span class="hl-var">$2</span>$3');
  }
  if (canUseBareDollar) {
    result = result.replace(/(\$)(?!\{)([\w#@*!?-]+)/g, '$1<span class="hl-var">$2</span>');
  }

  return result;
}

import { RULES } from './highlightRules';

const TERMINAL_LANGS = new Set([
  'bash', 'sh', 'shell', 'zsh', 'powershell', 'pwsh', 'cmd', 'terminal',
]);

type TerminalProtectedToken = {
  start: number;
  end: number;
  cls: 'str' | 'cm';
  text: string;
};

function escapeTerminalHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightTerminal(code: string, lang: string): string {
  const protectedTokens: TerminalProtectedToken[] = [];
  let cursor = 0;

  while (cursor < code.length) {
    const quote = code[cursor];
    if (quote === '"' || quote === "'") {
      let end = cursor + 1;
      while (end < code.length) {
        if (code[end] === quote && code[end - 1] !== '\\') {
          end += 1;
          break;
        }
        end += 1;
      }
      protectedTokens.push({ start: cursor, end, cls: 'str', text: code.slice(cursor, end) });
      cursor = end;
      continue;
    }
    if (quote === '#') {
      const end = code.indexOf('\n', cursor);
      const commentEnd = end === -1 ? code.length : end;
      protectedTokens.push({ start: cursor, end: commentEnd, cls: 'cm', text: code.slice(cursor, commentEnd) });
      cursor = commentEnd;
      continue;
    }
    cursor += 1;
  }

  const protectedByStart = new Map(protectedTokens.map((token) => [token.start, token]));
  const powershell = lang === 'powershell' || lang === 'pwsh';
  const variablePattern = powershell
    ? /^\$(?:env:)?[A-Za-z_][\w:.-]*/
    : /^\$(?:\{?[A-Za-z_#@*!?-]+\}?)/;
  const parameterPattern = powershell
    ? /^(?:-[A-Za-z?][\w-]*|\/[A-Za-z][\w-]*)/
    : /^(?:--[A-Za-z0-9][\w-]*|--|-[A-Za-z?][\w-]*)/;
  const scalarPattern = powershell
    ? /^(?:\d+(?:\.\d+)?|true|false|null|\$(?:true|false|null))\b/i
    : /^(?:\d+(?:\.\d+)?|true|false|null)\b/i;
  const wordPattern = /^[^\s"'#$&|;<>^=]+/;
  const operators = ['&&', '||', '>>', '<<', '|', ';', '>', '<', '^'];

  let output = '';
  let index = 0;
  let commandPosition = true;

  const appendToken = (text: string, cls?: string) => {
    output += cls
      ? '<span class="hl-' + cls + '">' + escapeTerminalHtml(text) + '</span>'
      : escapeTerminalHtml(text);
  };

  while (index < code.length) {
    const protectedToken = protectedByStart.get(index);
    if (protectedToken) {
      const escaped = escapeTerminalHtml(protectedToken.text);
      const content = protectedToken.cls === 'str'
        ? highlightStringInterpolations(escaped, lang)
        : escaped;
      output += '<span class="hl-' + protectedToken.cls + '">' + content + '</span>';
      index = protectedToken.end;
      continue;
    }

    const current = code[index];
    if (/\s/.test(current)) {
      output += escapeTerminalHtml(current);
      if (current === '\n') {
        const continued = code[index - 1] === '\\' || (powershell && code[index - 1] === String.fromCharCode(96)) || code[index - 2] === '\\';
        if (!continued) commandPosition = true;
      }
      index += 1;
      continue;
    }

    const continuation = (current === '\\' || (powershell && current === String.fromCharCode(96))) &&
      (code[index + 1] === '\n' || (code[index + 1] === '\r' && code[index + 2] === '\n'));
    const operator = operators.find((candidate) => code.startsWith(candidate, index));
    if (continuation) {
      appendToken(current, 'op');
      commandPosition = false;
      index += 1;
      continue;
    }
    if (operator) {
      appendToken(operator, 'op');
      commandPosition = operator !== '^';
      index += operator.length;
      continue;
    }

    const parameter = code.slice(index).match(parameterPattern)?.[0];
    if (parameter) {
      appendToken(parameter, 'param');
      index += parameter.length;
      commandPosition = false;
      continue;
    }

    const variable = code.slice(index).match(variablePattern)?.[0];
    if (variable) {
      const cls = powershell && /^\$(?:true|false|null)$/i.test(variable) ? 'val' : 'var';
      appendToken(variable, cls);
      index += variable.length;
      commandPosition = false;
      continue;
    }

    const scalar = code.slice(index).match(scalarPattern)?.[0];
    if (scalar) {
      appendToken(scalar, 'val');
      index += scalar.length;
      commandPosition = false;
      continue;
    }

    const word = code.slice(index).match(wordPattern)?.[0];
    if (word) {
      appendToken(word, commandPosition ? 'cmd' : undefined);
      commandPosition = false;
      index += word.length;
      continue;
    }

    appendToken(current);
    commandPosition = false;
    index += 1;
  }

  return output;
}

export function highlight(code: string, lang: string): string {
  // Escape &, <, > initially, but keep literal double quotes so string regexes can match them.
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (!lang) return escaped;

  const lowerLang = lang.toLowerCase();

  if (TERMINAL_LANGS.has(lowerLang)) {
    return highlightTerminal(code, lowerLang);
  }
  
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

  // Partition rules into simple Group A tokens, complex Group A replacements, and Group B.
  // Simple tokens are masked by source position so `//` inside a string stays part of the string.
  const simpleGroupA: Rule[] = [];
  const complexGroupA: Rule[] = [];
  const groupB: Rule[] = [];
  for (const rule of rules) {
    const [_, cls] = rule;
    const isSimpleGroupA = SIMPLE_GROUP_A_CLASSES.has(cls);
    const isComplexGroupA = cls.includes('hl-cm') || cls.includes('hl-str') || cls.includes('hl-attr');
    if (isSimpleGroupA) {
      simpleGroupA.push(rule);
    } else if (isComplexGroupA) {
      complexGroupA.push(rule);
    } else {
      groupB.push(rule);
    }
  }

  // Phase 1: Mask comments/strings/attributes by lexical position, not rule order.
  const tokenMatches: TokenMatch[] = [];
  for (const [regex, cls] of simpleGroupA) {
    const matcher = cloneGlobalRegex(regex);
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(result)) !== null) {
      const text = match[0];
      if (!text) {
        matcher.lastIndex += 1;
        continue;
      }
      tokenMatches.push({
        start: match.index,
        end: match.index + text.length,
        cls,
        text,
      });
    }
  }

  tokenMatches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  let maskedResult = '';
  let cursor = 0;
  let maskedUntil = 0;
  for (const match of tokenMatches) {
    if (match.start < maskedUntil) continue;

    maskedResult += result.slice(cursor, match.start);
    const content = match.cls === 'str'
      ? highlightStringInterpolations(match.text, lowerLang)
      : match.text;
    const idx = placeholders.length;
    placeholders.push(`<span class="hl-${match.cls}">${content}</span>`);
    maskedResult += getPlaceholder(idx);
    cursor = match.end;
    maskedUntil = match.end;
  }
  result = maskedResult + result.slice(cursor);

  // Phase 1b: Run complex Group A replacements, then mask their spans too.
  for (const [regex, cls] of complexGroupA) {
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

