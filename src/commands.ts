import {PeleError, render} from 'pele'

import {embeddedCss, renderOptions, reportFormat} from './args.ts'
import type {Flags} from './args.ts'
import {KEYWORDS} from './diagram-types.ts'
import {ExitCode} from './exit-code.ts'
import {assertDistinctOutputs, markdownOut, writeOutputs} from './outputs.ts'
import type {MarkdownOut, Rendered} from './outputs.ts'
import {report, toProblem} from './report.ts'
import type {Format, Problem} from './report.ts'
import {readDiagrams, readsStdin, readStdin} from './sources.ts'
import type {Diagram} from './sources.ts'
import {embedStyle} from './theme.ts'
import {UsageError} from './usage-error.ts'

type Renderer = (source: string) => Omit<Rendered, 'diagram'>

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
			rendered.push({diagram, ...renderSvg(diagram.source)})
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
	return (source) => {
		const {svg, type} = render(source, options)
		return {svg: css === '' ? svg : embedStyle(svg, css), type}
	}
}

function exitCode(problems: readonly Problem[]): number {
	return problems.length === 0 ? ExitCode.ok : ExitCode.invalid
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
	markdown: MarkdownOut | undefined,
): Promise<number> {
	assertDistinctOutputs(diagrams, outDir)
	const {problems, rendered} = renderEach(diagrams, renderSvg)
	const written = await writeOutputs(rendered, outDir, markdown)
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
	const markdown = markdownOut(files, fromStdin, flags['markdown-out'])
	const renderSvg = createRenderer(flags, await embeddedCss(flags))
	const diagrams = await readInputs(files, fromStdin)
	if (fromStdin) {
		return renderToStdout(diagrams, renderSvg, format)
	}
	return await renderToFiles(diagrams, renderSvg, outDir, format, markdown)
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
