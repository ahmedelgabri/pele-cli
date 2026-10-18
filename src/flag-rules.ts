import type {Flags} from './args.ts'
import {UsageError} from './usage-error.ts'

type FlagPair = readonly [string, string]

const RENDER_FLAGS: readonly string[] = [
	'auto-direction',
	'direction-breakpoint',
	'font-family',
	'font-family-mono',
	'font-size',
	'image-schemes',
	'images',
	'limit',
	'link-rel',
	'link-schemes',
	'links',
	'max-edges',
	'max-width',
	'now',
	'output-limit',
	'padding',
	'responsive',
]

const OUTPUT_FLAGS: readonly string[] = ['css', 'out-dir', 'theme']

// https://pele.run/api#renderoptions: these settings only apply while the
// other option is on, so giving both means one of them is a mistake.
const CONFLICTS: readonly FlagPair[] = [
	['--no-links', '--link-schemes'],
	['--no-links', '--link-rel'],
	['--no-images', '--image-schemes'],
	['--no-auto-direction', '--direction-breakpoint'],
]

// Pele only rearranges a layout to fit `maxWidth`, so without it these do nothing.
const REQUIREMENTS: readonly FlagPair[] = [
	['--auto-direction', '--max-width'],
	['--no-auto-direction', '--max-width'],
	['--direction-breakpoint', '--max-width'],
]

function spelling(name: string, value: unknown): string {
	return value === false ? `--no-${name}` : `--${name}`
}

function givenFlags(flags: Flags): Map<string, string> {
	return new Map(
		Object.entries(flags)
			.filter(([, value]) => value !== undefined)
			.map(([name, value]) => [name, spelling(name, value)]),
	)
}

/**
 * Rejects flags the command ignores and combinations Pele would ignore.
 * @param command - The command name, for the error message.
 * @param accepted - Names of the flags the command uses.
 * @param flags - The parsed flags.
 */
function assertFlags(
	command: string,
	accepted: readonly string[],
	flags: Flags,
): void {
	const given = givenFlags(flags)
	for (const [name, flag] of given) {
		if (!accepted.includes(name)) {
			throw new UsageError(`"${command}" does not use ${flag}`)
		}
	}
	const spelled = new Set(given.values())
	for (const [first, second] of CONFLICTS) {
		if (spelled.has(first) && spelled.has(second)) {
			throw new UsageError(`${first} and ${second} cannot be used together`)
		}
	}
	for (const [flag, required] of REQUIREMENTS) {
		if (spelled.has(flag) && !spelled.has(required)) {
			throw new UsageError(`${flag} requires ${required}`)
		}
	}
}

export {assertFlags, OUTPUT_FLAGS, RENDER_FLAGS}
