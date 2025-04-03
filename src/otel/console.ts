import { ExportResultCode, type ExportResult } from '@opentelemetry/core';
import type {
	LogRecordExporter,
	ReadableLogRecord,
} from '@opentelemetry/sdk-logs';
import ConsoleLogger from '../logger/console';
import { SeverityNumber } from '@opentelemetry/api-logs';

/**
 * Console implementation of the LogRecordExporter interface
 */
export class ConsoleLogRecordExporter implements LogRecordExporter {
	private readonly logger: ConsoleLogger;

	/**
	 * Creates a new console log record exporter
	 */
	constructor() {
		this.logger = new ConsoleLogger();
	}

	/**
	 * Exports log records to the console
	 *
	 * @param logs - The log records to export
	 * @param resultCallback - Callback function to report the export result
	 */
	export(
		logs: ReadableLogRecord[],
		resultCallback: (result: ExportResult) => void
	): void {
		for (const log of logs) {
			switch (log.severityNumber) {
				case SeverityNumber.DEBUG:
					this.logger.debug(log.body as string);
					break;
				case SeverityNumber.INFO:
					this.logger.info(log.body as string);
					break;
				case SeverityNumber.WARN:
					this.logger.warn(log.body as string);
					break;
				case SeverityNumber.ERROR:
					this.logger.error(log.body as string);
					break;
				default:
					this.logger.info(log.body as string);
					break;
			}
		}
		resultCallback({ code: ExportResultCode.SUCCESS });
	}

	/**
	 * Shuts down the exporter
	 *
	 * @returns A promise that resolves when shutdown is complete
	 */
	shutdown(): Promise<void> {
		return Promise.resolve();
	}
}
