# Flag rules and e2e tests

## Summary

The CLI now rejects flags that would have no effect, and an e2e suite tests the packed npm tarball the way users install it.

## Flag rules

Before this change, every combination below was accepted silently (exit 0). Now each one exits 2 with a message such as `pele: --no-links and --link-rel cannot be used together`. The rules come from Pele's API docs (https://pele.run/api#renderoptions) and the CLI's own help text, and the layout rule was confirmed against Pele 1.6.0.

| Rule                                                                                      | Source                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check` does not use `--out-dir`, `--theme`, `--css`; `types` takes no files and no flags | CLI help: output options are for `render`, `types` has no inputs                                                                                                          |
| `--no-links` with `--link-schemes` or `--link-rel`                                        | `linkSchemes` and `linkRel` only apply to links                                                                                                                           |
| `--no-images` with `--image-schemes`                                                      | `imageSchemes` only applies to images                                                                                                                                     |
| `--no-auto-direction` with `--direction-breakpoint`                                       | `directionBreakpoint` is the threshold for `autoDirection`                                                                                                                |
| `--direction-breakpoint` or `--[no-]auto-direction` without `--max-width`                 | Pele only changes direction when `maxWidth` is set: a wide `flowchart LR` stays horizontal with any breakpoint and no `maxWidth`, and turns vertical with `maxWidth: 400` |
| `-` with files, `--out-dir` with stdin                                                    | Already rejected before this change                                                                                                                                       |

Not rejected:

- `--help` with other flags: `pele render --help` is normal usage, and help wins.
- A repeated flag: Node's `parseArgs` documents that the last value wins.

Code: `src/flag-rules.ts` holds the flag lists and rules. `cli.ts` gives each command the flags it accepts and whether it takes files.

## Tests

- `test/flags.test.ts`: 15 rejected combinations (exact message, exit 2, nothing written) and 6 accepted ones.
- `test/helpers.ts`: shared `cliRunner`, `workspace`, `viewBoxSize`, used by the CLI tests and the e2e tests.
- `e2e/` (`pnpm run test:e2e`, part of `pnpm run check`):
  - `global-setup.ts` builds, runs `pnpm pack`, and installs the tarball with `pnpm add` into `node_modules/.cache/pele-cli-e2e`. That project copies the repository's `pnpm-workspace.yaml`, so the release-age exemptions are the same. Tests run the installed `node_modules/.bin/pele`, so they also cover the `files` list, the `bin` entry, the shebang, and the `pele` dependency.
  - `info.test.ts`: `--help`, no command, `--version` against the installed versions, `types` (33 types), and EPIPE with `| head`.
  - `inputs.test.ts`: every input type in one run, with outputs written next to inputs, Markdown block numbering with a broken block, an error location at the closing fence, a nested `--out-dir`, `check` writing nothing, and stdin.
  - `render-options.test.ts`: an observable effect for every Pele flag (fonts, padding, responsive, `--now`, the three limits, links, images, direction).
  - `themes.test.ts`: renders with each theme, opens the SVG in headless Chromium with a forced color scheme (`--blink-settings=preferredColorScheme=0|1`), and checks the computed background and node fill. This covers unthemed, light, dark, auto in both schemes, and `--css` over a theme. If no browser is found, these tests are skipped with a reason. A `PELE_E2E_BROWSER` that does not exist is an error.

Totals: 17 unit and CLI tests, 21 e2e tests. The e2e run takes about 3 seconds.

## Findings

- Pele's `--limit` error has no diagram type, because the source length is checked before type detection.
- Pele's edge-limit message says "1 edges found, but the limit is 1" for a diagram with 2 edges and `maxEdges: 1`. The message looks wrong, but it comes from Pele, so the test only checks the error code.
- Headless Chromium follows the macOS appearance by default, so the theme tests always force a color scheme.
