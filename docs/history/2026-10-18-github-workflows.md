# GitHub workflows

## Summary

CI for pushes to `main` and pull requests, npm publishing on `v*` tags, and Dependabot. Every action is pinned to a full commit SHA, with the tag in a comment. Each pinned release was at least 7 days old when chosen, so `cachix/install-nix-action` is v31.11.1 because v31.11.2 was 4 days old.

## CI (`.github/workflows/ci.yml`)

- `check` (ubuntu-24.04): installs Nix and runs every step in `nix develop`, so Node 26 and pnpm 12.9 match the dev shell and `flake.lock`. Runs `pnpm install --frozen-lockfile` and `pnpm run check`, which covers tsc, oxlint, oxfmt, unit and CLI tests, and e2e tests. Then it packs the package and uploads the tarball as the `package` artifact.
  - `PELE_E2E_BROWSER=/usr/bin/google-chrome` is set, so the browser theme tests fail instead of skipping if Chrome is missing. The runner image includes Google Chrome.
- `node-compat` (matrix Node `22.4.0`, `22`, `24`): installs the packed tarball with `npm install --global` and runs a smoke test: `--version`, `check`, `render` with `--theme auto --max-width 400 --no-auto-direction` (`allowNegative` in `parseArgs` needs Node 22.4), `types | head`, exit 1 for an invalid diagram, and exit 2 for a flag the command does not use. The full test suite can't run there because it needs Node 24+ (`--test-global-setup`, type stripping), and this job is what backs `engines: >=22.4`.
- Permissions are `contents: read`, and checkout does not keep credentials. Runs on the same pull request cancel older ones.

## Publish (`.github/workflows/publish.yml`)

- Runs on `v*` tags. It fails if the tag is not `v` plus the `package.json` version.
- `npm publish` runs `prepublishOnly` (`pnpm run check` and `pnpm run build`) first.
- Uses npm trusted publishing: `id-token: write` lets npm exchange the GitHub OIDC token for a short-lived publish token and add provenance. There is no `NPM_TOKEN` secret.

## Dependabot (`.github/dependabot.yml`)

Weekly updates for GitHub Actions and npm dependencies, with a 7-day cooldown to match the release-age rule. Dependabot does not update `flake.lock`.

## Verification

- `actionlint` passes on both workflows.
- The smoke script passes `shellcheck` and was run locally against the tarball installed by the e2e tests on Node 22.23.3. Node 22.4.0 itself is only checked in CI.
- The workflows have not run on GitHub yet: the project is not a git repository.

## Setup needed on GitHub and npm

- The CI trigger assumes the default branch is `main`.
- Trusted publishing must be configured on npmjs.com (package settings → Trusted publisher: GitHub Actions, this repository, workflow `publish.yml`). npm only offers this for a package that already exists, so the first `pele-cli` release has to be published by hand.

## Finding

For a diagram that ends early, Pele reports the line after the last line. For a plain file this points past the end of the file: `broken.pele:4:1` for a file with two lines and a trailing newline. In Markdown, the same line is the closing fence, which is a useful place to point. This behavior existed before the workflows and is not changed here.
