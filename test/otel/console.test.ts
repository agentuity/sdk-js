import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { ConsoleLogRecordExporter } from '../../src/otel/console';
import { ExportResultCode } from '@opentelemetry/core';
import { SeverityNumber } from '@opentelemetry/api-logs';
import type { ReadableLogRecord } from '@opentelemetry/sdk-logs';

describe.skip('ConsoleLogRecordExporter', () => {
	let mockConsoleLogger: {
		debug: ReturnType<typeof mock>;
		info: ReturnType<typeof mock>;
		warn: ReturnType<typeof mock>;
		error: ReturnType<typeof mock>;
	};

	beforeEach(() => {
		mock.restore();

		mockConsoleLogger = {
			debug: mock(() => {}),
			info: mock(() => {}),
			warn: mock(() => {}),
			error: mock(() => {}),
		};

		mock.module('../../src/logger/console', () => ({
			default: class MockConsoleLogger {
				debug = mockConsoleLogger.debug;
				info = mockConsoleLogger.info;
				warn = mockConsoleLogger.warn;
				error = mockConsoleLogger.error;
				child() {
					return this;
				}
			},
		}));
	});

	describe('export', () => {
		it('should export debug log records to console', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: SeverityNumber.DEBUG,
					body: 'Debug message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.debug).toHaveBeenCalledWith('Debug message');
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});

		it('should export info log records to console', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: SeverityNumber.INFO,
					body: 'Info message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.info).toHaveBeenCalledWith('Info message');
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});

		it('should export warn log records to console', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: SeverityNumber.WARN,
					body: 'Warning message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.warn).toHaveBeenCalledWith('Warning message');
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});

		it('should export error log records to console', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: SeverityNumber.ERROR,
					body: 'Error message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.error).toHaveBeenCalledWith('Error message');
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});

		it('should default to info for unknown severity levels', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: 999, // Unknown severity
					body: 'Unknown severity message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.info).toHaveBeenCalledWith(
				'Unknown severity message'
			);
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});

		it('should handle multiple log records', () => {
			const exporter = new ConsoleLogRecordExporter();
			const mockCallback = mock(() => {});

			const logs = [
				{
					severityNumber: SeverityNumber.DEBUG,
					body: 'Debug message',
				},
				{
					severityNumber: SeverityNumber.INFO,
					body: 'Info message',
				},
				{
					severityNumber: SeverityNumber.WARN,
					body: 'Warning message',
				},
				{
					severityNumber: SeverityNumber.ERROR,
					body: 'Error message',
				},
			];

			exporter.export(logs as ReadableLogRecord[], mockCallback);

			expect(mockConsoleLogger.debug).toHaveBeenCalledWith('Debug message');
			expect(mockConsoleLogger.info).toHaveBeenCalledWith('Info message');
			expect(mockConsoleLogger.warn).toHaveBeenCalledWith('Warning message');
			expect(mockConsoleLogger.error).toHaveBeenCalledWith('Error message');
			expect(mockCallback).toHaveBeenCalledWith({
				code: ExportResultCode.SUCCESS,
			});
		});
	});

	describe('shutdown', () => {
		it('should resolve immediately', async () => {
			const exporter = new ConsoleLogRecordExporter();

			const result = await exporter.shutdown();

			expect(result).toBeUndefined();
		});
	});
});
