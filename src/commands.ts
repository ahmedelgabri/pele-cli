import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {PeleError, render} from 'pele'

import {embeddedCss, renderOptions, reportFormat} from './args.ts'
import type {Flags} from './args.ts'
import {KEYWORDS} from './diagram-types.ts'
import {ExitCode} from './exit-code.ts'
import {report, toProblem} from './report.ts'
import type {Format, Problem} from './report.ts'
import {readDiagrams, readsStdin, readStdin} from './sources.ts'
import type {Diagram} from './sources.ts'
import {embedStyle} from './theme.ts'
import {UsageError} from './usage-error.ts'

type Renderer = (source: string) => string

interface Rendered {
	readonly diagram: Diagram
	readonly svg: string
}

interface Results {
	readonly problems: readonly Problem[]
	readonly rendered: readonly Rendered[]
}

async function readInputs(
	files: readonly string[],
	fromStdin: boolean,
): Promise<Diagram[]> {
	if (fromStdin) {
		return await readStdin()
	}
	const perFile = await Promise.all(
		files.map(async (file) => await readDiagrams(file)),
	)
	return perFile.flat()
}

/**
 * Renders each diagram, collecting the ones Pele rejects.
 * @param diagrams - Diagrams to render.
 * @param renderSvg - Turns diagram source into SVG markup.
 * @returns The rendered diagrams and the problems.
 */
function renderEach(
	diagrams: readonly Diagram[],
	renderSvg: Renderer,
): Results {
	const rendered: Rendered[] = []
	const problems: Problem[] = []
	for (const diagram of diagrams) {
		try {
			rendered.push({diagram, svg: renderSvg(diagram.source)})
		} catch (error) {
			if (!(error instanceof PeleError)) {
				throw error
			}
			problems.push(toProblem(diagram, error))
		}
	}
	return {problems, rendered}
}

function createRenderer(flags: Flags, css: string): Renderer {
	const options = renderOptions(flags)
	if (css === '') {
		return (source) => render(source, options).svg
	}
	return (source) => embedStyle(render(source, options).svg, css)
}

function exitCode(problems: readonly Problem[]): number {
	return problems.length === 0 ? ExitCode.ok : ExitCode.invalid
}

function outputPath(diagram: Diagram, outDir: string | undefined): string {
	const name = path.basename(diagram.file, path.extname(diagram.file))
	const suffix = diagram.index === undefined ? '' : `-${diagram.index}`
	return path.join(outDir ?? path.dirname(diagram.file), `${name}${suffix}.svg`)
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

function renderToStdout(
	diagrams: readonly Diagram[],
	renderSvg: Renderer,
	format: Format,
): number {
	const {problems, rendered} = renderEach(diagrams, renderSvg)
	for (const {svg} of rendered) {
		process.stdout.write(`${svg}\n`)
	}
	report(format, {diagrams: diagrams.length, problems}, false)
	return exitCode(problems)
}

async function renderToFiles(
	diagrams: readonly Diagram[],
	renderSvg: Renderer,
	outDir: string | undefined,
	format: Format,
): Promise<number> {
	assertDistinctOutputs(diagrams, outDir)
	const {problems, rendered} = renderEach(diagrams, renderSvg)
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
	report(format, {diagrams: diagrams.length, problems, written}, false)
	return exitCode(problems)
}

async function check(files: readonly string[], flags: Flags): Promise<number> {
	const format = reportFormat(flags)
	const diagrams = await readInputs(files, readsStdin(files))
	// Check renders rather than only parsing: layout and output limits fail at render time.
	const {problems} = renderEach(diagrams, createRenderer(flags, ''))
	report(format, {diagrams: diagrams.length, problems}, true)
	return exitCode(problems)
}

async function renderCommand(
	files: readonly string[],
	flags: Flags,
): Promise<number> {
	const fromStdin = readsStdin(files)
	const outDir = flags['out-dir']
	if (fromStdin && outDir !== undefined) {
		throw new UsageError('--out-dir cannot be used with stdin')
	}
	const format = reportFormat(flags)
	if (fromStdin && format === 'json') {
		throw new UsageError(
			'--format json cannot be used with stdin: the SVG goes to stdout',
		)
	}
	const renderSvg = createRenderer(flags, await embeddedCss(flags))
	const diagrams = await readInputs(files, fromStdin)
	if (fromStdin) {
		return renderToStdout(diagrams, renderSvg, format)
	}
	return await renderToFiles(diagrams, renderSvg, outDir, format)
}

function listTypes(): number {
	const rows = Object.entries(KEYWORDS)
	const width = Math.max(...rows.map(([type]) => type.length))
	for (const [type, keywords] of rows) {
		process.stdout.write(`${type.padEnd(width)}  ${keywords.join(', ')}\n`)
	}
	return ExitCode.ok
}

export {check, listTypes, renderCommand}
