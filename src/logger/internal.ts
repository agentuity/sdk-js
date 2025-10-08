import type { Json } from '../types';

/**
 * Log levels for internal SDK logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Internal logger configuration
 */
interface InternalLoggerConfig {
	level: LogLevel;
	context?: Record<string, Json>;
}

/**
 * Simple internal logger that doesn't depend on other SDK modules
 * This logger is only for SDK internal diagnostics and debugging
 */
class InternalLogger {
	private config: InternalLoggerConfig;

	constructor() {
		this.config = this.loadConfig();
	}

	/**
	 * Load configuration from environment variables
	 */
	private loadConfig(): InternalLoggerConfig {
		const envLevel = process.env.AGENTUITY_SDK_LOG_LEVEL?.toLowerCase();

		// Validate log level
		const validLevels: LogLevel[] = [
			'debug',
			'info',
			'warn',
			'error',
			'silent',
		];
		const level = validLevels.includes(envLevel as LogLevel)
			? (envLevel as LogLevel)
			: 'silent';

		return {
			level,
			context: {
				'@agentuity/source': 'sdk-internal',
				'@agentuity/timestamp': new Date().toISOString(),
			},
		};
	}

	/**
	 * Check if a log level should be output based on current configuration
	 */
	private shouldLog(level: LogLevel): boolean {
		if (this.config.level === 'silent') return false;

		const levelPriority = {
			debug: 0,
			info: 1,
			warn: 2,
			error: 3,
			silent: 4,
		};

		return levelPriority[level] >= levelPriority[this.config.level];
	}

	/**
	 * Format a log message with context
	 */
	private formatMessage(message: unknown, ...args: unknown[]): string {
		const contextStr =
			this.config.context && Object.keys(this.config.context).length > 0
				? Object.entries(this.config.context)
						.map(
							([key, value]) =>
								`${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`
						)
						.join(' ')
				: '';

		const formattedMessage =
			typeof message === 'string' ? message : JSON.stringify(message);
		const argsStr =
			args.length > 0
				? ' ' +
					args
						.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
						.join(' ')
				: '';

		return `[INTERNAL] ${formattedMessage}${argsStr}${contextStr ? ` [${contextStr}]` : ''}`;
	}

	/**
	 * Log a debug message
	 */
	debug(message: unknown, ...args: unknown[]): void {
		if (this.shouldLog('debug')) {
			console.log(this.formatMessage(message, ...args));
		}
	}

	/**
	 * Log an info message
	 */
	info(message: unknown, ...args: unknown[]): void {
		if (this.shouldLog('info')) {
			console.log(this.formatMessage(message, ...args));
		}
	}

	/**
	 * Log a warning message
	 */
	warn(message: unknown, ...args: unknown[]): void {
		if (this.shouldLog('warn')) {
			console.log(this.formatMessage(message, ...args));
		}
	}

	/**
	 * Log an error message
	 */
	error(message: unknown, ...args: unknown[]): void {
		if (this.shouldLog('error')) {
			console.log(this.formatMessage(message, ...args));
		}
	}

	/**
	 * Update configuration at runtime
	 */
	updateConfig(config: Partial<InternalLoggerConfig>): void {
		this.config = { ...this.config, ...config };
	}

	/**
	 * Get current configuration
	 */
	getConfig(): InternalLoggerConfig {
		return { ...this.config };
	}

	/**
	 * Check if logging is enabled
	 */
	isEnabled(): boolean {
		return this.config.level !== 'silent';
	}

	/**
	 * Create a child logger with additional context
	 */
	child(context: Record<string, Json>): InternalLogger {
		const childLogger = new InternalLogger();
		childLogger.updateConfig({
			...this.config,
			context: {
				...this.config.context,
				...context,
			},
		});
		return childLogger;
	}
}

// Singleton instance - not exported
const internalLogger = new InternalLogger();

/**
 * Internal logger for SDK use only
 * This is NOT exported from the main SDK index
 */
export const internal = {
	debug: (message: unknown, ...args: unknown[]) =>
		internalLogger.debug(message, ...args),
	info: (message: unknown, ...args: unknown[]) =>
		internalLogger.info(message, ...args),
	warn: (message: unknown, ...args: unknown[]) =>
		internalLogger.warn(message, ...args),
	error: (message: unknown, ...args: unknown[]) =>
		internalLogger.error(message, ...args),

	// Utility methods
	updateConfig: (config: Partial<InternalLoggerConfig>) =>
		internalLogger.updateConfig(config),
	getConfig: () => internalLogger.getConfig(),
	isEnabled: () => internalLogger.isEnabled(),
	child: (context: Record<string, Json>) => internalLogger.child(context),
};
