import assert from 'node:assert/strict'
import {readdirSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'

import {cliRunner, viewBoxSize, WIDE_FLOWCHART, workspace} from './helpers.ts'

const pele = cliRunner(process.execPath, [
	fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
])

test('check reports Pele errors at their line and column in the Markdown file', () => {
	const cwd = workspace({
		'doc.md': [
			'# Doc',
			'',
			'```mermaid',
			'sequenceDiagram',
			'  A->>B: hi',
			'  ??? nope',
			'```',
			'',
		].join('\n'),
		'ok.mmd': 'flowchart LR\n  A --> B\n',
	})

	const {code, stdout, stderr} = pele(['check', 'ok.mmd', 'doc.md'], {cwd})

	assert.equal(code, 1)
	assert.equal(stdout, '')
	assert.match(
		stderr,
		/^doc\.md:6:11: syntax error in sequence diagram\n {2}Parse error on line 3:\n/u,
	)
	assert.match(stderr, /\n1 invalid diagram of 2\n$/u)
})

test('check exits 0 when every diagram is valid', () => {
	const cwd = workspace({'a.mmd': 'pie\n  "a": 1\n', 'b.mmd': 'info\n'})

	const {code, stderr} = pele(['check', 'a.mmd', 'b.mmd'], {cwd})

	assert.equal(code, 0)
	assert.equal(stderr, '2 diagrams valid\n')
})

test('check reads stdin and reports unsupported diagrams', () => {
	const cwd = workspace({})

	const {code, stderr} = pele(['check'], {cwd, input: 'Hello'})

	assert.equal(code, 1)
	assert.match(
		stderr,
		/^<stdin>: unsupported-diagram error\n {2}No diagram type detected/u,
	)
})

test('render writes one SVG per diagram with the theme and custom CSS embedded', () => {
	const cwd = workspace({
		'README.md': '```mermaid\npie\n  "a": 1\n```\n\n```mermaid\ninfo\n```\n',
		'a.mmd': 'flowchart LR\n  A --> B\n',
		'brand.css': '.pele{--pele-accent:#ff0000}',
	})

	const {code, stdout, stderr} = pele(
		[
			'render',
			'a.mmd',
			'README.md',
			'-o',
			'out',
			'--theme',
			'dark',
			'--css',
			'brand.css',
		],
		{cwd},
	)

	assert.equal(stderr, '')
	assert.equal(code, 0)
	assert.equal(
		stdout,
		['out/a.svg', 'out/README-1.svg', 'out/README-2.svg', ''].join('\n'),
	)
	assert.deepEqual(readdirSync(path.join(cwd, 'out')).toSorted(), [
		'README-1.svg',
		'README-2.svg',
		'a.svg',
	])

	const svg = readFileSync(path.join(cwd, 'out/README-1.svg'), 'utf8')
	assert.match(
		svg,
		/^<svg [^>]*class="pele pele-pie"[^>]*><style><!\[CDATA\[\.pele\{[^}]*--pele-bg:#100f0f;/u,
	)
	assert.ok(
		svg.indexOf('--pele-accent:#4385be') < svg.indexOf('--pele-accent:#ff0000'),
		'custom CSS overrides theme',
	)
})

test('render writes SVG to stdout for stdin input', () => {
	const cwd = workspace({})

	const {code, stdout, stderr} = pele(['render', '-'], {
		cwd,
		input: 'pie\n  "a": 1\n',
	})

	assert.equal(stderr, '')
	assert.equal(code, 0)
	assert.match(stdout, /^<svg [^>]*class="pele pele-pie"/u)
	assert.ok(stdout.endsWith('</svg>\n'))
})

test('render passes Pele layout and link options through', () => {
	const cwd = workspace({})

	const wide = pele(['render'], {cwd, input: WIDE_FLOWCHART}).stdout
	const narrow = pele(['render', '--max-width', '320'], {
		cwd,
		input: WIDE_FLOWCHART,
	}).stdout
	assert.ok(
		viewBoxSize(wide).width > 320,
		`expected a wide layout, got ${viewBoxSize(wide).width}`,
	)
	assert.ok(
		viewBoxSize(narrow).width <= 320,
		`expected at most 320px, got ${viewBoxSize(narrow).width}`,
	)

	const linked = 'flowchart LR\n  A --> B\n  click A "https://pele.run"\n'
	assert.match(
		pele(['render'], {cwd, input: linked}).stdout,
		/href="https:\/\/pele\.run\/"/u,
	)
	assert.doesNotMatch(
		pele(['render', '--no-links'], {cwd, input: linked}).stdout,
		/href=/u,
	)
})

test('render refuses inputs that would overwrite each other', () => {
	const cwd = workspace({'a.mermaid': 'info\n', 'a.mmd': 'info\n'})

	const {code, stderr} = pele(['render', 'a.mmd', 'a.mermaid', '-o', 'out'], {
		cwd,
	})

	assert.equal(code, 2)
	assert.match(
		stderr,
		/^pele: a\.mmd and a\.mermaid would both write out\/a\.svg\n/u,
	)
	assert.deepEqual(readdirSync(cwd).toSorted(), ['a.mermaid', 'a.mmd'])
})

test('invalid arguments exit 2 without rendering', () => {
	const cwd = workspace({'a.mmd': 'info\n', 'notes.txt': 'info\n'})

	for (const args of [
		['render', 'a.mmd', '--theme', 'neon'],
		['render', 'a.mmd', '--max-width', 'wide'],
		['check', 'notes.txt'],
		['check', 'missing.mmd'],
		['frobnicate'],
	]) {
		const {code, stdout, stderr} = pele(args, {cwd})
		assert.equal(code, 2, `pele ${args.join(' ')}`)
		assert.equal(stdout, '')
		assert.match(stderr, /^pele: .+\nRun "pele --help" for usage\.\n$/u)
	}
	assert.deepEqual(readdirSync(cwd).toSorted(), ['a.mmd', 'notes.txt'])
})
