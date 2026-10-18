import assert from 'node:assert/strict'
import {test} from 'node:test'

import {detectType, registered} from 'pele'

import {KEYWORDS} from '../src/diagram-types.ts'

// Fails when a Pele upgrade renames or drops a keyword that `pele types` lists.
test('every listed keyword is a diagram type Pele can render', () => {
	for (const keyword of KEYWORDS) {
		const type = detectType(keyword)
		assert.ok(type, `Pele does not detect "${keyword}"`)
		assert.ok(registered(type), `Pele has no renderer for "${type}"`)
	}
})
