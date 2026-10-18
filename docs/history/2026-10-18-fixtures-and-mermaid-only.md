# Fixture-based e2e tests, Mermaid inputs only

## `.pele` and ` ```pele ` removed

The CLI no longer accepts `.pele` files or ` ```pele ` code blocks in Markdown. Inputs are `.mmd` and `.mermaid` files, and ` ```mermaid ` blocks in `.md` and `.markdown` files. A `.pele` file is now rejected as an unsupported file type (exit 2), and a ` ```pele ` block is treated like any other code block. The help text, README, unit tests, and CI smoke test were updated. Earlier history notes still describe `.pele` as it was then.

## Fixtures

Before this change, the e2e tests built a handful of inputs as inline strings. They now use files under `e2e/fixtures/`.

`cases/<case>/expected.json` lists `inputs`, `summary` (the last line of `check`), `svgs` (what `render` writes, in order), `errors` (`at`, `code`, `type`), and optionally `svgContains`. Each case runs through both `check` and `render`. The expected locations were worked out by hand from the fixture line numbers, not copied from CLI output.

| Case               | Covers                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markdown-fences`  | Backtick and tilde fences, a longer fence with ` ``` ` inside, an info string with attributes, `Mermaid` in capitals, and `js`, `pele`, and plain fences ignored. Also the `.markdown` extension                                                     |
| `markdown-nesting` | Diagrams quoted inside ` `md ```` and `~~~` blocks are skipped, a fence inside a list item counts, a 4-space indented "fence" is an indented code block, and an unclosed fence runs to the end                                                       |
| `markdown-errors`  | A syntax error with a column, an empty block and a non-diagram block (reported at the fence line), an error at the end of a block (reported at the closing fence), and valid blocks between them keep their numbers (`errors-2.svg`, `errors-6.svg`) |
| `markdown-crlf`    | CRLF line endings keep line and column mapping                                                                                                                                                                                                       |
| `markdown-empty`   | A document with no diagrams: `0 diagrams valid`, nothing written                                                                                                                                                                                     |
| `diagram-files`    | `.mmd`, `.mermaid`, an uppercase `.MMD`, a UTF-8 BOM, and frontmatter, `%%{init}%%`, comments, `accTitle`, `accDescr` (checked in the SVG)                                                                                                           |
| `diagram-errors`   | Empty file, semantic error (Gantt), syntax error with a column, unsupported text, and a valid file still written                                                                                                                                     |
| `diagram-crlf`     | CRLF in a plain diagram file                                                                                                                                                                                                                         |

`types/` has 33 `.mmd` files, one per Pele diagram type. 32 come from the first example of each section of https://pele.run/examples, and `info.mmd` was written by hand. Each one is rendered through the installed CLI and must produce an SVG with class `pele-<type>`. A test fails if `pele types` lists a type with no fixture.

`e2e/inputs.test.ts` was replaced by `e2e/fixtures.test.ts`. The nested `--out-dir` and stdin tests moved there.

Totals: 69 e2e tests, about 5.5 seconds. Changing one expected location (`6:11` to `6:12`) makes the `check` and `render` tests for that case fail.

## Notes

- `.oxfmtrc.json` ignores `e2e/fixtures/`, and `.gitattributes` marks the fixtures `-text`, so formatting and git line-ending conversion leave the CRLF and BOM bytes unchanged.
- Fixtures avoid errors at the end of a plain file, because Pele reports those one line past the end of the file. In Markdown the same line is the closing fence, and `markdown-errors` does test that.
