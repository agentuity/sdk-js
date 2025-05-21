/**
 * Interface for logging functionality
 */
export interface Logger {
	/**
	 * Log a debug message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	debug(message: string | number, ...args: unknown[]): void;

	/**
	 * Log an info message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	info(message: string | number, ...args: unknown[]): void;

	/**
	 * Log a warning message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	warn(message: string | number, ...args: unknown[]): void;

	/**
	 * Log an error message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	error(message: string | number, ...args: unknown[]): void;

	/**
	 * Create a child logger with additional context
	 *
	 * @param opts - Additional context for the child logger
	 * @returns A new logger instance with the additional context
	 */
	child(opts: Record<string, unknown>): Logger;
}
