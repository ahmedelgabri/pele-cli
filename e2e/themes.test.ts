import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import path from 'node:path'
import {test} from 'node:test'

import {workspace} from '../test/helpers.ts'
import {renderStdin} from './install.ts'

type Scheme = 'dark' | 'light'

interface Colors {
	readonly background: string
	readonly node: string
}

const BROWSER_ENV = process.env['PELE_E2E_BROWSER']
if (BROWSER_ENV !== undefined && !existsSync(BROWSER_ENV)) {
	throw new Error(`PELE_E2E_BROWSER does not exist: ${BROWSER_ENV}`)
}

const BROWSER = [
	BROWSER_ENV,
	'/Applications/Helium.app/Contents/MacOS/Helium',
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/Applications/Chromium.app/Contents/MacOS/Chromium',
	'/usr/bin/chromium',
	'/usr/bin/google-chrome',
].find((candidate) => candidate !== undefined && existsSync(candidate))

const SKIP =
	BROWSER === undefined
		? 'no Chromium-based browser found; set PELE_E2E_BROWSER'
		: false

// Blink's preferredColorScheme setting: 0 is dark, 1 is light.
const BLINK_SCHEME: Readonly<Record<Scheme, number>> = {dark: 0, light: 1}

// The SVG is inlined so the page's script can read computed styles; the
// <style> it embeds applies the same way as in a standalone file.
const PAGE_SCRIPT = `<script>
const svg = document.querySelector('svg.pele')
const rect = svg.querySelector('.pele-node rect')
document.body.dataset.colors = JSON.stringify({
	background: getComputedStyle(svg).backgroundColor,
	node: getComputedStyle(rect).fill,
})
</script>`

const BROWSER_TIMEOUT_MS = 120_000

const COLORS_ATTRIBUTE = /data-colors="(?<json>[^"]*)"/u

function renderSvg(flags: readonly string[]): string {
	return renderStdin('flowchart LR\n  A --> B\n', flags, {
		'brand.css': '.pele{--pele-surface:#ff0000}',
	})
}

function parseColors(json: string): Colors {
	const value: unknown = JSON.parse(json)
	if (
		typeof value === 'object' &&
		value !== null &&
		'background' in value &&
		typeof value.background === 'string' &&
		'node' in value &&
		typeof value.node === 'string'
	) {
		return {background: value.background, node: value.node}
	}
	throw new Error(`unexpected colors: ${json}`)
}

/**
 * Opens the SVG in a headless browser with the given color scheme.
 * @param svg - SVG markup.
 * @param scheme - The color scheme the browser reports to the page.
 * @returns The computed background color and node fill.
 */
function computedColors(svg: string, scheme: Scheme): Colors {
	const dir = workspace({
		'page.html': `<!doctype html><body>${svg}${PAGE_SCRIPT}</body>`,
	})
	const page = path.join(dir, 'page.html')
	const dom = execFileSync(
		BROWSER ?? '',
		[
			'--headless',
			'--disable-gpu',
			`--user-data-dir=${path.join(dir, 'profile')}`,
			`--blink-settings=preferredColorScheme=${BLINK_SCHEME[scheme]}`,
			'--dump-dom',
			`file://${page}`,
		],
		{
			encoding: 'utf8',
			stdio: ['ignore', 'pipe', 'ignore'],
			// On a fresh CI runner the first launch has taken from 9 s to more
			// than 30 s; later launches take about 1 s. This only catches hangs.
			timeout: BROWSER_TIMEOUT_MS,
		},
	)
	const json = COLORS_ATTRIBUTE.exec(dom)?.groups?.['json'] ?? ''
	return parseColors(json.replaceAll('&quot;', '"'))
}

const LIGHT: Colors = {
	background: 'rgb(255, 252, 240)',
	node: 'rgb(242, 240, 229)',
}
const DARK: Colors = {background: 'rgb(16, 15, 15)', node: 'rgb(28, 27, 26)'}

test(
	'without --theme the SVG is transparent with Pele defaults',
	{skip: SKIP},
	() => {
		assert.deepEqual(computedColors(renderSvg([]), 'dark'), {
			background: 'rgba(0, 0, 0, 0)',
			node: 'rgb(243, 243, 243)',
		})
	},
)

test('--theme light and dark ignore the color scheme', {skip: SKIP}, () => {
	assert.deepEqual(
		computedColors(renderSvg(['--theme', 'light']), 'dark'),
		LIGHT,
	)
	assert.deepEqual(
		computedColors(renderSvg(['--theme', 'dark']), 'light'),
		DARK,
	)
})

test('--theme auto follows the color scheme', {skip: SKIP}, () => {
	const svg = renderSvg(['--theme', 'auto'])

	assert.deepEqual(computedColors(svg, 'light'), LIGHT)
	assert.deepEqual(computedColors(svg, 'dark'), DARK)
})

test('--css overrides the theme', {skip: SKIP}, () => {
	const svg = renderSvg(['--theme', 'dark', '--css', 'brand.css'])

	assert.deepEqual(computedColors(svg, 'dark'), {
		background: DARK.background,
		node: 'rgb(255, 0, 0)',
	})
})
