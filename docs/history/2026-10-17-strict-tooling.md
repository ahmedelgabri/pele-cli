# Strict TypeScript, oxlint, and oxfmt

## Summary

Added very strict type checking, type-aware linting with oxlint, and formatting with oxfmt. `pnpm run check` runs all of them plus the tests; `prepublishOnly` runs `check` before `build`.

| Tool            | Version  | Config                                                                                            |
| --------------- | -------- | ------------------------------------------------------------------------------------------------- |
| TypeScript      | 7.0.2    | `tsconfig.json` (checks `src` and `test`, no emit), `tsconfig.build.json` (emits `src` to `dist`) |
| oxlint          | 1.87.0   | `.oxlintrc.json`                                                                                  |
| oxlint-tsgolint | 7.0.2004 | Type-aware rules, through `options.typeAware`                                                     |
| oxfmt           | 0.72.0   | `.oxfmtrc.json`                                                                                   |

Versions are the newest ones at least 7 days old, to match the user's npm `min-release-age=7`. oxlint 1.88.0 and oxfmt 0.73.0 were newer.

## TypeScript

On top of `strict`: `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noUnusedLocals`, `noUnusedParameters`, `allowUnreachableCode: false`, `allowUnusedLabels: false`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax`, `erasableSyntaxOnly`.

Before this change, `tsconfig.json` only included `src`, so the tests were never type-checked. It now includes `test`, and the build uses a separate `tsconfig.build.json`.

## oxlint

Every category except `nursery` and `style` is an error: correctness, suspicious, pedantic, perf, and restriction. The `style` category (279 rules) is off: formatting and style are oxfmt's job. Plugins: eslint, typescript, unicorn, oxc, import, node, promise, jsdoc. Warnings fail the run, and unused disable comments are errors. There are no disable comments in the code.

Rules turned off, each with its reason in `.oxlintrc.json`:

- `oxc/no-async-await`, `oxc/no-optional-chaining`, `oxc/no-rest-spread-properties`: for ES5 targets.
- `node/no-top-level-await`: this is a Node CLI with an ESM entry point.
- `eslint/no-undefined`: strict optional types need explicit `undefined` checks.
- `jsdoc/require-param-type`, `jsdoc/require-returns-type`: TypeScript has the types.

Rules configured rather than turned off:

- `typescript/return-await`: `always`. `promise-function-async` and `require-await` together need `return await` in async wrappers.
- `typescript/prefer-readonly-parameter-types`: `ignoreInferredTypes`, for callback parameters typed by `Array#map` and `Object.entries`.
- `typescript/no-floating-promises`: `node:test`'s `test()` is a known safe call.
- Tests: `node/no-sync` and `import/no-relative-parent-imports` are off.

## oxfmt

Matches the style the user applied by hand: tabs, no semicolons, single quotes, no bracket spacing, 80 columns, trailing commas everywhere, sorted imports. oxfmt also formats JSON and Markdown, and sorts `package.json`.

## Code changes made to satisfy the rules

The first version also enabled the `style` category; it was turned off on 2026-10-18. Changes made for style rules (marked _style_) are still in the code, since they are valid code; they are no longer enforced.

Behavior is unchanged, and all 15 tests pass.

- `cli.ts` (377 lines) split into `cli.ts` (entry), `args.ts` (flags and render options), `commands.ts`, `usage.ts`, `exit-code.ts`, for `max-lines` (300) and `max-statements` (10, _style_).
- Exports grouped at the end of each module (`import/group-exports`, `import/exports-last`, _style_).
- Markdown fence parsing rewritten with named capture groups and no `continue`, `++`, or non-null assertions.
- `render` now renders every diagram first and then writes the files in parallel (`no-await-in-loop`). It prints the written paths in input order after all writes finish.
- Versions are read from `package.json` with `import.meta.resolve` and a runtime type guard instead of `require` plus a cast.
- `UsageError` sets `name`. Caught values go through `describeError()` instead of `as Error`.
- The palettes and option tables are sorted by key (`sort-keys`, _style_). One test expected `--pele-bg` to be the first variable and now accepts any order.
- `--fix` changed one continuation comment to start with a capital letter ("Or dark text…"). That is reverted.
