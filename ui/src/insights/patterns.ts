export type InsightsPatternSource = 'hard' | 'builtin' | 'gitignore' | 'user' | 'default';

export interface InsightsPathDecision {
  readonly included: boolean;
  readonly source: InsightsPatternSource;
  readonly pattern?: string;
}

export interface InsightsPathMatcher {
  test(path: string): boolean;
  explain(path: string): InsightsPathDecision;
}

export interface InsightsPathMatcherOptions {
  readonly gitignore?: readonly string[];
  readonly userPatterns?: readonly string[];
  readonly builtInPatterns?: readonly string[];
}

const HARD_EXCLUSIONS = [
  '.git/**',
  '.markdown-explorer/**',
  '.markdown-explorer-cache/**',
] as const;

export const DEFAULT_INSIGHTS_EXCLUSIONS = [
  'node_modules/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  'vendor/**',
] as const;

interface CompiledRule {
  readonly raw: string;
  readonly include: boolean;
  readonly source: Exclude<InsightsPatternSource, 'hard' | 'default'>;
  readonly regex: RegExp;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/');
}

function validatePattern(pattern: string): void {
  let brackets = 0;
  let escaped = false;
  for (const char of pattern) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '[') brackets += 1;
    if (char === ']') brackets -= 1;
    if (brackets < 0) throw new Error(`Invalid Insights pattern: ${pattern}`);
  }
  if (escaped || brackets !== 0) throw new Error(`Invalid Insights pattern: ${pattern}`);
}

function escapeRegex(char: string): string {
  return /[.+^${}()|\\]/.test(char) ? `\\${char}` : char;
}

function globToRegex(rawPattern: string): RegExp {
  validatePattern(rawPattern);
  let pattern = normalizePath(rawPattern);
  const directoryOnly = pattern.endsWith('/');
  if (directoryOnly) pattern += '**';

  let out = '^';
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        while (pattern[i + 1] === '*') i += 1;
        if (pattern[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      continue;
    }
    if (char === '[') {
      const close = pattern.indexOf(']', i + 1);
      const body = pattern.slice(i + 1, close);
      if (!body || body === '!') throw new Error(`Invalid Insights pattern: ${rawPattern}`);
      const negated = body.startsWith('!');
      out += `[${negated ? '^' : ''}${body.slice(negated ? 1 : 0).replace(/\\/g, '\\\\')}]`;
      i = close;
      continue;
    }
    out += escapeRegex(char);
  }
  out += '$';
  return new RegExp(out);
}

function compileRules(
  patterns: readonly string[],
  source: CompiledRule['source'],
): CompiledRule[] {
  return patterns.flatMap((value) => {
    const raw = value.trim();
    if (!raw || raw === '!') return [];
    const include = raw.startsWith('!');
    const pattern = include ? raw.slice(1) : raw;
    if (!pattern) throw new Error(`Invalid Insights pattern: ${raw}`);
    return [{ raw, include, source, regex: globToRegex(pattern) }];
  });
}

const HARD_RULES = HARD_EXCLUSIONS.map((pattern) => ({
  pattern,
  regex: globToRegex(pattern),
}));

export function createInsightsPathMatcher(options: InsightsPathMatcherOptions = {}): InsightsPathMatcher {
  const builtin = compileRules(options.builtInPatterns ?? DEFAULT_INSIGHTS_EXCLUSIONS, 'builtin');
  const gitignore = compileRules(options.gitignore ?? [], 'gitignore');
  const user = compileRules(options.userPatterns ?? [], 'user');
  const orderedRules = [...builtin, ...gitignore, ...user];

  const explain = (inputPath: string): InsightsPathDecision => {
    const path = normalizePath(inputPath);
    const hard = HARD_RULES.find((rule) => rule.regex.test(path));
    if (hard) return { included: false, source: 'hard', pattern: hard.pattern };

    let decision: InsightsPathDecision = { included: true, source: 'default' };
    for (const rule of orderedRules) {
      if (!rule.regex.test(path)) continue;
      decision = {
        included: rule.include,
        source: rule.source,
        pattern: rule.raw,
      };
    }
    return decision;
  };

  return {
    test: (path) => explain(path).included,
    explain,
  };
}
