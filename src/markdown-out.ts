import path from 'node:path'

/** Lines `start` to `end` (inclusive) become `text`. */
interface Replacement {
	readonly start: number
	readonly end: number
	readonly text: string
}

/**
 * Builds an image line that points from a Markdown file to an SVG.
 * @param markdownFile - Where the Markdown is written.
 * @param svgFile - The SVG to show.
 * @param alt - Alternative text.
 * @param indent - Indentation of the code block it replaces.
 * @returns The Markdown image line.
 */
function imageLine(
	markdownFile: string,
	svgFile: string,
	alt: string,
	indent: string,
): string {
	const relative = path
		.relative(path.dirname(markdownFile), svgFile)
		.split(path.sep)
		.join('/')
	// CommonMark link destinations with spaces or parentheses need <...>.
	const destination = /[\s()]/u.test(relative) ? `<${relative}>` : relative
	return `${indent}![${alt}](${destination})`
}

/**
 * Replaces line ranges, keeping the document's line endings.
 * @param markdown - The original document.
 * @param replacements - Line ranges as indexes into the document's lines.
 * @returns The rewritten document.
 */
function replaceBlocks(
	markdown: string,
	replacements: readonly Replacement[],
): string {
	const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
	const lines = markdown.split(/\r?\n/u)
	const byStart = new Map(
		replacements.map((replacement) => [replacement.start, replacement]),
	)
	const output: string[] = []
	let index = 0
	while (index < lines.length) {
		const replacement = byStart.get(index)
		output.push(replacement?.text ?? lines[index] ?? '')
		index = replacement === undefined ? index + 1 : replacement.end + 1
	}
	// An unclosed block runs to the end and takes the final newline with it.
	if (lines.at(-1) === '' && output.at(-1) !== '') {
		output.push('')
	}
	return output.join(eol)
}

export type {Replacement}
export {imageLine, replaceBlocks}
