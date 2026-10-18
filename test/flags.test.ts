import assert from 'node:assert/strict'
import {readdirSync} from 'node:fs'
import {test} from 'node:test'

import {peleFromSource as pele, WIDE_FLOWCHART, workspace} from './helpers.ts'

const REJECTED: ReadonlyArray<readonly [readonly string[], string]> = [
	// Flags a command does not use.
	[['check', '--theme', 'dark'], '"check" does not use --theme'],
	[['check', '--css', 'brand.css'], '"check" does not use --css'],
	[['check', '-o', 'out'], '"check" does not use --out-dir'],
	[['types', '--max-width', '400'], '"types" does not use --max-width'],
	[['types', '--no-links'], '"types" does not use --no-links'],
	[['types', 'a.mmd'], '"types" does not take files'],
	// Settings for a feature that is switched off.
	[
		['render', '--no-links', '--link-schemes', 'https'],
		'--no-links and --link-schemes cannot be used together',
	],
	[
		['render', '--no-links', '--link-rel', 'nofollow'],
		'--no-links and --link-rel cannot be used together',
	],
	[
		['check', '--no-images', '--image-schemes', 'https'],
		'--no-images and --image-schemes cannot be used together',
	],
	[
		[
			'render',
			'--max-width',
			'400',
			'--no-auto-direction',
			'--direction-breakpoint',
			'300',
		],
		'--no-auto-direction and --direction-breakpoint cannot be used together',
	],
	// Layout settings that only apply to a width.
	[
		['render', '--direction-breakpoint', '300'],
		'--direction-breakpoint requires --max-width',
	],
	[
		['check', '--no-auto-direction'],
		'--no-auto-direction requires --max-width',
	],
	[['check', '--auto-direction'], '--auto-direction requires --max-width'],
	[
		['check', '--format', 'xml'],
		'--format must be one of text, json, github, got "xml"',
	],
	[['types', '--format', 'json'], '"types" does not use --format'],
	[
		['render', '--format', 'json'],
		'--format json cannot be used with stdin: the SVG goes to stdout',
	],
	// Output targets.
	[['render', '-', 'a.mmd'], 'stdin (-) cannot be combined with files'],
	[['render', '-', '-o', 'out'], '--out-dir cannot be used with stdin'],
]

test('rejects flags that conflict or that the command ignores', () => {
	const cwd = workspace({'a.mmd': 'info\n', 'brand.css': '.pele{}'})

	for (const [args, message] of REJECTED) {
		const {code, stdout, stderr} = pele(args, {cwd, input: 'info\n'})
		const label = `pele ${args.join(' ')}`
		assert.equal(code, 2, label)
		assert.equal(stdout, '', label)
		assert.equal(stderr, `pele: ${message}\nRun "pele --help" for usage.\n`)
	}
	assert.deepEqual(readdirSync(cwd).toSorted(), ['a.mmd', 'brand.css'])
})

const ACCEPTED: ReadonlyArray<readonly string[]> = [
	['check', '--max-width', '400', '--direction-breakpoint', '300'],
	['check', '--max-width', '400', '--no-auto-direction'],
	['check', '--no-links', '--no-images'],
	['check', '--link-schemes', 'https', '--link-rel', 'nofollow'],
	['render', '--theme', 'auto', '--css', 'brand.css', '--max-width', '400'],
	// Help wins over everything else, including flags the command ignores.
	['check', '--theme', 'dark', '--help'],
]

test('accepts flags that work together', () => {
	const cwd = workspace({'brand.css': '.pele{}'})

	for (const args of ACCEPTED) {
		const {code, stderr} = pele(args, {cwd, input: WIDE_FLOWCHART})
		assert.equal(code, 0, `pele ${args.join(' ')}: ${stderr}`)
	}
})
