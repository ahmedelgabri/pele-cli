import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {text} from 'node:stream/consumers'

import {describeError, UsageError} from './usage-error.ts'

interface Diagram {
	/** Display path, or `<stdin>`. */
	readonly file: string
	/** Lines in `file` before the diagram source, used to map Pele error lines back to the file. */
	readonly lineOffset: number
	/** 1-based position of the block in a Markdown file. */
	readonly index?: number
	readonly source: string
}

type Fence = Pick<Diagram, 'lineOffset' | 'source'>

interface CodeBlock {
	/** Index of the closing fence line, or the line count when the block is unclosed. */
	readonly end: number
	readonly language: string
	readonly source: string
}

interface OpeningFence {
	readonly closing: RegExp
	readonly indent: RegExp
	readonly language: string
}

const STDIN = '<stdin>'
const DIAGRAM_EXTENSIONS = new Set(['.mermaid', '.mmd'])
const MARKDOWN_EXTENSIONS = new Set(['.markdown', '.md'])
const FENCE_LANGUAGE = 'mermaid'
const OPENING_FENCE = /^(?<indent> {0,3})(?<fence>`{3,}|~{3,})(?<info>.*)$/u

/**
 * Decides from the arguments alone whether the input is stdin, so usage
 * errors come before any reading.
 * @param files - File arguments; none or a single `-` means stdin.
 * @returns Whether to read stdin.
 */
function readsStdin(files: readonly string[]): boolean {
	if (files.length === 0) {
		if (process.stdin.isTTY) {
			throw new UsageError('no input files')
		}
		return true
	}
	if (files.length === 1 && files[0] === '-') {
		return true
	}
	if (files.includes('-')) {
		throw new UsageError('stdin (-) cannot be combined with files')
	}
	return false
}

async function readStdin(): Promise<Diagram[]> {
	return [{file: STDIN, lineOffset: 0, source: await text(process.stdin)}]
}

async function readInputFile(file: string): Promise<string> {
	try {
		return await readFile(file, 'utf8')
	} catch (error) {
		throw new UsageError(`${file}: ${describeError(error)}`)
	}
}

function parseOpeningFence(line: string): OpeningFence | undefined {
	const groups = OPENING_FENCE.exec(line)?.groups
	if (groups === undefined) {
		return undefined
	}
	const {fence = '', indent = '', info = ''} = groups
	// CommonMark: the info string of a backtick fence cannot contain backticks.
	if (fence.startsWith('`') && info.includes('`')) {
		return undefined
	}
	return {
		closing: new RegExp(
			`^ {0,3}${fence.charAt(0)}{${fence.length},}\\s*$`,
			'u',
		),
		indent: new RegExp(`^ {0,${indent.length}}`, 'u'),
		language: info.trim().split(/\s+/u).at(0)?.toLowerCase() ?? '',
	}
}

function readCodeBlock(
	lines: readonly string[],
	start: number,
): CodeBlock | undefined {
	const opening = parseOpeningFence(lines[start] ?? '')
	if (opening === undefined) {
		return undefined
	}
	const closing = lines.findIndex(
		(line, lineIndex) => lineIndex > start && opening.closing.test(line),
	)
	const end = closing === -1 ? lines.length : closing
	const source = lines
		.slice(start + 1, end)
		.map((line) => line.replace(opening.indent, ''))
		.join('\n')
	return {end, language: opening.language, source}
}

/**
 * Finds `mermaid` fenced code blocks, following the CommonMark fence rules.
 * Every fence is tracked, so diagrams quoted inside other code blocks are skipped.
 * @param markdown - The Markdown document.
 * @returns Each diagram with the line number of its opening fence.
 */
function extractFences(markdown: string): Fence[] {
	const lines = markdown.split(/\r?\n/u)
	const fences: Fence[] = []
	let index = 0
	while (index < lines.length) {
		const block = readCodeBlock(lines, index)
		if (block !== undefined && block.language === FENCE_LANGUAGE) {
			fences.push({lineOffset: index + 1, source: block.source})
		}
		index = block === undefined ? index + 1 : block.end + 1
	}
	return fences
}

async function readDiagrams(file: string): Promise<Diagram[]> {
	const extension = path.extname(file).toLowerCase()
	if (MARKDOWN_EXTENSIONS.has(extension)) {
		const fences = extractFences(await readInputFile(file))
		return fences.map((fence, position) => ({
			file,
			index: position + 1,
			lineOffset: fence.lineOffset,
			source: fence.source,
		}))
	}
	if (DIAGRAM_EXTENSIONS.has(extension)) {
		return [{file, lineOffset: 0, source: await readInputFile(file)}]
	}
	const supported = [...DIAGRAM_EXTENSIONS, ...MARKDOWN_EXTENSIONS].join(', ')
	throw new UsageError(`${file}: unsupported file type (expected ${supported})`)
}

export type {Diagram}
export {
	extractFences,
	readDiagrams,
	readInputFile,
	readsStdin,
	readStdin,
	STDIN,
}
