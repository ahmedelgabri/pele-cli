import {mkdir, writeFile} from 'node:fs/promises'
import path from 'node:path'

import {PeleError, render} from 'pele'

import {embeddedCss, renderOptions} from './args.ts'
import type {Flags} from './args.ts'
import {keywordsByType} from './diagram-types.ts'
import {ExitCode} from './exit-code.ts'
import {readDiagrams, readStdin, STDIN} from './sources.ts'
import type {Diagram} from './sources.ts'
import {embedStyle} from './theme.ts'
import {UsageError} from './usage-error.ts'

type Renderer = (source: string) => string

interface Rendered {
	readonly diagram: Diagram
	readonly svg: string
}

interface Results {
	readonly failed: number
	readonly rendered: readonly Rendered[]
}

async function readInputs(files: readonly string[]): Promise<Diagram[]> {
	const fromStdin =
		files.length === 0 || (files.length === 1 && files[0] === '-')
	if (fromStdin) {
		if (files.length === 0 && process.stdin.isTTY) {
			throw new UsageError('no input files')
		}
		return await readStdin()
	}
	if (files.includes('-')) {
		throw new UsageError('stdin (-) cannot be combined with files')
	}
	const perFile = await Promise.all(
		files.map(async (file) => await readDiagrams(file)),
	)
	return perFile.flat()
}

function location(diagram: Diagram, error: Readonly<PeleError>): string {
	if (error.line > 0) {
		return `${diagram.file}:${diagram.lineOffset + error.line}:${error.column}`
	}
	if (diagram.lineOffset > 0) {
		return `${diagram.file}:${diagram.lineOffset}`
	}
	return diagram.file
}

function report(diagram: Diagram, error: Readonly<PeleError>): void {
	const type = error.type === null ? '' : ` in ${error.type} diagram`
	const message = error.message.replaceAll(/^/gmu, '  ')
	process.stderr.write(
		`${location(diagram, error)}: ${error.code} error${type}\n${message}\n`,
	)
}

function tryRender(diagram: Diagram, renderSvg: Renderer): string | undefined {
	try {
		return renderSvg(diagram.source)
	} catch (error) {
		if (!(error instanceof PeleError)) {
			throw error
		}
		report(diagram, error)
		return undefined
	}
}

/**
 * Renders each diagram and reports the ones Pele rejects.
 * @param diagrams - Diagrams to render.
 * @param renderSvg - Turns diagram source into SVG markup.
 * @returns The rendered diagrams and how many failed.
 */
function renderEach(
	diagrams: readonly Diagram[],
	renderSvg: Renderer,
): Results {
	const rendered: Rendered[] = []
	for (const diagram of diagrams) {
		const svg = tryRender(diagram, renderSvg)
		if (svg !== undefined) {
			rendered.push({diagram, svg})
		}
	}
	return {failed: diagrams.length - rendered.length, rendered}
}

function createRenderer(flags: Flags, css: string): Renderer {
	const options = renderOptions(flags)
	if (css === '') {
		return (source) => render(source, options).svg
	}
	return (source) => embedStyle(render(source, options).svg, css)
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`
}

function failureSummary(failed: number, total: number): string {
	return `${plural(failed, 'invalid diagram')} of ${total}\n`
}

function exitCode(failed: number): number {
	return failed === 0 ? ExitCode.ok : ExitCode.invalid
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
	outDir: string | undefined,
): number {
	if (outDir !== undefined) {
		throw new UsageError('--out-dir cannot be used with stdin')
	}
	const {failed, rendered} = renderEach(diagrams, renderSvg)
	for (const {svg} of rendered) {
		process.stdout.write(`${svg}\n`)
	}
	return exitCode(failed)
}

async function renderToFiles(
	diagrams: readonly Diagram[],
	renderSvg: Renderer,
	outDir: string | undefined,
): Promise<number> {
	assertDistinctOutputs(diagrams, outDir)
	const {failed, rendered} = renderEach(diagrams, renderSvg)
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
	process.stdout.write(outputs.map(({target}) => `${target}\n`).join(''))
	if (failed > 0) {
		process.stderr.write(failureSummary(failed, diagrams.length))
	}
	return exitCode(failed)
}

async function check(files: readonly string[], flags: Flags): Promise<number> {
	const diagrams = await readInputs(files)
	// Check renders rather than only parsing: layout and output limits fail at render time.
	const {failed} = renderEach(diagrams, createRenderer(flags, ''))
	process.stderr.write(
		failed === 0
			? `${plural(diagrams.length, 'diagram')} valid\n`
			: failureSummary(failed, diagrams.length),
	)
	return exitCode(failed)
}

async function renderCommand(
	files: readonly string[],
	flags: Flags,
): Promise<number> {
	const renderSvg = createRenderer(flags, await embeddedCss(flags))
	const diagrams = await readInputs(files)
	if (diagrams.at(0)?.file === STDIN) {
		return renderToStdout(diagrams, renderSvg, flags['out-dir'])
	}
	return await renderToFiles(diagrams, renderSvg, flags['out-dir'])
}

function listTypes(): number {
	const rows = [...keywordsByType()]
	const width = Math.max(...rows.map(([type]) => type.length))
	for (const [type, keywords] of rows) {
		process.stdout.write(`${type.padEnd(width)}  ${keywords.join(', ')}\n`)
	}
	return ExitCode.ok
}

export {check, listTypes, renderCommand}
