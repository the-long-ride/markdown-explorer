// Minimal regex-based syntax highlighting. Domain parsers live in ./highlighting/.
import { RULES } from './highlightRules';
import { highlightStringInterpolations } from './highlighting/interpolations';
import { highlightTerminal, TERMINAL_LANGS } from './highlighting/terminal';
import { highlightXmlMarkup } from './highlighting/xml';

type Rule = [RegExp, string];
type TokenMatch = { start: number; end: number; cls: string; text: string };
const SIMPLE_GROUP_A_CLASSES = new Set(['cm', 'str', 'attr']);
function cloneGlobalRegex(regex: RegExp): RegExp {
  return new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
}

export function highlight(code: string, lang: string): string {
  // Escape &, <, > initially, but keep literal double quotes so string regexes can match them.
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (!lang) return escaped;

  const lowerLang = lang.toLowerCase();

  if (['xml', 'xhtml', 'svg'].includes(lowerLang)) {
    return highlightXmlMarkup(code);
  }

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

