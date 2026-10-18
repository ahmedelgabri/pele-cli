import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {test} from 'node:test'

import {workspace} from '../test/helpers.ts'
import {installedVersion, pele, PELE_BIN} from './install.ts'

test('--help prints usage and exits 0', () => {
	const {code, stdout, stderr} = pele(['--help'], {cwd: workspace({})})

	assert.equal(code, 0)
	assert.equal(stderr, '')
	assert.match(stdout, /^Usage: pele <command> \[options\] \[files\.\.\.\]\n/u)
	assert.match(
		stdout,
		/\n {2}types {16}List the diagram types Pele supports\n/u,
	)
})

test('no command prints usage and exits 2', () => {
	const {code, stdout} = pele([], {cwd: workspace({})})

	assert.equal(code, 2)
	assert.match(stdout, /^Usage: pele /u)
})

test('--version shows the installed pele-cli and Pele versions', () => {
	const {code, stdout} = pele(['--version'], {cwd: workspace({})})

	assert.equal(code, 0)
	assert.equal(
		stdout,
		`pele-cli ${installedVersion('pele-cli')} (pele ${installedVersion('pele')})\n`,
	)
})

test('types lists every diagram type with its keywords', () => {
	const {code, stdout, stderr} = pele(['types'], {cwd: workspace({})})
	const rows = stdout.trimEnd().split('\n')

	assert.equal(code, 0)
	assert.equal(stderr, '')
	// The types in https://pele.run/compatibility.
	assert.equal(rows.length, 33)
	assert.match(stdout, /^flowchart +flowchart, graph$/mu)
	assert.match(
		stdout,
		/^c4 +C4Context, C4Container, C4Component, C4Dynamic, C4Deployment$/mu,
	)
	assert.match(stdout, /^wardley +wardley-beta$/mu)
})

test('stops quietly when the reader closes the pipe early', () => {
	const result = spawnSync(
		'bash',
		['-c', 'set -o pipefail; "$0" types | head -n 1', PELE_BIN],
		{encoding: 'utf8'},
	)

	assert.equal(result.status, 0)
	assert.equal(result.stderr, '')
	assert.match(result.stdout, /^flowchart +flowchart, graph\n$/u)
})
