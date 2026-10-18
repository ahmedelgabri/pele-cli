/** A problem with the command line or input files, as opposed to an invalid diagram. */
class UsageError extends Error {
	public override readonly name = 'UsageError'
}

/**
 * Describes a caught value, which TypeScript types as `unknown`.
 * @param error - The caught value.
 * @returns Its message.
 */
function describeError(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

export {describeError, UsageError}
