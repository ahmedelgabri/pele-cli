import assert from 'node:assert/strict'
import {test} from 'node:test'

import {peleFromSource as pele, workspace} from './helpers.ts'

const BROKEN_MARKDOWN = [
	'# Doc',
	'',
	'```mermaid',
	'sequenceDiagram',
	'  A->>B: hi',
	'  ??? nope',
	'```',
	'',
].join('\n')

test('--format github prints one annotation per error on stderr', () => {
	const cwd = workspace({'doc.md': BROKEN_MARKDOWN})

	const {code, stdout, stderr} = pele(
		['check', '--format', 'github', 'doc.md'],
		{
			cwd,
		},
	)

	assert.equal(code, 1)
	assert.equal(stdout, '')
	// Newlines in the message are escaped so the annotation stays on one line.
	assert.match(
		stderr,
		/^::error file=doc\.md,line=6,col=11,title=Pele syntax error in sequence diagram::Parse error on line 3:%0A {2}\?\?\? nope%0A-{10}\^%0AExpecting [^\n]+\n1 invalid diagram of 1\n$/u,
	)
})

test('--format github escapes properties and leaves out unknown positions', () => {
	const cwd = workspace({'a,b:c.mmd': 'Hello\n'})

	const fromFile = pele(['check', '--format', 'github', 'a,b:c.mmd'], {cwd})
	const fromStdin = pele(['check', '--format', 'github'], {cwd, input: 'Hello'})

	assert.match(
		fromFile.stderr,
		/^::error file=a%2Cb%3Ac\.mmd,title=Pele unsupported-diagram error::No diagram type detected/u,
	)
	assert.match(
		fromStdin.stderr,
		/^::error title=Pele unsupported-diagram error::No diagram type detected/u,
	)
})

test('GitHub Actions gets annotations by default, unless --format says otherwise', () => {
	const cwd = workspace({'doc.md': BROKEN_MARKDOWN})
	const env = {GITHUB_ACTIONS: 'true'}

	const automatic = pele(['check', 'doc.md'], {cwd, env})
	const explicit = pele(['check', '--format', 'text', 'doc.md'], {cwd, env})

	assert.match(automatic.stderr, /^::error file=doc\.md,line=6,col=11,/u)
	assert.match(
		explicit.stderr,
		/^doc\.md:6:11: syntax error in sequence diagram\n/u,
	)
})

test('--format json prints the whole result on stdout', () => {
	const cwd = workspace({'doc.md': BROKEN_MARKDOWN, 'ok.mmd': 'info\n'})

	const checked = pele(['check', '--format', 'json', 'ok.mmd', 'doc.md'], {cwd})
	const rendered = pele(['render', '--format', 'json', 'ok.mmd', 'doc.md'], {
		cwd,
	})

	assert.equal(checked.code, 1)
	assert.equal(checked.stderr, '')
	assert.partialDeepStrictEqual(JSON.parse(checked.stdout), {
		diagrams: 2,
		errors: [
			{code: 'syntax', column: 11, file: 'doc.md', line: 6, type: 'sequence'},
		],
		invalid: 1,
	})
	assert.match(checked.stdout, /"message": "Parse error on line 3:\\n/u)
	assert.doesNotMatch(checked.stdout, /"written"/u)

	assert.equal(rendered.code, 1)
	assert.equal(rendered.stderr, '')
	assert.partialDeepStrictEqual(JSON.parse(rendered.stdout), {
		invalid: 1,
		written: ['ok.svg'],
	})
})
