# Terminal Command Syntax Highlighting Design

## Goal

Improve fenced terminal code blocks in Markdown Explorer so executable names, flags, values, shell operators, continuations, variables, and comments are visually distinct while preserving readable default text for subcommands and ordinary arguments.

## Scope

Terminal mode applies only to explicit fenced languages: `bash`, `sh`, `shell`, `zsh`, `powershell`, `pwsh`, `cmd`, and `terminal`. Existing highlighting for every other language remains unchanged. UI and VS Code renderers must produce equivalent token classes and HTML behavior.

## Rendering model

The existing regex highlighter remains the public entry point. Terminal languages route through a dedicated lexer-style pass that masks quoted strings and comments before classifying the remaining tokens. This avoids recoloring operators, flags, or command-looking text inside strings and comments.

Each command segment starts after the beginning of a line or a command separator (`|`, `||`, `&&`, `;`, and their PowerShell equivalents). The first executable-looking token in a segment receives `hl-cmd`, including names such as `npm`, `python`, `my-app.exe`, relative paths, and absolute paths. Tokens after the command remain default text unless they match another semantic class; subcommands therefore stay readable without competing with the executable.

Terminal-specific classes:

- `hl-cmd`: executable/app token.
- `hl-param`: short/long flags and PowerShell slash-style switches.
- `hl-op`: shell operators, redirections, `^`, backslash continuation, and PowerShell backtick continuation.
- `hl-val`: unquoted scalar values, including booleans and numeric values.
- Existing `hl-str`, `hl-var`, and `hl-cm`: quoted values, environment variables, and comments.

HTML output remains escaped before highlighting. Class wrappers are generated only by the highlighter, so command content cannot inject markup. Unknown terminal syntax falls back to escaped default text.

## Language behavior

`bash`, `sh`, `shell`, and `zsh` support `$VAR`/`${VAR}`, comments beginning with `#`, `--flag`/`-f`, pipes, boolean operators, separators, redirects, `\\` continuation, quoted strings, numeric values, and `true`/`false` values.

`powershell` and `pwsh` support `$env:NAME`/`$Name`, comments beginning with `#`, `-Parameter` and `/Parameter`, pipes, `&&`, `||`, `;`, redirects, backtick continuation, quoted strings, numeric values, and `$true`/`$false`/`$null` literals.

`cmd` and generic `terminal` use the shell-safe token rules without assuming shell-specific built-ins. The first executable after each separator is still marked as a command.

## CSS

Add theme-aware `hl-cmd`, `hl-param`, `hl-op`, and `hl-val` rules beside existing syntax classes. Command color uses the existing function/accent family; flags, operators, and scalar values use muted gray tones; strings, variables, and comments retain current theme colors. No new font or layout changes are required.

## Testing

Add unit tests for both UI and VS Code highlighters and renderer output. Tests cover command detection, subcommand default rendering, flags, strings, numbers, booleans, variables, operators, continuations, comments, quoted text protection, PowerShell syntax, aliases, HTML escaping, and unchanged non-terminal highlighting. Renderer parity tests assert terminal language fences receive highlighted output and existing line-number/copy/collapse behavior remains intact.

## Non-goals

No shell execution, command validation, autocomplete, semantic parsing of every shell grammar, dependency on a third-party shell parser, or automatic detection inside unlabeled/text fences.
