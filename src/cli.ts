#!/usr/bin/env node
import {OUTPUT_FLAGS, parseCommandLine, RENDER_FLAGS} from './args.ts'
import type {Flags} from './args.ts'
import {check, listTypes, renderCommand} from './commands.ts'
import {ExitCode} from './exit-code.ts'
import {assertFlags} from './flag-rules.ts'
import {UsageError} from './usage-error.ts'
import {USAGE, versions} from './usage.ts'

interface Command {
	readonly flags: readonly string[]
	readonly run: (
		files: readonly string[],
		flags: Flags,
	) => Promise<number> | number
	readonly takesFiles: boolean
}

const COMMANDS = new Map<string, Command>([
	['check', {flags: RENDER_FLAGS, run: check, takesFiles: true}],
	[
		'render',
		{
			flags: [...RENDER_FLAGS, ...OUTPUT_FLAGS],
			run: renderCommand,
			takesFiles: true,
		},
	],
	['types', {flags: [], run: listTypes, takesFiles: false}],
])

async function printVersion(): Promise<number> {
	process.stdout.write(`${await versions()}\n`)
	return ExitCode.ok
}

function printUsage(requested: boolean): number {
	process.stdout.write(`${USAGE}\n`)
	return requested ? ExitCode.ok : ExitCode.usage
}

function runCommand(
	command: string,
	files: readonly string[],
	flags: Flags,
): Promise<number> | number {
	const spec = COMMANDS.get(command)
	if (spec === undefined) {
		throw new UsageError(`unknown command "${command}"`)
	}
	if (!spec.takesFiles && files.length > 0) {
		throw new UsageError(`"${command}" does not take files`)
	}
	assertFlags(command, spec.flags, flags)
	return spec.run(files, flags)
}

async function main(args: readonly string[]): Promise<number> {
	const {positionals, values: flags} = parseCommandLine(args)
	const [command, ...files] = positionals
	if (flags.version === true) {
		return await printVersion()
	}
	if (flags.help === true || command === undefined) {
		return printUsage(flags.help === true)
	}
	return await runCommand(command, files, flags)
}

// Exit quietly when piped into a command that stops reading early, such as `head`.
process.stdout.on('error', (error: Readonly<NodeJS.ErrnoException>) => {
	if (error.code !== 'EPIPE') {
		throw new Error('Cannot write to stdout', {cause: error})
	}
	process.exit(ExitCode.ok)
})

// The first two entries are the Node binary and this script.
const USER_ARGS_START = 2

try {
	process.exitCode = await main(process.argv.slice(USER_ARGS_START))
} catch (error) {
	if (!(error instanceof UsageError)) {
		throw error
	}
	process.stderr.write(`pele: ${error.message}\nRun "pele --help" for usage.\n`)
	process.exitCode = ExitCode.usage
}
