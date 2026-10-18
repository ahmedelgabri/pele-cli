import assert from 'node:assert/strict'
import {cpSync, existsSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'

import {workspace} from '../test/helpers.ts'
import {pele} from './install.ts'

const FIXTURE = fileURLToPath(
	new URL('fixtures/markdown-out/', import.meta.url),
)

test('--markdown-out replaces rendered diagrams with images and saves their source', () => {
	const cwd = workspace({})
	cpSync(path.join(FIXTURE, 'guide.md'), path.join(cwd, 'guide.md'))
	const read = (file: string): string =>
		readFileSync(path.join(cwd, file), 'utf8')

	const {code, stdout, stderr} = pele(
		[
			'render',
			'guide.md',
			'-o',
			'assets/svg',
			'--markdown-out',
			'site/guide.md',
		],
		{cwd},
	)

	// The broken third block is reported and stays as code in the copy.
	assert.equal(code, 1)
	assert.match(stderr, /^guide\.md:20:1: syntax error in flowchart diagram\n/u)
	assert.equal(
		stdout,
		[
			'assets/svg/guide-1.svg',
			'assets/svg/guide-2.svg',
			'assets/svg/guide-1.mmd',
			'assets/svg/guide-2.mmd',
			'site/guide.md',
			'',
		].join('\n'),
	)
	assert.equal(
		read('site/guide.md'),
		readFileSync(path.join(FIXTURE, 'expected.md'), 'utf8'),
	)
	assert.equal(read('assets/svg/guide-1.mmd'), 'flowchart LR\n  A --> B\n')
	assert.equal(read('assets/svg/guide-2.mmd'), 'pie\n  "a": 1\n')
	assert.match(
		read('assets/svg/guide-2.svg'),
		/^<svg [^>]*class="pele pele-pie"/u,
	)
	assert.equal(existsSync(path.join(cwd, 'assets/svg/guide-3.svg')), false)
	assert.equal(
		read('guide.md'),
		readFileSync(path.join(FIXTURE, 'guide.md'), 'utf8'),
	)
})
