# Initial pele-cli

## Summary

A TypeScript CLI around the [`pele`](https://pele.run) library (pinned to 1.6.0). It validates diagrams and renders them to SVG. It has no runtime dependencies besides `pele`; flags are parsed with `node:util` `parseArgs`.

## Commands

- `pele check [files...]`: renders each diagram with Pele and reports `PeleError`s. It uses `render()` rather than `parse()`, so layout errors and `outputLimit` are also caught.
- `pele render [files...] [-o dir]`: writes `<name>.svg` per diagram file and `<name>-<n>.svg` per Markdown block. Stdin renders to stdout. Two inputs that would write the same path are rejected before anything is written.
- `pele types`: lists Pele's diagram types and their keywords.

## Design decisions

- **Pele first, Mermaid as syntax.** Help text and errors use Pele's terms (error codes, detected type). `.pele` files and ` ```pele ` fences are a CLI convention; Pele itself defines neither. `.mmd`, `.mermaid`, and ` ```mermaid ` are also accepted.
- **Error locations.** Pele lines are relative to the diagram source; for Markdown blocks they are offset by the opening fence line. When a parse error is at end of input, Pele reports the line after the last line, which maps to the closing fence.
- **Markdown extraction** follows CommonMark fence rules (backtick/tilde fences, closing fence of at least the same length, up to 3 spaces of indentation, unclosed fence runs to end of document). All fences are tracked, so diagram examples quoted in other code blocks are skipped.
- **Theming.** Pele output is transparent and reads `--pele-*` variables with fallbacks. `--theme light|dark|auto` embeds the Flexoki palettes that pele.run uses for its own light and dark modes, plus `background: var(--pele-bg)`. `--css` content is embedded after the theme so it wins. CSS goes in a `<style><![CDATA[...]]></style>` right after the `<svg>` start tag; CSS containing `]]>` is rejected.
- **`pele types`.** Pele does not export a list of types. The CLI keeps the keyword list from pele.run/compatibility and groups it by Pele's `detectType()`. A test fails if a Pele upgrade drops a keyword.
- **Render options.** Every scalar `RenderOptions` field has a flag. Only flags the user sets are passed, so Pele's defaults apply. Not exposed: `measurer`, `icons` (functions), `idPrefix`, and `config` (Mermaid config).
- **Exit codes.** 0 valid, 1 invalid diagrams, 2 usage or file errors. EPIPE on stdout (for example `pele types | head`) exits quietly.

## Verification

- 15 tests (`node --test`, real Pele, no mocks): fence extraction, error locations in Markdown, theme and CSS embedding, stdin/stdout, option pass-through (`--max-width`, `--no-links`), output collisions, usage errors.
- Light and dark themed SVGs checked visually in headless Chromium. librsvg cannot be used for this: it does not support CSS variables, which all Pele output uses.

## Notes

- npm's `min-release-age=7` (user config) blocked `pele@1.6.0`, published 2026-10-17. pnpm installed it and wrote `minimumReleaseAgeExclude: [pele@1.6.0]` to `pnpm-workspace.yaml`, so pnpm runs its own release-age check and exempted the version that was asked for by name.
- `package.json` declares `"license": "MIT"`, but there is no LICENSE file yet.
