import {execFileSync} from 'node:child_process'
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import path from 'node:path'

import {INSTALL_DIR, ROOT} from './install.ts'

function pnpm(args: readonly string[], cwd: string): void {
	// Piped so a passing run prints nothing; a failure throws with pnpm's stderr.
	execFileSync('pnpm', args, {cwd, stdio: 'pipe'})
}

/** Builds and packs pele-cli, then installs the tarball the way users get it. */
function globalSetup(): void {
	rmSync(INSTALL_DIR, {force: true, recursive: true})
	mkdirSync(INSTALL_DIR, {recursive: true})

	pnpm(['run', 'build'], ROOT)
	pnpm(['pack', '--pack-destination', INSTALL_DIR], ROOT)
	const tarball = readdirSync(INSTALL_DIR).find((file) => file.endsWith('.tgz'))
	if (tarball === undefined) {
		throw new Error(`pnpm pack wrote no tarball to ${INSTALL_DIR}`)
	}

	writeFileSync(
		path.join(INSTALL_DIR, 'package.json'),
		JSON.stringify({name: 'pele-cli-e2e', private: true}),
	)
	// Same release-age exemptions as the repository, nothing more.
	copyFileSync(
		path.join(ROOT, 'pnpm-workspace.yaml'),
		path.join(INSTALL_DIR, 'pnpm-workspace.yaml'),
	)
	pnpm(['add', `./${tarball}`], INSTALL_DIR)
}

export {globalSetup}
