import {readFileSync, realpathSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

import {cliRunner} from '../test/helpers.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// global-setup.ts installs the packed tarball here; each test file runs in its
// own process, so a fixed path is how they find it.
const INSTALL_DIR = path.join(ROOT, 'node_modules', '.cache', 'pele-cli-e2e')

const PELE_BIN = path.join(INSTALL_DIR, 'node_modules', '.bin', 'pele')

const pele = cliRunner(PELE_BIN)

/**
 * Reads the version of a package as installed next to pele-cli.
 * @param name - Package name, or `pele-cli` itself.
 * @returns The installed version.
 */
function installedVersion(name: string): string {
	// pnpm links pele-cli into .pnpm/, where its dependencies are siblings.
	const cliDir = realpathSync(
		path.join(INSTALL_DIR, 'node_modules', 'pele-cli'),
	)
	const manifestPath = path.join(path.dirname(cliDir), name, 'package.json')
	const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'))
	if (
		typeof manifest === 'object' &&
		manifest !== null &&
		'version' in manifest &&
		typeof manifest.version === 'string'
	) {
		return manifest.version
	}
	throw new Error(`${name} has no version`)
}

export {INSTALL_DIR, installedVersion, pele, PELE_BIN, ROOT}
