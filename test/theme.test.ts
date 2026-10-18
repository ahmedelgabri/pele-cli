import assert from 'node:assert/strict'
import {test} from 'node:test'

import {embedStyle} from '../src/theme.ts'

test('embeds the style after the svg start tag, even when an attribute contains ">"', () => {
	const svg = '<svg class="pele" aria-label="a > b"><g/></svg>'

	assert.equal(
		embedStyle(svg, '.pele{}'),
		'<svg class="pele" aria-label="a > b"><style><![CDATA[.pele{}]]></style><g/></svg>',
	)
})
