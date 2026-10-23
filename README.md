# pele-cli

Validate Mermaid diagrams and render them to themeable SVG with [Pele](https://pele.run), without a browser.

## Install

```sh
npm install -g @ahmedelgabri/pele-cli              # Node 22.4 or later
nix profile install github:ahmedelgabri/pele-cli   # or Nix
nix run github:ahmedelgabri/pele-cli -- --help     # or run it without installing
```

The command is `pele`. In a flake, add the input `github:ahmedelgabri/pele-cli` and use `packages.${system}.default`. Don't make its `nixpkgs` follow yours: the dependency hash depends on this repository's pnpm version.

## Contents

- [Usage](#usage)
- [Errors and CI](#errors-and-ci)
- [Themes](#themes)
- [Markdown with images](#markdown-with-images)
- [Options](#options)
- [Development](#development)
- [Releasing](#releasing)

## Usage

```sh
pele check docs/*.md              # validate every diagram, exit 1 on errors
pele render diagram.mmd           # writes diagram.svg
pele render README.md -o assets   # writes assets/README-1.svg, README-2.svg, ...
cat flow.mmd | pele render > flow.svg
pele types                        # diagram types Pele supports
```

Inputs are `.mmd` and `.mermaid` files, ` ```mermaid ` blocks in `.md` and `.markdown` files, or stdin. Pele supports every diagram type built into Mermaid 12.1.0, but not plugins such as ZenUML.

## Errors and CI

Errors point at the line and column in the input file, including inside Markdown:

```
docs/guide.md:42:11: syntax error in sequence diagram
  Parse error on line 3:
  ...
1 invalid diagram of 4
```

Exit codes: `0` valid, `1` invalid diagrams, `2` usage or file errors. `render` still writes the valid diagrams.

`--format github` prints [workflow annotations](https://docs.github.com/actions/reference/workflow-commands-for-github-actions), so errors show on the pull request lines. It's the default when `GITHUB_ACTIONS=true`, so in a workflow this is enough:

```yaml
- run: npx -y @ahmedelgabri/pele-cli check README.md docs/*.md
```

`--format json` prints the diagram count, every error, and the files written, on stdout.

## Themes

Pele's SVG takes its colors from the page around it. To make a file that keeps its colors anywhere, embed a theme:

- `--theme light|dark|auto`: pele.run's palettes, with a background. `auto` follows the viewer's color scheme.
- `--css <file>`: your own [`--pele-*` variables](https://pele.run/theming), applied after the theme.

## Markdown with images

For places that can't render Mermaid, such as a static site or a package README:

```sh
pele render docs/guide.md -o assets --markdown-out site/guide.md
```

`site/guide.md` is a copy of the guide with each diagram replaced by `![<type> diagram](../assets/guide-1.svg)`. Each diagram's source is saved next to its SVG as `.mmd`. Diagrams Pele rejects stay as code. The input is never overwritten.

## Options

| Option                                              | Commands      | Description                                                            |
| --------------------------------------------------- | ------------- | ---------------------------------------------------------------------- |
| `-o, --out-dir <dir>`                               | render        | Write SVGs here instead of next to each input                          |
| `--theme light\|dark\|auto`                         | render        | Embed a color theme ([Themes](#themes))                                |
| `--css <file>`                                      | render        | Embed your own CSS after the theme                                     |
| `--markdown-out <file>`                             | render        | Write a Markdown copy with images ([details](#markdown-with-images))   |
| `--format text\|json\|github`                       | check, render | How errors are reported ([Errors and CI](#errors-and-ci))              |
| `--max-width <px>`                                  | check, render | Available width; narrow widths rearrange the layout                    |
| `--no-auto-direction`                               | check, render | Keep the source direction (needs `--max-width`)                        |
| `--direction-breakpoint <px>`                       | check, render | Width below which layouts may turn vertical (640; needs `--max-width`) |
| `--no-responsive`                                   | check, render | Fixed pixel size instead of shrinking to fit                           |
| `--font-family <font>`, `--font-family-mono <font>` | check, render | Label fonts (`sans-serif`, `monospace`)                                |
| `--font-size <px>`                                  | check, render | Base font size (16)                                                    |
| `--padding <px>`                                    | check, render | Space around the diagram                                               |
| `--now <date>`                                      | check, render | Reference time, for reproducible Gantt charts                          |
| `--limit <chars>`, `--output-limit <chars>`         | check, render | Max source and SVG length (50000, 4000000)                             |
| `--max-edges <n>`                                   | check, render | Max flowchart and agentflow edges (5000)                               |
| `--no-links`, `--no-images`                         | check, render | Drop links or images                                                   |
| `--link-schemes <list>`, `--image-schemes <list>`   | check, render | Allowed URL schemes, comma-separated                                   |
| `--link-rel <value>`                                | check, render | `rel` attribute of links (`noopener`)                                  |
| `-h, --help`, `-v, --version`                       |               | Help, or the pele-cli and Pele versions                                |

Defaults are in parentheses. The rows from `--max-width` down map to Pele's [`RenderOptions`](https://pele.run/api#renderoptions). A flag that would have no effect, such as `--theme` with `check` or `--link-rel` with `--no-links`, is an error.

Without a browser, Pele estimates label widths, so labels in an unusually wide or narrow font may not fit their shapes exactly.

## Development

The Nix dev shell (`nix develop`, or direnv) provides Node and pnpm. The tests need Node 24 or later.

```sh
pnpm install
pnpm run check      # tsc, oxlint, oxfmt, unit and e2e tests
pnpm run test:e2e   # packs and installs the tarball, then tests the installed `pele`
nix build           # the Nix package, in ./result
```

- The e2e theme tests check colors in a headless Chromium-based browser. Set `PELE_E2E_BROWSER` to choose one; without a browser they are skipped.
- Each `e2e/fixtures/cases/<case>/` has input files and an `expected.json` with the expected errors and outputs. `e2e/fixtures/types/` has one diagram per Pele type.
- When `pnpm-lock.yaml` changes, update `pnpmDeps.hash` in `flake.nix`: run `nix build` and copy the `got:` hash. CI fails on a stale hash.

## Releasing

Bump `version` in `package.json`, then push a `v<version>` tag. The Publish workflow runs the checks, publishes to npm with [trusted publishing](https://docs.npmjs.com/trusted-publishers), and creates the GitHub release with the commits since the previous tag. Trusted publishing needs a one-time setup on npmjs.com: owner `ahmedelgabri`, repository `pele-cli`, workflow `publish.yml`, no environment.
