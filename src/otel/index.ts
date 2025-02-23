import type { Logger } from "../logger";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-grpc";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-grpc";
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import opentelemetry, { type Tracer } from "@opentelemetry/api";
import * as LogsAPI from "@opentelemetry/api-logs";
import {
	LoggerProvider,
	SimpleLogRecordProcessor,
	type LogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-grpc";
import { createLogger } from "./logger";
import { ConsoleLogRecordExporter } from "./console";

interface OtelConfig {
	url?: string;
	name: string;
	version: string;
}

interface OtelResponse {
	tracer: Tracer;
	logger: Logger;
	shutdown: () => Promise<void>;
}

export function registerOtel(config: OtelConfig): OtelResponse {
	const {
		url = process.env.AGENTUITY_OTLP_URL ||
			process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
		name,
		version,
	} = config;

	const headers: Record<string, string> = {};

	let otlpLogExporter: OTLPLogExporter | undefined;
	let logRecordProcessor: SimpleLogRecordProcessor | undefined;

	if (url) {
		otlpLogExporter = new OTLPLogExporter({ url: `${url}/v1/logs`, headers });
		logRecordProcessor = new SimpleLogRecordProcessor(otlpLogExporter);
	} else {
		logRecordProcessor = new SimpleLogRecordProcessor(
			new ConsoleLogRecordExporter(),
		);
	}

	const loggerProvider = new LoggerProvider();
	loggerProvider.addLogRecordProcessor(logRecordProcessor);
	LogsAPI.logs.setGlobalLoggerProvider(loggerProvider);

	const logger = createLogger(!!url);

	const instrumentationSDK = new NodeSDK({
		logRecordProcessor,
		traceExporter: url
			? new OTLPTraceExporter({
					url: `${url}/v1/traces`,
					headers,
				})
			: undefined,
		metricReader: url
			? new PeriodicExportingMetricReader({
					exporter: new OTLPMetricExporter({
						url: `${url}/v1/metrics`,
						headers,
					}),
				})
			: undefined,
		instrumentations: [getNodeAutoInstrumentations()],
		resource: new Resource({
			[ATTR_SERVICE_NAME]: name,
			[ATTR_SERVICE_VERSION]: version,
		}),
	});

	let running = false;

	if (url) {
		instrumentationSDK.start();
		running = true;
	}

	const tracer = opentelemetry.trace.getTracer(name, version);

	const shutdown = async () => {
		if (running) {
			running = false;
			logger.debug("shutting down OpenTelemetry");
			await instrumentationSDK.shutdown();
			await otlpLogExporter?.shutdown();
			logger.debug("shut down OpenTelemetry");
		}
	};

	return { tracer, logger, shutdown };
}
