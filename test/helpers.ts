import {spawnSync} from 'node:child_process'
import {mkdirSync, mkdtempSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

interface Result {
	readonly code: number | null
	readonly stderr: string
	readonly stdout: string
}

interface RunOptions {
	readonly cwd: string
	readonly env?: Readonly<Record<string, string>>
	readonly input?: string
}

type Runner = (args: readonly string[], options: RunOptions) => Result

const VIEWBOX_SIZE = /viewBox="0 0 (?<width>[\d.]+) (?<height>[\d.]+)"/u

const WIDE_FLOWCHART =
	'flowchart LR\n  A[First step] --> B[Second step] --> C[Third step] --> D[Fourth step]\n'

/**
 * Creates a function that runs the CLI and captures its output.
 * @param command - Executable to spawn.
 * @param prefix - Arguments that come before the CLI arguments, such as a script path.
 * @returns A runner for CLI arguments.
 */
function cliRunner(command: string, prefix: readonly string[] = []): Runner {
	return (args, options) => {
		const result = spawnSync(command, [...prefix, ...args], {
			...options,
			encoding: 'utf8',
			// CI sets GITHUB_ACTIONS=true, which switches the default --format to
			// annotations; tests opt in through `env` instead.
			env: {...process.env, GITHUB_ACTIONS: '', ...options.env},
		})
		return {code: result.status, stderr: result.stderr, stdout: result.stdout}
	}
}

// Runs the CLI from source through Node's type stripping.
const peleFromSource = cliRunner(process.execPath, [
	fileURLToPath(new URL('../src/cli.ts', import.meta.url)),
])

function viewBoxSize(svg: string): {height: number; width: number} {
	const groups = VIEWBOX_SIZE.exec(svg)?.groups
	return {height: Number(groups?.['height']), width: Number(groups?.['width'])}
}

/**
 * Creates a temporary directory with the given files.
 * @param files - File contents by relative path; parent directories are created.
 * @returns The directory path.
 */
function workspace(files: Readonly<Record<string, string>>): string {
	const dir = mkdtempSync(path.join(tmpdir(), 'pele-cli-'))
	for (const [name, content] of Object.entries(files)) {
		const file = path.join(dir, name)
		mkdirSync(path.dirname(file), {recursive: true})
		writeFileSync(file, content)
	}
	return dir
}

export {cliRunner, peleFromSource, viewBoxSize, WIDE_FLOWCHART, workspace}
