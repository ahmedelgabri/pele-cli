import type {PeleError} from 'pele'

import {STDIN} from './sources.ts'
import type {Diagram} from './sources.ts'
import {UsageError} from './usage-error.ts'

const FORMATS = ['text', 'json', 'github'] as const
type Format = (typeof FORMATS)[number]

/** A diagram Pele rejected, located in the input file. */
interface Problem {
	readonly file: string
	readonly line: number | null
	readonly column: number | null
	readonly code: string
	readonly type: string | null
	readonly message: string
}

interface Outcome {
	readonly diagrams: number
	readonly problems: readonly Problem[]
	/** Files render wrote, in order; absent for check and for stdout output. */
	readonly written?: readonly string[]
}

function parseFormat(value: string): Format {
	const format = FORMATS.find((name) => name === value)
	if (format === undefined) {
		throw new UsageError(
			`--format must be one of ${FORMATS.join(', ')}, got "${value}"`,
		)
	}
	return format
}

function toProblem(diagram: Diagram, error: Readonly<PeleError>): Problem {
	const located = error.line > 0
	// Without a position, a Markdown diagram still points at its opening fence.
	const line = located ? diagram.lineOffset + error.line : diagram.lineOffset
	return {
		code: error.code,
		column: located ? error.column : null,
		file: diagram.file,
		line: line > 0 ? line : null,
		message: error.message,
		type: error.type,
	}
}

function describe(problem: Problem): string {
	const type = problem.type === null ? '' : ` in ${problem.type} diagram`
	return `${problem.code} error${type}`
}

function textProblem(problem: Problem): string {
	const location = [problem.file, problem.line, problem.column]
		.filter((part) => part !== null)
		.join(':')
	const message = problem.message.replaceAll(/^/gmu, '  ')
	return `${location}: ${describe(problem)}\n${message}\n`
}

// https://docs.github.com/actions/reference/workflow-commands-for-github-actions
function escapeData(text: string): string {
	return text
		.replaceAll('%', '%25')
		.replaceAll('\r', '%0D')
		.replaceAll('\n', '%0A')
}

function escapeProperty(text: string): string {
	return escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C')
}

function githubProblem(problem: Problem): string {
	const properties = [
		problem.file === STDIN ? null : `file=${escapeProperty(problem.file)}`,
		problem.line === null ? null : `line=${problem.line}`,
		problem.column === null ? null : `col=${problem.column}`,
		`title=${escapeProperty(`Pele ${describe(problem)}`)}`,
	].filter((property) => property !== null)
	return `::error ${properties.join(',')}::${escapeData(problem.message)}\n`
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? '' : 's'}`
}

function summary(outcome: Outcome): string {
	const invalid = outcome.problems.length
	return invalid === 0
		? `${plural(outcome.diagrams, 'diagram')} valid\n`
		: `${plural(invalid, 'invalid diagram')} of ${outcome.diagrams}\n`
}

/**
 * Prints the outcome of check or render in the chosen format.
 * Text and GitHub annotations go to stderr, so stdout keeps only the written
 * files (or the SVG); JSON is the whole of stdout.
 * @param format - Output format.
 * @param outcome - What was rendered and what failed.
 * @param alwaysSummarize - Print the summary line when every diagram is valid.
 */
function report(
	format: Format,
	outcome: Outcome,
	alwaysSummarize: boolean,
): void {
	if (format === 'json') {
		const {diagrams, problems, written} = outcome
		const json = {diagrams, errors: problems, invalid: problems.length, written}
		process.stdout.write(`${JSON.stringify(json, null, 2)}\n`)
		return
	}
	const toText = format === 'github' ? githubProblem : textProblem
	process.stderr.write(
		outcome.problems.map((problem) => toText(problem)).join(''),
	)
	if (outcome.written !== undefined) {
		process.stdout.write(outcome.written.map((file) => `${file}\n`).join(''))
	}
	if (alwaysSummarize || outcome.problems.length > 0) {
		process.stderr.write(summary(outcome))
	}
}

export type {Format, Problem}
export {parseFormat, report, toProblem}
