# Cleanup, `--format`, and `--markdown-out`

## Cleanup (from a reuse, simplification, efficiency, and altitude review)

Fixed:

- Flag names are defined once. `args.ts` splits the parseArgs options into render, output, and report groups, and the per-command flag lists are derived from them. The conflict rules name flags as `keyof Flags`, so tsc catches typos.
- The keyword list is a `Record<DiagramType, ...>`, so tsc fails when a Pele upgrade adds or drops a type. The e2e test no longer hard-codes 33.
- Theme validation lives in `themeCss(name)`.
- Whether input is stdin is decided once, before reading, so `--out-dir` with stdin fails without waiting for the input.
- Tests share one source runner and one e2e render helper, and the 33 diagram-type fixtures render in one CLI run.

Skipped, with reasons:

- Help text that restates rules and Pele's defaults: it is user documentation.
- The version parsing in `src/usage.ts` and `e2e/install.ts`: kept separate so the e2e `--version` test checks the CLI independently.
- Async, concurrent test runners: a change to every test file for a few seconds.
- One browser page for all theme tests: each SVG's `<style>` targets `.pele`, so the themes would affect each other on one page.

## `--format text|json|github`

- `github` prints one workflow annotation per error (`::error file=,line=,col=,title=::message`, with GitHub's escaping). It is the default when `GITHUB_ACTIONS=true`.
- The annotations go to stderr. The Actions runner reads workflow commands from stderr as well as stdout (`ScriptHandler` wires both streams to `OutputManager`, which calls `TryProcessCommand`), and stdout stays free for the SVG when rendering stdin.
- `json` prints `{diagrams, invalid, errors, written}` on stdout, and is rejected when `render` writes the SVG to stdout.
- `src/report.ts` owns the formats. Errors are collected while rendering and reported once.
- The test runner clears `GITHUB_ACTIONS`, because CI sets it; tests that need it pass `env`.

## `--markdown-out <file>`

- Writes a copy of one Markdown input where each rendered block becomes `![<type> diagram](<svg>)`. The path is relative to the new file, and the block's indent is kept.
- Saves each rendered diagram's source as `.mmd` next to its SVG.
- Rejected blocks stay as code, and line endings are preserved.
- Takes exactly one Markdown input, and the output must not be the input, so the diagram source is never overwritten.
- `src/markdown-out.ts` holds the pure rewriting functions. `src/outputs.ts` holds the file writing that used to be in `commands.ts`, which keeps it under the import limit.

Totals after these changes: 25 unit and CLI tests, 71 e2e tests.
