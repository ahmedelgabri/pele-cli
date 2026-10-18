import {detectType} from 'pele'
import type {DiagramType} from 'pele'

// Pele exports no list of its types, so this mirrors https://pele.run/compatibility.
// The type names come from Pele's own detectType(), and a test checks every keyword.
const KEYWORDS = [
	'flowchart',
	'graph',
	'swimlane-beta',
	'sequenceDiagram',
	'classDiagram',
	'stateDiagram',
	'stateDiagram-v2',
	'erDiagram',
	'gantt',
	'gitGraph',
	'pie',
	'mindmap',
	'kanban',
	'timeline',
	'journey',
	'quadrantChart',
	'xychart',
	'xychart-beta',
	'requirementDiagram',
	'sankey',
	'sankey-beta',
	'architecture-beta',
	'C4Context',
	'C4Container',
	'C4Component',
	'C4Dynamic',
	'C4Deployment',
	'block',
	'block-beta',
	'agentflow-beta',
	'railroad-beta',
	'railroad-ebnf-beta',
	'railroad-abnf-beta',
	'railroad-peg-beta',
	'treeView-beta',
	'cynefin-beta',
	'wardley-beta',
	'eventmodeling',
	'usecase-beta',
	'venn-beta',
	'ishikawa',
	'ishikawa-beta',
	'packet',
	'packet-beta',
	'radar-beta',
	'treemap',
	'treemap-beta',
	'info',
]

function keywordsByType(): Map<DiagramType, string[]> {
	const types = new Map<DiagramType, string[]>()
	for (const keyword of KEYWORDS) {
		const type = detectType(keyword)
		if (type !== null) {
			types.set(type, [...(types.get(type) ?? []), keyword])
		}
	}
	return types
}

export {KEYWORDS, keywordsByType}
