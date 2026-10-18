import {UsageError} from './usage-error.ts'

// The palettes pele.run uses for its own light and dark modes (Flexoki).
const LIGHT = {
	accent: '#205ea6',
	bg: '#fffcf0',
	border: '#cecdc3',
	critical: '#af3029',
	fg: '#100f0f',
	line: '#100f0f',
	muted: '#6f6e69',
	'series-1': '#af3029',
	'series-2': '#bc5215',
	'series-3': '#ad8301',
	'series-4': '#66800b',
	'series-5': '#24837b',
	'series-6': '#205ea6',
	'series-7': '#5e409d',
	'series-8': '#a02f6f',
	surface: '#f2f0e5',
	'surface-alt': '#e6e4d9',
}

const DARK: typeof LIGHT = {
	accent: '#4385be',
	bg: '#100f0f',
	border: '#403e3c',
	critical: '#d14d41',
	fg: '#cecdc3',
	line: '#cecdc3',
	muted: '#878580',
	'series-1': '#d14d41',
	'series-2': '#da702c',
	'series-3': '#d0a215',
	'series-4': '#879a39',
	'series-5': '#3aa99f',
	'series-6': '#4385be',
	'series-7': '#8b7ec8',
	'series-8': '#ce5d97',
	surface: '#1c1b1a',
	'surface-alt': '#282726',
}

// Pele leaves the SVG transparent; a themed file must paint its own background
// or dark text ends up on a dark page (and the reverse).
const BACKGROUND = '.pele{background:var(--pele-bg)}'

// Attribute values are quoted, so a `>` inside quotes doesn't end the tag.
const SVG_START_TAG = /^<svg\b(?:[^>"']|"[^"]*"|'[^']*')*>/u

function variables(palette: Readonly<typeof LIGHT>): string {
	const declarations = Object.entries(palette).map(
		([name, value]) => `--pele-${name}:${value}`,
	)
	return `.pele{${declarations.join(';')}}`
}

const THEME_CSS: ReadonlyMap<string, string> = new Map([
	['light', variables(LIGHT) + BACKGROUND],
	['dark', variables(DARK) + BACKGROUND],
	[
		'auto',
		`${variables(LIGHT)}@media (prefers-color-scheme:dark){${variables(DARK)}}${BACKGROUND}`,
	],
])

function themeCss(name: string): string {
	const css = THEME_CSS.get(name)
	if (css === undefined) {
		const names = [...THEME_CSS.keys()].join(', ')
		throw new UsageError(`--theme must be one of ${names}, got "${name}"`)
	}
	return css
}

function assertEmbeddable(css: string, origin: string): void {
	if (css.includes(']]>')) {
		throw new UsageError(`${origin}: CSS cannot contain "]]>"`)
	}
}

/**
 * Embeds CSS in the SVG so the file keeps its theme wherever it is opened.
 * @param svg - SVG markup from Pele.
 * @param css - CSS that passed assertEmbeddable().
 * @returns The SVG with a `<style>` element as its first child.
 */
function embedStyle(svg: string, css: string): string {
	const start = SVG_START_TAG.exec(svg)
	if (start === null) {
		throw new Error('Pele output does not start with an <svg> tag')
	}
	const end = start[0].length
	return `${svg.slice(0, end)}<style><![CDATA[${css}]]></style>${svg.slice(end)}`
}

export {assertEmbeddable, embedStyle, themeCss}
