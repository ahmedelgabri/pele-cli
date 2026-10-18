import assert from 'node:assert/strict'
import {test} from 'node:test'

import {viewBoxSize, WIDE_FLOWCHART, workspace} from '../test/helpers.ts'
import {pele, renderStdin as render} from './install.ts'

const FLOWCHART = 'flowchart LR\n  A --> B\n'

test('font flags set the label fonts and size', () => {
	const svg = render(FLOWCHART, [
		'--font-family',
		'Georgia',
		'--font-family-mono',
		'Menlo',
		'--font-size',
		'20',
	])

	assert.match(svg, /font:20px /u)
	assert.match(svg, /var\(--pele-font,Georgia\)/u)
	assert.match(svg, /var\(--pele-font-mono,Menlo\)/u)
})

test('--padding adds space around the diagram', () => {
	const plain = viewBoxSize(render(FLOWCHART))
	const padded = viewBoxSize(render(FLOWCHART, ['--padding', '40']))

	assert.ok(padded.width > plain.width, `${padded.width} > ${plain.width}`)
	assert.ok(padded.height > plain.height, `${padded.height} > ${plain.height}`)
})

test('--no-responsive keeps the natural pixel size', () => {
	assert.match(render(FLOWCHART), /max-width:100%/u)
	assert.doesNotMatch(render(FLOWCHART, ['--no-responsive']), /max-width/u)
})

test('--now makes Gantt charts reproducible', () => {
	// A task with only a duration starts on the reference date.
	const gantt = 'gantt\n  dateFormat YYYY-MM-DD\n  section S\n  Task :10d\n'
	const january = render(gantt, ['--now', '2026-01-15'])

	assert.equal(render(gantt, ['--now', '2026-01-15']), january)
	assert.notEqual(render(gantt, ['--now', '2026-03-01']), january)
	assert.match(january, />2026-01-15</u)
})

test('limit flags reject diagrams that are too large', () => {
	const cwd = workspace({})
	const source = 'flowchart LR\n  A --> B\n  B --> C\n'

	// Pele checks the source length before it detects the diagram type.
	for (const [flags, firstLine] of [
		[['--limit', '5'], '<stdin>: limit error'],
		[['--output-limit', '100'], '<stdin>: limit error in flowchart diagram'],
		[['--max-edges', '1'], '<stdin>: limit error in flowchart diagram'],
	] as const) {
		const {code, stderr} = pele(['check', ...flags], {cwd, input: source})
		assert.equal(code, 1, flags.join(' '))
		assert.equal(stderr.split('\n')[0], firstLine)
	}
})

test('link flags filter links and set rel', () => {
	const mailto = 'flowchart LR\n  A --> B\n  click A "mailto:team@pele.run"\n'
	const https = 'flowchart LR\n  A --> B\n  click A "https://pele.run"\n'

	assert.match(render(mailto), /href="mailto:team@pele\.run"/u)
	assert.doesNotMatch(render(mailto, ['--link-schemes', 'https']), /href=/u)
	assert.match(
		render(https, ['--link-rel', 'noopener nofollow']),
		/rel="noopener nofollow"/u,
	)
	assert.doesNotMatch(render(https, ['--no-links']), /href=/u)
})

test('image flags filter images', () => {
	const image =
		'flowchart LR\n  A@{ img: "https://pele.run/kepano.svg", label: "K" } --> B\n'

	assert.match(render(image), /<image /u)
	assert.doesNotMatch(render(image, ['--image-schemes', 'http']), /<image /u)
	assert.doesNotMatch(render(image, ['--no-images']), /<image /u)
})

function isVertical(flags: readonly string[]): boolean {
	const {height, width} = viewBoxSize(render(WIDE_FLOWCHART, flags))
	return height > width
}

test('layout flags decide when a wide diagram turns vertical', () => {
	assert.equal(isVertical([]), false)
	assert.equal(isVertical(['--max-width', '400']), true)
	assert.equal(isVertical(['--max-width', '400', '--no-auto-direction']), false)
	assert.equal(
		isVertical(['--max-width', '400', '--direction-breakpoint', '200']),
		false,
	)
})
