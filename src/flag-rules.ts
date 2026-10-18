import type {Flags} from './args.ts'
import {UsageError} from './usage-error.ts'

type FlagName = keyof Flags

interface SwitchedOff {
	/** Given as `--no-<off>`. */
	readonly off: FlagName
	readonly setting: FlagName
}

interface Requirement {
	readonly flag: FlagName
	readonly requires: FlagName
}

// https://pele.run/api#renderoptions: these settings only apply while the
// other option is on, so giving both means one of them is a mistake.
const SWITCHED_OFF: readonly SwitchedOff[] = [
	{off: 'links', setting: 'link-schemes'},
	{off: 'links', setting: 'link-rel'},
	{off: 'images', setting: 'image-schemes'},
	{off: 'auto-direction', setting: 'direction-breakpoint'},
]

// Pele only rearranges a layout to fit `maxWidth`, so without it these do nothing.
const REQUIREMENTS: readonly Requirement[] = [
	{flag: 'auto-direction', requires: 'max-width'},
	{flag: 'direction-breakpoint', requires: 'max-width'},
]

function spelling(name: string, value: unknown): string {
	return value === false ? `--no-${name}` : `--${name}`
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
	for (const [name, value] of Object.entries(flags)) {
		if (value !== undefined && !accepted.includes(name)) {
			throw new UsageError(`"${command}" does not use ${spelling(name, value)}`)
		}
	}
	for (const {off, setting} of SWITCHED_OFF) {
		if (flags[off] === false && flags[setting] !== undefined) {
			throw new UsageError(
				`--no-${off} and --${setting} cannot be used together`,
			)
		}
	}
	for (const {flag, requires} of REQUIREMENTS) {
		if (flags[flag] !== undefined && flags[requires] === undefined) {
			throw new UsageError(
				`${spelling(flag, flags[flag])} requires --${requires}`,
			)
		}
	}
}

export {assertFlags}
