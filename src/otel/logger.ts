import { format } from 'node:util';
import * as LogsAPI from '@opentelemetry/api-logs';
import type { Logger } from '../logger';
import type { Json } from '../types';
import ConsoleLogger from '../logger/console';
import { safeStringify } from '../server/util';
import { getAgentDetail } from '../router/router';

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
		try {
			return safeStringify(message);
		} catch (err) {
			// Handle circular references or other JSON stringification errors
			return String(message);
		}
	}

	private getAttributes(): Record<string, Json> | undefined {
		const attrs = getAgentDetail();
		if (!attrs) {
			return this.context;
		}
		const result: Record<string, Json> = {
			...(this.context ?? {}),
		};
		for (const [key, value] of Object.entries(attrs)) {
			if (value !== null && value !== undefined) {
				result[`@agentuity/${key}`] = value as Json;
			}
		}
		return result;
	}

	debug(message: string, ...args: unknown[]) {
		this.logger?.debug(message, ...args);
		let body: string;
		try {
			body = format(this.formatMessage(message), ...args);
		} catch (err) {
			// Fallback if format causes recursion
			body = `${this.formatMessage(message)} ${args.map((arg) => String(arg)).join(' ')}`;
		}
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.DEBUG,
			severityText: 'DEBUG',
			body,
			attributes: this.getAttributes(),
		});
	}
	info(message: string, ...args: unknown[]) {
		this.logger?.info(message, ...args);
		let body: string;
		try {
			body = format(this.formatMessage(message), ...args);
		} catch (err) {
			// Fallback if format causes recursion
			body = `${this.formatMessage(message)} ${args.map((arg) => String(arg)).join(' ')}`;
		}
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.INFO,
			severityText: 'INFO',
			body,
			attributes: this.getAttributes(),
		});
	}
	warn(message: string, ...args: unknown[]) {
		this.logger?.warn(message, ...args);
		let body: string;
		try {
			body = format(this.formatMessage(message), ...args);
		} catch (err) {
			// Fallback if format causes recursion
			body = `${this.formatMessage(message)} ${args.map((arg) => String(arg)).join(' ')}`;
		}
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.WARN,
			severityText: 'WARN',
			body,
			attributes: this.getAttributes(),
		});
	}
	error(message: string, ...args: unknown[]) {
		this.logger?.error(message, ...args);
		let body: string;
		try {
			body = format(this.formatMessage(message), ...args);
		} catch (err) {
			// Fallback if format causes recursion
			body = `${this.formatMessage(message)} ${args.map((arg) => String(arg)).join(' ')}`;
		}
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.ERROR,
			severityText: 'ERROR',
			body,
			attributes: this.getAttributes(),
		});
	}
	child(opts: Record<string, Json>) {
		return new OtelLogger(!!this.logger, this.delegate, {
			...(this.context ?? {}),
			...opts,
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
export function patchConsole(
	enabled: boolean,
	attributes: Record<string, Json>
) {
	if (!enabled) {
		return;
	}
	const _patch = { ...__originalConsole };
	const delegate = createLogger(true, attributes);

	// Patch individual console methods instead of reassigning the whole object
	_patch.log = (...args: unknown[]) => {
		delegate.info(args[0] as string, ...args.slice(1));
	};
	_patch.error = (...args: unknown[]) => {
		delegate.error(args[0] as string, ...args.slice(1));
	};
	_patch.warn = (...args: unknown[]) => {
		delegate.warn(args[0] as string, ...args.slice(1));
	};
	_patch.debug = (...args: unknown[]) => {
		delegate.debug(args[0] as string, ...args.slice(1));
	};
	_patch.info = (...args: unknown[]) => {
		delegate.info(args[0] as string, ...args.slice(1));
	};
	_patch.dir = (...args: unknown[]) => {
		let msg = '';
		if (args.length === 1) {
			msg = format(args[0]);
		} else if (args.length > 2) {
			msg = format(args[0], args[1]);
		} else {
			msg = safeStringify(args);
		}
		delegate.debug(msg);
	};
	_patch.dirxml = (...args: unknown[]) => {
		delegate.debug('dirxml:', ...args);
	};
	_patch.table = (...args: unknown[]) => {
		delegate.debug('table:', ...args);
	};
	_patch.trace = (...args: unknown[]) => {
		delegate.debug(args[0] as string, ...args.slice(1));
	};
	_patch.group = (...args: unknown[]) => {
		delegate.debug('group:', ...args);
	};
	_patch.groupCollapsed = (...args: unknown[]) => {
		delegate.debug('groupCollapsed:', ...args);
	};
	_patch.groupEnd = () => {
		delegate.debug('groupEnd');
	};
	_patch.clear = () => {
		/* no-op */
	};
	_patch.count = (...args: unknown[]) => {
		delegate.debug('count:', ...args);
	};
	_patch.countReset = (...args: unknown[]) => {
		delegate.debug('countReset:', ...args);
	};
	_patch.assert = (condition?: boolean, ...args: unknown[]) => {
		if (!condition) {
			delegate.error('assertion failed:', ...args);
		}
	};
	_patch.time = (...args: unknown[]) => {
		delegate.debug('time:', ...args);
	};
	_patch.timeLog = (...args: unknown[]) => {
		delegate.debug('timeLog:', ...args);
	};
	_patch.timeEnd = (...args: unknown[]) => {
		delegate.debug('timeEnd:', ...args);
	};
	_patch.profile = (...args: unknown[]) => {
		delegate.debug('profile:', ...args);
	};
	_patch.profileEnd = (...args: unknown[]) => {
		delegate.debug('profileEnd:', ...args);
	};

	// biome-ignore lint/suspicious/noGlobalAssign: <explanation>
	console = globalThis.console = _patch;
}
