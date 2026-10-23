import assert from 'node:assert/strict'
import {test} from 'node:test'

import {detectType, registered} from 'pele'

import {KEYWORDS} from '../src/diagram-types.ts'

// Fails when a Pele upgrade renames a keyword or moves it to another type.
test('every keyword is detected as its diagram type, and Pele can render it', () => {
	for (const [type, keywords] of Object.entries(KEYWORDS)) {
		for (const keyword of keywords) {
			const detected = detectType(keyword)
			assert.equal(detected, type, keyword)
			assert.ok(registered(detected), keyword)
		}
	}
})
