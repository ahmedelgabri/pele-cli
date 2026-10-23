import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'

import {OUTPUT_FLAGS, RENDER_FLAGS, REPORT_FLAGS} from '../src/args.ts'
import {USAGE} from '../src/usage.ts'

const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

// Help text and the README table are written by hand; this catches a flag
// that one of them forgot.
test('pele --help and the README list every option', () => {
	const flags = [
		...RENDER_FLAGS,
		...OUTPUT_FLAGS,
		...REPORT_FLAGS,
		'help',
		'version',
	]
	for (const flag of flags) {
		const mention = new RegExp(`--(?:no-)?${flag}(?![\\w-])`, 'u')
		assert.match(USAGE, mention, `pele --help is missing --${flag}`)
		assert.match(README, mention, `README.md is missing --${flag}`)
	}
})
