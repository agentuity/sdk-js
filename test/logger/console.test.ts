import { describe, expect, it, mock, beforeEach, afterEach } from 'bun:test';
import ConsoleLogger from '../../src/logger/console';
import type { Json } from '../../src/types';
import '../setup'; // Import global test setup

describe('ConsoleLogger', () => {
	let originalConsole: Console;
	let mockConsole: {
		debug: ReturnType<typeof mock>;
		info: ReturnType<typeof mock>;
		warn: ReturnType<typeof mock>;
		error: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		originalConsole = global.console;

		mockConsole = {
			debug: mock(() => {}),
			info: mock(() => {}),
			warn: mock(() => {}),
			error: mock(() => {}),
		};

		mock.module('../../src/otel/logger', () => ({
			__originalConsole: mockConsole,
		}));

		mock.module('../../src/server/util', () => ({
			safeStringify: (obj: unknown) => {
				try {
					return JSON.stringify(obj);
				} catch (err) {
					return '[object Object]';
				}
			},
		}));
	});

	afterEach(() => {
		global.console = originalConsole;
		mock.restore();
	});

	describe('constructor', () => {
		it('should initialize with empty context', () => {
			const logger = new ConsoleLogger();
			expect(logger).toBeDefined();
		});

		it('should initialize with provided context', () => {
			const context: Record<string, Json> = {
				service: 'test-service',
				env: 'test',
			};
			const logger = new ConsoleLogger(context);
			expect(logger).toBeDefined();
		});
	});

	describe('logging methods', () => {
		it('should log debug messages with context', () => {
			const context: Record<string, Json> = { service: 'test-service' };
			const logger = new ConsoleLogger(context);

			logger.debug('Test debug message');

			expect(mockConsole.debug).toHaveBeenCalled();
			const message = mockConsole.debug.mock.calls[0][0];
			expect(message).toContain('[DEBUG]');
			expect(message).toContain('Test debug message');
			expect(message).toContain('[service=test-service]');
		});

		it('should log info messages with context', () => {
			const context: Record<string, Json> = { service: 'test-service' };
			const logger = new ConsoleLogger(context);

			logger.info('Test info message');

			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('[INFO]');
			expect(message).toContain('Test info message');
			expect(message).toContain('[service=test-service]');
		});

		it('should log warn messages with context', () => {
			const context: Record<string, Json> = { service: 'test-service' };
			const logger = new ConsoleLogger(context);

			logger.warn('Test warn message');

			expect(mockConsole.warn).toHaveBeenCalled();
			const message = mockConsole.warn.mock.calls[0][0];
			expect(message).toContain('[WARN]');
			expect(message).toContain('Test warn message');
			expect(message).toContain('[service=test-service]');
		});

		it('should log error messages with context', () => {
			const context: Record<string, Json> = { service: 'test-service' };
			const logger = new ConsoleLogger(context);

			logger.error('Test error message');

			expect(mockConsole.error).toHaveBeenCalled();
			const message = mockConsole.error.mock.calls[0][0];
			expect(message).toContain('[ERROR]');
			expect(message).toContain('Test error message');
			expect(message).toContain('[service=test-service]');
		});

		it('should format message with additional arguments', () => {
			const logger = new ConsoleLogger();

			logger.info('User %s logged in with role %s', 'john', 'admin');

			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('User john logged in with role admin');
		});

		it('should handle object arguments', () => {
			const logger = new ConsoleLogger();
			const userData = { id: 123, name: 'john' };

			logger.info('User data: %o', userData);

			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('User data:');
			// Don't test exact format as it may vary between environments
		});

		it('should handle formatting errors gracefully', () => {
			const logger = new ConsoleLogger();

			const originalFormatMessage = logger[
				'formatMessage' as keyof typeof logger
			] as () => string;
			(logger['formatMessage' as keyof typeof logger] as unknown) = () => {
				throw new Error('Test formatting error');
			};

			logger.info('Test message');

			logger['formatMessage'] = originalFormatMessage;

			expect(mockConsole.info).toHaveBeenCalled();
			expect(mockConsole.error).toHaveBeenCalled();
		});

		it('should handle number as first argument', () => {
			const logger = new ConsoleLogger();
			
			logger.info(123);
			
			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('123');
		});
	});

	describe('child method', () => {
		it('should create a child logger with merged context', () => {
			const parentContext: Record<string, Json> = { service: 'parent-service' };
			const childContext: Record<string, Json> = {
				component: 'child-component',
			};

			const parentLogger = new ConsoleLogger(parentContext);
			const childLogger = parentLogger.child(childContext);

			childLogger.info('Test child logger');

			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('[service=parent-service');
			expect(message).toContain('component=child-component');
		});

		it('should override parent context with child context for same keys', () => {
			const parentContext: Record<string, Json> = {
				service: 'parent-service',
				env: 'test',
			};
			const childContext: Record<string, Json> = { service: 'child-service' };

			const parentLogger = new ConsoleLogger(parentContext);
			const childLogger = parentLogger.child(childContext);

			childLogger.info('Test context override');

			expect(mockConsole.info).toHaveBeenCalled();
			const message = mockConsole.info.mock.calls[0][0];
			expect(message).toContain('service=child-service');
			expect(message).toContain('env=test');
		});
	});
});
