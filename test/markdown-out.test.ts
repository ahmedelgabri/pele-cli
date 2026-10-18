import assert from 'node:assert/strict'
import {test} from 'node:test'

import {imageLine, replaceBlocks} from '../src/markdown-out.ts'

test('replaces each block and leaves other lines alone', () => {
	const markdown = ['# T', '```mermaid', 'pie', '```', 'text', ''].join('\n')

	assert.equal(
		replaceBlocks(markdown, [{end: 3, start: 1, text: '![pie](a.svg)'}]),
		['# T', '![pie](a.svg)', 'text', ''].join('\n'),
	)
})

test('keeps CRLF line endings', () => {
	const markdown = ['# T', '```mermaid', 'pie', '```', ''].join('\r\n')

	assert.equal(
		replaceBlocks(markdown, [{end: 3, start: 1, text: 'image'}]),
		['# T', 'image', ''].join('\r\n'),
	)
})

test('an unclosed block at the end keeps the final newline', () => {
	const markdown = ['# T', '```mermaid', 'pie', ''].join('\n')
	const lineCount = markdown.split('\n').length

	assert.equal(
		replaceBlocks(markdown, [{end: lineCount, start: 1, text: 'image'}]),
		'# T\nimage\n',
	)
})

test('links from the Markdown file to the SVG, keeping the block indent', () => {
	assert.equal(
		imageLine('site/guide.md', 'assets/guide-1.svg', 'pie diagram', '  '),
		'  ![pie diagram](../assets/guide-1.svg)',
	)
	assert.equal(
		imageLine('guide.md', 'my assets/guide (1).svg', 'pie diagram', ''),
		'![pie diagram](<my assets/guide (1).svg>)',
	)
})
