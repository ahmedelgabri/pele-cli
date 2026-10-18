# pele-cli

Command-line interface for [Pele](https://pele.run). Validate diagrams and render them to themeable SVG files, from single files, Markdown documents, or stdin.

```sh
npm install -g pele-cli

pele check docs/*.md              # validate every diagram, exit 1 on errors
pele render diagram.mmd           # writes diagram.svg
pele render README.md -o assets   # writes assets/README-1.svg, README-2.svg, ...
cat flow.mmd | pele render --theme auto > flow.svg
pele types                        # diagram types Pele supports
```

## Inputs

| Input              | Diagrams                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| `.mmd`, `.mermaid` | The whole file is one diagram.                                                       |
| `.md`, `.markdown` | Every ` ```mermaid ` code block. Blocks quoted inside other code blocks are skipped. |
| `-` or no files    | One diagram from stdin. `render` writes the SVG to stdout.                           |

Pele reads Mermaid syntax and supports every diagram type built into Mermaid 12.1.0. External Mermaid plugins such as ZenUML are not supported. Run `pele types` for the full list.

## Validation

`check` runs each diagram through Pele's parser and layout engine, so it also catches semantic errors and size limits. Errors use Pele's error codes (`syntax`, `semantic`, `limit`, `unsupported-diagram`) and point at the line and column in the input file, including inside Markdown:

```
docs/guide.md:42:11: syntax error in sequence diagram
  Parse error on line 3:
    ??? nope
  ----------^
  Expecting 'SOLID_OPEN_ARROW', ...
1 invalid diagram of 4
```

`render` reports errors the same way and still writes the valid diagrams.

Exit codes: `0` all diagrams valid, `1` invalid diagrams, `2` usage or file errors.

## Theming

Pele's SVG uses [CSS variables](https://pele.run/theming) and has no background, so by default it takes its colors from the page that embeds it. To make a standalone file that keeps its colors:

- `--theme light|dark` embeds the light or dark palette that pele.run uses, with a background.
- `--theme auto` embeds both palettes and follows the viewer's `prefers-color-scheme`.
- `--css <file>` embeds your own CSS after the theme, for example `.pele { --pele-accent: #d14d41 }`.

## Pele render options

Each flag maps to a Pele [`RenderOptions`](https://pele.run/api#renderoptions) field. Flags you leave out use Pele's defaults.

| Flag                                                                    | Pele option                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `--max-width <px>`                                                      | `maxWidth`: narrow widths make Pele wrap labels and rearrange the layout |
| `--no-auto-direction`                                                   | `autoDirection: false`                                                   |
| `--direction-breakpoint <px>`                                           | `directionBreakpoint`                                                    |
| `--no-responsive`                                                       | `responsive: false`                                                      |
| `--font-family <font>`, `--font-family-mono <font>`, `--font-size <px>` | `fontFamily`, `fontFamilyMono`, `fontSize`                               |
| `--padding <px>`                                                        | `padding`                                                                |
| `--now <date>`                                                          | `now`, for reproducible Gantt charts                                     |
| `--limit <chars>`, `--output-limit <chars>`, `--max-edges <n>`          | `limit`, `outputLimit`, `maxEdges`                                       |
| `--no-links`, `--no-images`                                             | `links: false`, `images: false`                                          |
| `--link-schemes <list>`, `--image-schemes <list>`                       | `linkSchemes`, `imageSchemes` (comma-separated)                          |
| `--link-rel <value>`                                                    | `linkRel`                                                                |

Outside a browser, Pele estimates label widths from a built-in width table instead of measuring the real font ([Text measurement](https://pele.run/api#text-measurement)). Labels in an unusually wide or narrow font may not fit their shapes exactly.

### Flags that do not go together

A flag that would have no effect is an error (exit code 2), so a typo or a forgotten flag does not pass silently:

- `check` does not use `--out-dir`, `--theme`, or `--css`. `types` takes no files and no flags.
- `--no-links` with `--link-schemes` or `--link-rel`, `--no-images` with `--image-schemes`, and `--no-auto-direction` with `--direction-breakpoint`: Pele ignores those settings while the feature is off.
- `--direction-breakpoint` and `--[no-]auto-direction` need `--max-width`: Pele only rearranges a layout to fit a width.
- `-` (stdin) cannot be combined with files or `--out-dir`.

## Development

Needs Node 22.4 or later. The Nix flake provides Node and pnpm.

```sh
pnpm install
node src/cli.ts --help   # runs the TypeScript source directly
pnpm run check           # tsc, oxlint (type-aware), oxfmt --check, tests, e2e tests
pnpm test                # unit and CLI tests against src/
pnpm run test:e2e        # builds, packs, installs the tarball, and tests the installed `pele`
pnpm run format          # oxfmt
pnpm run build           # compiles to dist/
```

The e2e theme tests open the SVGs in a headless Chromium-based browser and check the computed colors. They look for Helium, Google Chrome, or Chromium in the usual places; set `PELE_E2E_BROWSER` to a browser binary to choose one. Without a browser they are skipped, and the test output says so.

### Fixtures

`e2e/fixtures/cases/<case>/` holds real input files and an `expected.json` that lists the inputs, the last line of `check`, the SVGs `render` writes, and every error (`file:line:col`, Pele error code, diagram type). Each case runs through both `check` and `render`. `e2e/fixtures/types/` has one `.mmd` per Pele diagram type, taken from https://pele.run/examples, and a test fails if `pele types` lists a type with no fixture. To add a case, add a folder with inputs and an `expected.json`. Fixtures are not formatted by oxfmt, and `.gitattributes` keeps their bytes (CRLF, BOM) as they are.
