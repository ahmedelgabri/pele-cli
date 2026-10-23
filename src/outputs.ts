import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import type {DiagramType} from 'pele'

import {imageLine, replaceBlocks} from './markdown-out.ts'
import type {Replacement} from './markdown-out.ts'
import {isMarkdown, readInputFile} from './sources.ts'
import type {Diagram} from './sources.ts'
import {UsageError} from './usage-error.ts'

interface Rendered {
	readonly diagram: Diagram
	readonly svg: string
	readonly type: DiagramType
}

/** `--markdown-out`: a copy of `input` with diagrams replaced by images. */
interface MarkdownOut {
	readonly input: string
	readonly output: string
}

interface OutputFile {
	readonly content: string
	readonly target: string
}

function outputPath(
	diagram: Diagram,
	outDir: string | undefined,
	extension = '.svg',
): string {
	const name = path.basename(diagram.file, path.extname(diagram.file))
	const suffix = diagram.index === undefined ? '' : `-${diagram.index}`
	const file = `${name}${suffix}${extension}`
	return path.join(outDir ?? path.dirname(diagram.file), file)
}

function withNewline(text: string): string {
	return text.endsWith('\n') ? text : `${text}\n`
}

function assertDistinctOutputs(
	diagrams: readonly Diagram[],
	outDir: string | undefined,
): void {
	const writers = new Map<string, string>()
	for (const diagram of diagrams) {
		const target = outputPath(diagram, outDir)
		const other = writers.get(target)
		if (other !== undefined) {
			throw new UsageError(
				`${other} and ${diagram.file} would both write ${target}`,
			)
		}
		writers.set(target, diagram.file)
	}
}

function markdownOut(
	files: readonly string[],
	output: string | undefined,
): MarkdownOut | undefined {
	if (output === undefined) {
		return undefined
	}
	// Stdin arrives as [] or ['-'], which this rejects as well.
	const [input] = files
	if (files.length !== 1 || input === undefined || !isMarkdown(input)) {
		throw new UsageError('--markdown-out needs exactly one Markdown input file')
	}
	if (path.resolve(output) === path.resolve(input)) {
		throw new UsageError(
			'--markdown-out must be a new file: replacing the input would lose the diagram source',
		)
	}
	return {input, output}
}

/**
 * The Markdown copy, and each rendered diagram's source next to its SVG.
 * Blocks Pele rejected stay as code, so the copy keeps everything.
 * @param markdown - Input and output Markdown files.
 * @param rendered - Diagrams from that input that rendered.
 * @param outDir - Where the SVGs go, as given by --out-dir.
 * @returns The files to write.
 */
async function markdownFiles(
	markdown: MarkdownOut,
	rendered: readonly Rendered[],
	outDir: string | undefined,
): Promise<OutputFile[]> {
	const replacements: Replacement[] = []
	for (const {diagram, type} of rendered) {
		if (diagram.block !== undefined) {
			const svg = outputPath(diagram, outDir)
			replacements.push({
				end: diagram.block.end,
				start: diagram.block.start,
				text: imageLine(
					markdown.output,
					svg,
					`${type} diagram`,
					diagram.block.indent,
				),
			})
		}
	}
	const copy = replaceBlocks(await readInputFile(markdown.input), replacements)
	return [
		...rendered.map(({diagram}) => ({
			content: withNewline(diagram.source),
			target: outputPath(diagram, outDir, '.mmd'),
		})),
		{content: copy, target: markdown.output},
	]
}

/**
 * Writes each rendered SVG, and the Markdown copy when asked for.
 * @param rendered - Diagrams that rendered.
 * @param outDir - --out-dir, or next to each input.
 * @param markdown - --markdown-out.
 * @returns The written files, in order.
 */
async function writeOutputs(
	rendered: readonly Rendered[],
	outDir: string | undefined,
	markdown: MarkdownOut | undefined,
): Promise<string[]> {
	const svgs = rendered.map(({diagram, svg}) => ({
		content: withNewline(svg),
		target: outputPath(diagram, outDir),
	}))
	const files =
		markdown === undefined
			? svgs
			: [...svgs, ...(await markdownFiles(markdown, rendered, outDir))]
	const directories = new Set(files.map(({target}) => path.dirname(target)))
	await Promise.all(
		[...directories].map(async (directory) => {
			await mkdir(directory, {recursive: true})
		}),
	)
	await Promise.all(
		files.map(async ({content, target}) => {
			await writeFile(target, content)
		}),
	)
	return files.map(({target}) => target)
}

export type {MarkdownOut, Rendered}
export {assertDistinctOutputs, markdownOut, writeOutputs}
