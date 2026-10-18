import type {DiagramType} from 'pele'

// Pele exports the DiagramType union but no list of keywords, so this mirrors
// https://pele.run/compatibility. Typing it by DiagramType makes tsc fail when a
// Pele upgrade adds or drops a type, and a test checks each keyword's type.
const KEYWORDS: Readonly<Record<DiagramType, readonly string[]>> = {
	flowchart: ['flowchart', 'graph'],
	swimlane: ['swimlane-beta'],
	sequence: ['sequenceDiagram'],
	class: ['classDiagram'],
	state: ['stateDiagram', 'stateDiagram-v2'],
	er: ['erDiagram'],
	gantt: ['gantt'],
	gitGraph: ['gitGraph'],
	pie: ['pie'],
	mindmap: ['mindmap'],
	kanban: ['kanban'],
	timeline: ['timeline'],
	journey: ['journey'],
	quadrantChart: ['quadrantChart'],
	xychart: ['xychart', 'xychart-beta'],
	requirement: ['requirementDiagram'],
	sankey: ['sankey', 'sankey-beta'],
	architecture: ['architecture-beta'],
	c4: ['C4Context', 'C4Container', 'C4Component', 'C4Dynamic', 'C4Deployment'],
	block: ['block', 'block-beta'],
	agentflow: ['agentflow-beta'],
	railroad: [
		'railroad-beta',
		'railroad-ebnf-beta',
		'railroad-abnf-beta',
		'railroad-peg-beta',
	],
	treeView: ['treeView-beta'],
	cynefin: ['cynefin-beta'],
	wardley: ['wardley-beta'],
	eventmodeling: ['eventmodeling'],
	usecase: ['usecase-beta'],
	venn: ['venn-beta'],
	ishikawa: ['ishikawa', 'ishikawa-beta'],
	packet: ['packet', 'packet-beta'],
	radar: ['radar-beta'],
	treemap: ['treemap', 'treemap-beta'],
	info: ['info'],
}

export {KEYWORDS}
