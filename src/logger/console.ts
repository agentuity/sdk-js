import { format } from 'node:util';
import type { Logger } from './logger';
import type { Json } from '../types';
import { __originalConsole } from '../otel/logger';

const yellow = '\x1b[33m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const black = '\x1b[30m';
const reset = '\x1b[0m';

/**
 * Console implementation of the Logger interface
 */
export default class ConsoleLogger implements Logger {
	private context: Record<string, Json>;

	/**
	 * Creates a new console logger
	 *
	 * @param context - Initial context for the logger
	 */
	constructor(context: Record<string, Json> = {}) {
		this.context = context;
	}

	/**
	 * Formats a log message with context
	 *
	 * @param message - The message to format
	 * @param args - Additional arguments for formatting
	 * @returns The formatted message with context
	 * @private
	 */
	private formatMessage(message: string, args: unknown[]): string {
		const contextStr = this.context
			? Object.entries(this.context)
					.map(([key, value]) => `${key}=${value}`)
					.join(' ')
			: '';

		// Use a safe way to format the message without causing recursion
		let formattedMessage = message;
		if (args.length > 0) {
			try {
				// Use the util.format directly to avoid potential recursion
				formattedMessage = format(message, ...args);
			} catch (err) {
				// If formatting fails, fall back to a simple string representation
				formattedMessage = `${message} ${args.map((arg) => String(arg)).join(' ')}`;
			}
		}

		return `${formattedMessage}${contextStr ? ` [${contextStr}]` : ''}`;
	}

	/**
	 * Log a debug message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	debug(message: string, ...args: unknown[]): void {
		__originalConsole.debug(
			`${black}[DEBUG]${reset} ${this.formatMessage(message, args)}`
		);
	}

	/**
	 * Log an info message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	info(message: string, ...args: unknown[]): void {
		__originalConsole.info(
			`${green}[INFO]${reset}  ${this.formatMessage(message, args)}`
		);
	}

	/**
	 * Log a warning message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	warn(message: string, ...args: unknown[]): void {
		__originalConsole.warn(
			`${yellow}[WARN]${reset}  ${this.formatMessage(message, args)}`
		);
	}

	/**
	 * Log an error message
	 *
	 * @param message - The message to log
	 * @param args - Additional arguments to log
	 */
	error(message: string, ...args: unknown[]): void {
		__originalConsole.error(
			`${red}[ERROR]${reset} ${this.formatMessage(message, args)}`
		);
	}

	/**
	 * Create a child logger with additional context
	 *
	 * @param opts - Additional context for the child logger
	 * @returns A new logger instance with the additional context
	 */
	child(opts: Record<string, Json>): Logger {
		return new ConsoleLogger({
			...this.context,
			...opts,
		});
	}
}
