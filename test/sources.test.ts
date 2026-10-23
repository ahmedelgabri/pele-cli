import assert from 'node:assert/strict'
import {test} from 'node:test'

import {extractFences} from '../src/sources.ts'

test('extracts mermaid fences with the line of their opening fence', () => {
	const lines = [
		'# Title',
		'```mermaid',
		'flowchart LR',
		'  A --> B',
		'```',
		'```js',
		'console.log(1)',
		'```',
		'~~~ Mermaid title',
		'pie',
		'~~~',
	]

	assert.deepEqual(extractFences(lines.join('\n')), [
		{
			block: {end: 4, indent: '', start: 1},
			lineOffset: lines.indexOf('```mermaid') + 1,
			source: 'flowchart LR\n  A --> B',
		},
		{
			block: {end: 10, indent: '', start: 8},
			lineOffset: lines.indexOf('~~~ Mermaid title') + 1,
			source: 'pie',
		},
	])
})

test('skips diagrams quoted inside other code blocks', () => {
	const markdown = [
		'````md',
		'```mermaid',
		'pie',
		'```',
		'````',
		'```mermaid',
		'info',
		'```',
	].join('\n')

	assert.deepEqual(extractFences(markdown), [
		{block: {end: 7, indent: '', start: 5}, lineOffset: 6, source: 'info'},
	])
})

test('closes a fence only with the same character and at least the same length', () => {
	const markdown = ['````mermaid', 'pie', '```', '~~~~', '````'].join('\n')

	assert.deepEqual(extractFences(markdown), [
		{
			block: {end: 4, indent: '', start: 0},
			lineOffset: 1,
			source: 'pie\n```\n~~~~',
		},
	])
})

test('an unclosed fence runs to the end of the document', () => {
	assert.deepEqual(extractFences('```mermaid\npie\n  "a": 1'), [
		{
			block: {end: 3, indent: '', start: 0},
			lineOffset: 1,
			source: 'pie\n  "a": 1',
		},
	])
})

test('removes the indentation of an indented fence from its content', () => {
	const markdown = [
		'  ```mermaid',
		'  flowchart LR',
		'      A --> B',
		'  ```',
	].join('\n')

	assert.deepEqual(extractFences(markdown), [
		{
			block: {end: 3, indent: '  ', start: 0},
			lineOffset: 1,
			source: 'flowchart LR\n    A --> B',
		},
	])
})
