import assert from 'node:assert/strict'
import {cpSync, readdirSync, readFileSync, rmSync} from 'node:fs'
import path from 'node:path'
import {test} from 'node:test'
import {fileURLToPath} from 'node:url'

import {workspace} from '../test/helpers.ts'
import {pele} from './install.ts'

interface ReportedError {
	readonly at: string
	readonly code: string
	readonly type: string | null
}

/** The contents of a case's expected.json. */
interface Expected {
	/** Files passed to the CLI, in order. */
	readonly inputs: readonly string[]
	/** The last line `check` prints. */
	readonly summary: string
	/** SVGs `render` writes, in the order it lists them. */
	readonly svgs: readonly string[]
	readonly errors: readonly ReportedError[]
	/** Text that must appear in a rendered SVG. */
	readonly svgContains?: Readonly<Record<string, readonly string[]>>
}

const FIXTURES = fileURLToPath(new URL('fixtures/', import.meta.url))
const CASES = path.join(FIXTURES, 'cases')
const TYPES = path.join(FIXTURES, 'types')

const ERROR_HEADER =
	/^(?<at>\S+): (?<code>[a-z-]+) error(?: in (?<type>\S+) diagram)?$/gmu

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isReportedError(value: unknown): value is ReportedError {
	return (
		typeof value === 'object' &&
		value !== null &&
		'at' in value &&
		typeof value.at === 'string' &&
		'code' in value &&
		typeof value.code === 'string' &&
		'type' in value &&
		(typeof value.type === 'string' || value.type === null)
	)
}

function isExpected(value: unknown): value is Expected {
	return (
		typeof value === 'object' &&
		value !== null &&
		'inputs' in value &&
		isStringArray(value.inputs) &&
		'summary' in value &&
		typeof value.summary === 'string' &&
		'svgs' in value &&
		isStringArray(value.svgs) &&
		'errors' in value &&
		Array.isArray(value.errors) &&
		value.errors.every((error) => isReportedError(error))
	)
}

function readExpected(name: string): Expected {
	const file = path.join(CASES, name, 'expected.json')
	const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
	if (!isExpected(value)) {
		throw new Error(`${file} does not match the Expected shape`)
	}
	return value
}

/**
 * Copies a fixture case to a temporary directory, so outputs never land in the repository.
 * @param name - Case directory under fixtures/cases.
 * @returns The copy's path.
 */
function copyCase(name: string): string {
	const dir = workspace({})
	cpSync(path.join(CASES, name), dir, {recursive: true})
	rmSync(path.join(dir, 'expected.json'))
	return dir
}

function reportedErrors(stderr: string): ReportedError[] {
	return [...stderr.matchAll(ERROR_HEADER)].map(({groups}) => ({
		at: groups?.['at'] ?? '',
		code: groups?.['code'] ?? '',
		type: groups?.['type'] ?? null,
	}))
}

function svgFiles(dir: string): string[] {
	return readdirSync(dir, {recursive: true, encoding: 'utf8'})
		.filter((file) => file.endsWith('.svg'))
		.toSorted()
}

function lastLine(text: string): string | undefined {
	return text.trimEnd().split('\n').at(-1)
}

for (const name of readdirSync(CASES).toSorted()) {
	const expected = readExpected(name)
	const exitCode = expected.errors.length === 0 ? 0 : 1

	test(`check ${name}`, () => {
		const cwd = copyCase(name)

		const {code, stdout, stderr} = pele(['check', ...expected.inputs], {cwd})

		assert.equal(code, exitCode, stderr)
		assert.equal(stdout, '')
		assert.deepEqual(reportedErrors(stderr), expected.errors)
		assert.equal(lastLine(stderr), expected.summary)
		assert.deepEqual(svgFiles(cwd), [])
	})

	test(`render ${name}`, () => {
		const cwd = copyCase(name)

		const {code, stdout, stderr} = pele(['render', ...expected.inputs], {cwd})

		assert.equal(code, exitCode, stderr)
		assert.equal(stdout, expected.svgs.map((svg) => `${svg}\n`).join(''))
		assert.deepEqual(reportedErrors(stderr), expected.errors)
		if (exitCode === 0) {
			assert.equal(stderr, '')
		} else {
			assert.equal(lastLine(stderr), expected.summary)
		}
		assert.deepEqual(svgFiles(cwd), expected.svgs.toSorted())
		for (const svg of expected.svgs) {
			const content = readFileSync(path.join(cwd, svg), 'utf8')
			assert.match(content, /^<svg [^>]*class="pele pele-/u, svg)
			for (const text of expected.svgContains?.[svg] ?? []) {
				assert.ok(content.includes(text), `${svg} contains ${text}`)
			}
		}
	})
}

test('render writes to a nested --out-dir', () => {
	const cwd = copyCase('diagram-files')

	const {code, stdout} = pele(['render', 'flow.mmd', '-o', 'site/assets/svg'], {
		cwd,
	})

	assert.equal(code, 0)
	assert.equal(stdout, 'site/assets/svg/flow.svg\n')
	assert.deepEqual(svgFiles(cwd), ['site/assets/svg/flow.svg'])
})

test('stdin renders to stdout', () => {
	const input = readFileSync(path.join(TYPES, 'pie.mmd'), 'utf8')

	const rendered = pele(['render'], {cwd: workspace({}), input})
	const checked = pele(['check', '-'], {cwd: workspace({}), input})

	assert.equal(rendered.code, 0)
	assert.match(rendered.stdout, /^<svg [^>]*class="pele pele-pie"/u)
	assert.equal(checked.code, 0)
	assert.equal(checked.stderr, '1 diagram valid\n')
})

test('every type `pele types` lists has a fixture', () => {
	const {stdout} = pele(['types'], {cwd: workspace({})})
	const listed = stdout
		.trimEnd()
		.split('\n')
		.map((row) => row.slice(0, row.indexOf(' ')))

	assert.deepEqual(
		readdirSync(TYPES)
			.map((file) => path.basename(file, '.mmd'))
			.toSorted(),
		listed.toSorted(),
	)
})

for (const file of readdirSync(TYPES).toSorted()) {
	const type = path.basename(file, '.mmd')

	test(`renders a ${type} diagram`, () => {
		const cwd = workspace({})
		cpSync(path.join(TYPES, file), path.join(cwd, file))

		const {code, stdout, stderr} = pele(['render', file], {cwd})

		assert.equal(stderr, '')
		assert.equal(code, 0)
		assert.equal(stdout, `${type}.svg\n`)
		const svg = readFileSync(path.join(cwd, `${type}.svg`), 'utf8')
		assert.match(svg, new RegExp(`^<svg [^>]*class="pele pele-${type}"`, 'u'))
	})
}
