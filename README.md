# pele-cli

Command-line interface for [Pele](https://pele.run). Validate diagrams and render them to themeable SVG files, from single files, Markdown documents, or stdin. It needs no browser.

Install it from npm as [`@ahmedelgabri/pele-cli`](https://www.npmjs.com/package/@ahmedelgabri/pele-cli) (Node 22.4 or later), or with [Nix](#nix). Either way, the command is `pele`.

```sh
npm install -g @ahmedelgabri/pele-cli

pele check docs/*.md              # validate every diagram, exit 1 on errors
pele render diagram.mmd           # writes diagram.svg
pele render README.md -o assets   # writes assets/README-1.svg, README-2.svg, ...
cat flow.mmd | pele render --theme auto > flow.svg
pele types                        # diagram types Pele supports
```

## Contents

- [Inputs](#inputs)
- [Validation](#validation)
  - [Output formats](#output-formats)
- [Theming](#theming)
- [Markdown with images](#markdown-with-images)
- [Pele render options](#pele-render-options)
  - [Flags that do not go together](#flags-that-do-not-go-together)
- [Nix](#nix)
  - [Working on the flake](#working-on-the-flake)
- [Development](#development)
  - [Fixtures](#fixtures)
- [Releasing](#releasing)

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

### Output formats

`--format` chooses how `check` and `render` report errors:

- `text` (default): the output above, on stderr.
- `github`: one [workflow annotation](https://docs.github.com/actions/reference/workflow-commands-for-github-actions) per error on stderr, so GitHub Actions shows each error on the right line of a pull request. This is the default when `GITHUB_ACTIONS=true`, so `pele check docs/**/*.md` in a workflow needs no flag.
- `json`: one JSON document on stdout with `diagrams`, `invalid`, `errors` (`file`, `line`, `column`, `code`, `type`, `message`; `line` and `column` are `null` when unknown), and for `render`, `written`. Not available when `render` writes the SVG to stdout.

## Theming

Pele's SVG uses [CSS variables](https://pele.run/theming) and has no background, so by default it takes its colors from the page that embeds it. To make a standalone file that keeps its colors:

- `--theme light|dark` embeds the light or dark palette that pele.run uses, with a background.
- `--theme auto` embeds both palettes and follows the viewer's `prefers-color-scheme`.
- `--css <file>` embeds your own CSS after the theme, for example `.pele { --pele-accent: #d14d41 }`.

## Markdown with images

`--markdown-out <file>` writes a copy of a Markdown file where each diagram is replaced by its rendered image. This is for places that can't render Mermaid, such as a static site or a package README:

```sh
pele render docs/guide.md -o assets --markdown-out site/guide.md
```

- Each rendered ` ```mermaid ` block becomes `![<type> diagram](<path to svg>)`, with the path relative to the new file and the block's indentation kept.
- Each diagram's source is saved as `.mmd` next to its SVG (`assets/guide-1.mmd`), so it stays editable.
- Blocks Pele rejects are reported and stay as code in the copy. Other code blocks and text are unchanged, and so are the line endings.
- It takes exactly one Markdown input, and the output must be a new file, so the original with the diagram source is never overwritten.

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

- `check` does not use `--out-dir`, `--theme`, `--css`, or `--markdown-out`. `types` takes no files and no flags.
- `--no-links` with `--link-schemes` or `--link-rel`, `--no-images` with `--image-schemes`, and `--no-auto-direction` with `--direction-breakpoint`: Pele ignores those settings while the feature is off.
- `--direction-breakpoint` and `--[no-]auto-direction` need `--max-width`: Pele only rearranges a layout to fit a width.
- `-` (stdin) cannot be combined with files, `--out-dir`, or `--markdown-out`. `render` from stdin also rejects `--format json`, because the SVG goes to stdout.
- `--markdown-out` needs exactly one Markdown input, and it must not be that input.

## Nix

The flake has a package (`packages.<system>.default`) built from `pnpm-lock.yaml`, and a dev shell. It supports `x86_64-linux`, `aarch64-linux`, and `aarch64-darwin`. You need Nix with flakes enabled.

Run it once without installing anything:

```sh
nix run github:ahmedelgabri/pele-cli -- check docs/*.md
nix run github:ahmedelgabri/pele-cli -- render diagram.mmd --theme auto
```

Everything after `--` goes to `pele`.

Install it into your profile:

```sh
nix profile install github:ahmedelgabri/pele-cli
```

Use it from another flake, for example in a NixOS, nix-darwin, or Home Manager configuration, or in a project's dev shell:

```nix
{
  inputs.pele-cli.url = "github:ahmedelgabri/pele-cli";

  # Then, where you list packages:
  #   inputs.pele-cli.packages.${pkgs.stdenv.hostPlatform.system}.default
}
```

Don't set `inputs.pele-cli.inputs.nixpkgs.follows`. The package's dependency hash depends on the exact pnpm version in this repository's `flake.lock`, so a different nixpkgs can fail the build with a hash mismatch.

To pin a version, add a tag to the URL, such as `github:ahmedelgabri/pele-cli/v0.2.0`. `v0.1.0` came out before the flake had a package, so the first tag that works is the next release.

In GitHub Actions, after installing Nix (for example with `cachix/install-nix-action`):

```yaml
- run: nix run github:ahmedelgabri/pele-cli -- check docs/*.md
```

`pele` sees `GITHUB_ACTIONS=true` and reports errors as annotations on the pull request.

### Working on the flake

In a clone, `nix develop` (or direnv with the included `.envrc`) opens the dev shell with Node and pnpm, `nix build` builds the package into `./result`, and `nix run . -- --help` runs it.

The package pins its npm dependencies with a hash of the pnpm store (`pnpmDeps.hash` in `flake.nix`). When `pnpm-lock.yaml` changes, that hash must change too. Run `nix build`, then copy the `got:` hash from the mismatch error into `flake.nix`. CI builds the package, so a stale hash fails the build.

## Development

The tests need Node 24 or later (`node --test --test-global-setup` and TypeScript type stripping), even though the CLI runs on 22.4. The Nix dev shell (`nix develop`, or direnv with `.envrc`) provides Node and pnpm.

```sh
pnpm install
node src/cli.ts --help   # runs the TypeScript source directly
pnpm run check           # tsc, oxlint (type-aware), oxfmt --check, tests, e2e tests
pnpm test                # unit and CLI tests against src/
pnpm run test:e2e        # builds, packs, installs the tarball, and tests the installed `pele`
pnpm run format          # oxfmt
pnpm run build           # compiles to dist/
nix build                # builds the Nix package into ./result
```

CI runs `pnpm run check` and `nix build` on Linux, then installs the packed tarball on Node 22.4.0, 22, and 24.

The e2e theme tests open the SVGs in a headless Chromium-based browser and check the computed colors. They look for Helium, Google Chrome, or Chromium in the usual places; set `PELE_E2E_BROWSER` to a browser binary to choose one. Without a browser they are skipped, and the test output says so.

### Fixtures

`e2e/fixtures/cases/<case>/` holds real input files and an `expected.json` that lists the inputs, the last line of `check`, the SVGs `render` writes, and every error (`file:line:col`, Pele error code, diagram type). Each case runs through both `check` and `render`. `e2e/fixtures/types/` has one `.mmd` per Pele diagram type, taken from https://pele.run/examples, and a test fails if `pele types` lists a type with no fixture. To add a case, add a folder with inputs and an `expected.json`. Fixtures are not formatted by oxfmt, and `.gitattributes` keeps their bytes (CRLF, BOM) as they are.

## Releasing

1. Bump `version` in `package.json`, commit, and push `main`.
2. Tag the commit `v<version>` and push the tag.

The Publish workflow checks that the tag matches `package.json`, runs `pnpm run check`, and publishes to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is stored. It needs a one-time setup on npmjs.com: in the package settings, add a trusted publisher for GitHub Actions with this repository and `publish.yml`. Then create a GitHub release for the tag.
