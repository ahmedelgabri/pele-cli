import {parseArgs} from 'node:util'

import type {RenderOptions} from 'pele'

import {parseFormat} from './report.ts'
import type {Format} from './report.ts'
import {readInputFile} from './sources.ts'
import {assertEmbeddable, themeCss} from './theme.ts'
import {describeError, UsageError} from './usage-error.ts'

// Pele's RenderOptions, used by check and render.
const RENDER_OPTIONS = {
	'auto-direction': {type: 'boolean'},
	'direction-breakpoint': {type: 'string'},
	'font-family': {type: 'string'},
	'font-family-mono': {type: 'string'},
	'font-size': {type: 'string'},
	'image-schemes': {type: 'string'},
	images: {type: 'boolean'},
	limit: {type: 'string'},
	'link-rel': {type: 'string'},
	'link-schemes': {type: 'string'},
	links: {type: 'boolean'},
	'max-edges': {type: 'string'},
	'max-width': {type: 'string'},
	now: {type: 'string'},
	'output-limit': {type: 'string'},
	padding: {type: 'string'},
	responsive: {type: 'boolean'},
} as const

// What render writes, and how.
const OUTPUT_OPTIONS = {
	css: {type: 'string'},
	'markdown-out': {type: 'string'},
	'out-dir': {short: 'o', type: 'string'},
	theme: {type: 'string'},
} as const

// How check and render report results.
const REPORT_OPTIONS = {
	format: {type: 'string'},
} as const

const OPTIONS = {
	...RENDER_OPTIONS,
	...OUTPUT_OPTIONS,
	...REPORT_OPTIONS,
	help: {short: 'h', type: 'boolean'},
	version: {short: 'v', type: 'boolean'},
} as const

const RENDER_FLAGS: readonly string[] = Object.keys(RENDER_OPTIONS)
const OUTPUT_FLAGS: readonly string[] = Object.keys(OUTPUT_OPTIONS)
const REPORT_FLAGS: readonly string[] = Object.keys(REPORT_OPTIONS)

const PARSE_CONFIG = {
	allowNegative: true,
	allowPositionals: true,
	options: OPTIONS,
} as const

type CommandLine = ReturnType<typeof parseArgs<typeof PARSE_CONFIG>>
type Flags = Readonly<CommandLine['values']>
type Unset<Options> = {
	[Key in keyof Options]-?: Options[Key] | undefined
}

function parseCommandLine(args: readonly string[]): CommandLine {
	try {
		return parseArgs({...PARSE_CONFIG, args: [...args]})
	} catch (error) {
		throw new UsageError(describeError(error))
	}
}

function number(
	flag: string,
	value: string | undefined,
	min: number,
): number | undefined {
	if (value === undefined) {
		return undefined
	}
	const parsed = Number(value)
	if (value.trim() === '' || !Number.isFinite(parsed) || parsed < min) {
		throw new UsageError(`--${flag} must be a number >= ${min}, got "${value}"`)
	}
	return parsed
}

function list(value: string | undefined): string[] | undefined {
	return value
		?.split(',')
		.map((item) => item.trim())
		.filter((item) => item !== '')
}

function date(value: string | undefined): Date | undefined {
	if (value === undefined) {
		return undefined
	}
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) {
		throw new UsageError(`--now must be a date, got "${value}"`)
	}
	return parsed
}

function renderOptions(flags: Flags): RenderOptions {
	const options: Omit<
		Unset<RenderOptions>,
		'config' | 'icons' | 'idPrefix' | 'measurer'
	> = {
		autoDirection: flags['auto-direction'],
		directionBreakpoint: number(
			'direction-breakpoint',
			flags['direction-breakpoint'],
			0,
		),
		fontFamily: flags['font-family'],
		fontFamilyMono: flags['font-family-mono'],
		fontSize: number('font-size', flags['font-size'], 1),
		imageSchemes: list(flags['image-schemes']),
		images: flags.images,
		limit: number('limit', flags.limit, 1),
		linkRel: flags['link-rel'],
		linkSchemes: list(flags['link-schemes']),
		links: flags.links,
		maxEdges: number('max-edges', flags['max-edges'], 1),
		maxWidth: number('max-width', flags['max-width'], 1),
		now: date(flags.now),
		outputLimit: number('output-limit', flags['output-limit'], 1),
		padding: number('padding', flags.padding, 0),
		responsive: flags.responsive,
	}
	// Pass only the flags the user set so Pele's own defaults apply to everything else.
	return Object.fromEntries(
		Object.entries(options).filter(([, value]) => value !== undefined),
	)
}

async function customCss(file: string): Promise<string> {
	const css = await readInputFile(file)
	assertEmbeddable(css, file)
	return css
}

async function embeddedCss(flags: Flags): Promise<string> {
	const theme = flags.theme === undefined ? '' : themeCss(flags.theme)
	const custom = flags.css === undefined ? '' : await customCss(flags.css)
	return theme + custom
}

export type {Flags}
function reportFormat(flags: Flags): Format {
	// GitHub Actions sets GITHUB_ACTIONS=true; annotations then show on the PR.
	const fallback = process.env['GITHUB_ACTIONS'] === 'true' ? 'github' : 'text'
	return parseFormat(flags.format ?? fallback)
}

export {
	embeddedCss,
	OUTPUT_FLAGS,
	parseCommandLine,
	RENDER_FLAGS,
	renderOptions,
	REPORT_FLAGS,
	reportFormat,
}
