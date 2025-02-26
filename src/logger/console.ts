import { format } from 'node:util';
import type { Logger } from './logger';
import type { Json } from '../types';
import { __originalConsole } from '../otel/logger';

const yellow = '\x1b[33m';
const green = '\x1b[32m';
const red = '\x1b[31m';
const black = '\x1b[30m';
const reset = '\x1b[0m';

export default class ConsoleLogger implements Logger {
	private context: Record<string, Json>;

	constructor(context: Record<string, Json> = {}) {
		this.context = context;
	}

	private formatMessage(message: string, args: unknown[]): string {
		const contextStr = this.context
			? Object.entries(this.context)
					.map(([key, value]) => `${key}=${value}`)
					.join(' ')
			: '';

		const m = format(message, ...args);
		return `${m}${contextStr ? ` [${contextStr}]` : ''}`;
	}

	debug(message: string, ...args: unknown[]): void {
		__originalConsole.debug(
			`${black}[DEBUG]${reset} ${this.formatMessage(message, args)}`
		);
	}

	info(message: string, ...args: unknown[]): void {
		__originalConsole.info(
			`${green}[INFO]${reset}  ${this.formatMessage(message, args)}`
		);
	}

	warn(message: string, ...args: unknown[]): void {
		__originalConsole.warn(
			`${yellow}[WARN]${reset}  ${this.formatMessage(message, args)}`
		);
	}

	error(message: string, ...args: unknown[]): void {
		__originalConsole.error(
			`${red}[ERROR]${reset} ${this.formatMessage(message, args)}`
		);
	}

	child(opts: Record<string, Json>): Logger {
		return new ConsoleLogger({
			...this.context,
			...opts,
		});
	}
}
