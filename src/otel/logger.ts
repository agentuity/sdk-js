import { format } from 'node:util';
import * as LogsAPI from '@opentelemetry/api-logs';
import type { Logger } from '../logger';
import type { Json } from '../types';
import ConsoleLogger from '../logger/console';

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

	debug(message: string, ...args: unknown[]) {
		this.logger?.debug(message, ...args);
		const body = format(message, ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.DEBUG,
			severityText: 'DEBUG',
			body,
			attributes: this.context,
		});
	}
	info(message: string, ...args: unknown[]) {
		this.logger?.info(message, ...args);
		const body = format(message, ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.INFO,
			severityText: 'INFO',
			body,
			attributes: this.context,
		});
	}
	warn(message: string, ...args: unknown[]) {
		this.logger?.warn(message, ...args);
		const body = format(message, ...args);
		this.delegate.emit({
			severityNumber: LogsAPI.SeverityNumber.WARN,
			severityText: 'WARN',
			body,
			attributes: this.context,
		});
	}
	error(message: string, ...args: unknown[]) {
		this.logger?.error(message, ...args);
		const body = format(message, ...args);
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

export function createLogger(useConsole: boolean): Logger {
	const delegate = LogsAPI.logs.getLogger('default');
	return new OtelLogger(useConsole, delegate);
}
