import { format } from 'node:util';
import * as LogsAPI from '@opentelemetry/api-logs';
import type { Logger } from '../logger';
import type { Json } from '../types';
import ConsoleLogger from '../logger/console';

/**
 * Reference to the original console object before patching
 */
export const __originalConsole = Object.create(console); // save the original console before we patch it

class OtelLogger implements Logger {
	private readonly delegate: LogsAPI.Logger;
	private readonly context: Record<string, Json> | undefined;
	private readonly logger: ConsoleLogger | undefined;

	constructor(
		useConsole: boolean,
		delegate: LogsAPI.Logger,
		context?: Record<string, Json> | undefined
	) {
		this.delegate = delegate;
		this.context = context;
		this.logger = useConsole ? new ConsoleLogger() : undefined;
	}

	private formatMessage(message: unknown) {
		if (typeof message === 'string') {
			return message;
		}
		return JSON.stringify(message);
	}

	debug(message: string, ...args: unknown[]) {
		this.logger?.debug(message, ...args);
		const body = format(this.formatMessage(message), ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.DEBUG,
			severityText: 'DEBUG',
			body,
			attributes: this.context,
		});
	}
	info(message: string, ...args: unknown[]) {
		this.logger?.info(message, ...args);
		const body = format(this.formatMessage(message), ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.INFO,
			severityText: 'INFO',
			body,
			attributes: this.context,
		});
	}
	warn(message: string, ...args: unknown[]) {
		this.logger?.warn(message, ...args);
		const body = format(this.formatMessage(message), ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.WARN,
			severityText: 'WARN',
			body,
			attributes: this.context,
		});
	}
	error(message: string, ...args: unknown[]) {
		this.logger?.error(message, ...args);
		const body = format(this.formatMessage(message), ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.ERROR,
			severityText: 'ERROR',
			body,
			attributes: this.context,
		});
	}
	child(opts: Record<string, Json>) {
		return new OtelLogger(!!this.logger, this.delegate, {
			...(this.context ?? {}),
			opts,
		});
	}
}

/**
 * Creates a logger that integrates with OpenTelemetry
 *
 * @param useConsole - Whether to also log to the console
 * @param context - Additional context to include with log records
 * @returns A logger instance
 */
export function createLogger(
	useConsole: boolean,
	context?: Record<string, Json>
): Logger {
	const delegate = LogsAPI.logs.getLogger('default');
	return new OtelLogger(useConsole, delegate, context);
}

/**
 * Patches the global console object to integrate with OpenTelemetry logging
 *
 * @param attributes - Attributes to include with all console log records
 */
export function patchConsole(attributes: Record<string, Json>) {
	const delegate = createLogger(true, attributes);

	// Patch individual console methods instead of reassigning the whole object
	console.log = (...args: unknown[]) => {
		delegate.info(args[0] as string, ...args.slice(1));
	};
	console.error = (...args: unknown[]) => {
		delegate.error(args[0] as string, ...args.slice(1));
	};
	console.warn = (...args: unknown[]) => {
		delegate.warn(args[0] as string, ...args.slice(1));
	};
	console.debug = (...args: unknown[]) => {
		delegate.debug(args[0] as string, ...args.slice(1));
	};
	console.info = (...args: unknown[]) => {
		delegate.info(args[0] as string, ...args.slice(1));
	};
}
