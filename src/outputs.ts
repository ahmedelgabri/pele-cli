import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {imageLine, replaceBlocks} from './markdown-out.ts'
import {isMarkdown, readInputFile} from './sources.ts'
import type {Diagram} from './sources.ts'
import {UsageError} from './usage-error.ts'

interface Rendered {
	readonly diagram: Diagram
	readonly svg: string
	/** The diagram type Pele detected, such as `flowchart`. */
	readonly type: string
}

/** `--markdown-out`: a copy of `input` with diagrams replaced by images. */
interface MarkdownOut {
	readonly input: string
	readonly output: string
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

/**
 * Writes the Markdown copy and each rendered diagram's source next to its SVG.
 * Blocks Pele rejected stay as code, so the copy keeps everything.
 * @param markdown - Input and output Markdown files.
 * @param rendered - Diagrams from that input that rendered.
 * @param outDir - Where the SVGs are, as given by --out-dir.
 * @returns The written files.
 */
async function writeMarkdownOut(
	markdown: MarkdownOut,
	rendered: readonly Rendered[],
	outDir: string | undefined,
): Promise<string[]> {
	const sources = rendered.map(({diagram}) => ({
		content: diagram.source.endsWith('\n')
			? diagram.source
			: `${diagram.source}\n`,
		target: outputPath(diagram, outDir, '.mmd'),
	}))
	const replacements = rendered.flatMap(({diagram, type}) =>
		diagram.block === undefined
			? []
			: [
					{
						end: diagram.block.end,
						start: diagram.lineOffset - 1,
						text: imageLine(
							markdown.output,
							outputPath(diagram, outDir),
							`${type} diagram`,
							diagram.block.indent,
						),
					},
				],
	)
	const copy = replaceBlocks(await readInputFile(markdown.input), replacements)
	await mkdir(path.dirname(markdown.output), {recursive: true})
	await Promise.all([
		...sources.map(async ({content, target}) => {
			await writeFile(target, content)
		}),
		writeFile(markdown.output, copy),
	])
	return [...sources.map(({target}) => target), markdown.output]
}

function markdownOut(
	files: readonly string[],
	fromStdin: boolean,
	output: string | undefined,
): MarkdownOut | undefined {
	if (output === undefined) {
		return undefined
	}
	const [input] = files
	if (
		fromStdin ||
		files.length !== 1 ||
		input === undefined ||
		!isMarkdown(input)
	) {
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
	if (outDir !== undefined) {
		await mkdir(outDir, {recursive: true})
	}
	const outputs = rendered.map(({diagram, svg}) => ({
		svg,
		target: outputPath(diagram, outDir),
	}))
	await Promise.all(
		outputs.map(async ({svg, target}) => {
			await writeFile(target, `${svg}\n`)
		}),
	)
	const written = outputs.map(({target}) => target)
	if (markdown !== undefined) {
		written.push(...(await writeMarkdownOut(markdown, rendered, outDir)))
	}
	return written
}

export type {MarkdownOut, Rendered}
export {assertDistinctOutputs, markdownOut, writeOutputs}
