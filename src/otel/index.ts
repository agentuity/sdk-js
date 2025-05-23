import type { Logger } from '../logger';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
	PeriodicExportingMetricReader,
	MeterProvider,
} from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import opentelemetry, {
	metrics,
	propagation,
	type Meter,
	type Tracer,
} from '@opentelemetry/api';
import {
	W3CTraceContextPropagator,
	W3CBaggagePropagator,
	CompositePropagator,
} from '@opentelemetry/core';
import * as LogsAPI from '@opentelemetry/api-logs';
import {
	LoggerProvider,
	type LogRecordProcessor,
	BatchLogRecordProcessor,
	SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { createLogger, patchConsole } from './logger';
import { ConsoleLogRecordExporter } from './console';
import { instrumentFetch } from './fetch';

/**
 * Configuration for OpenTelemetry initialization
 */
interface OtelConfig {
	url?: string;
	name: string;
	version: string;
	bearerToken?: string;
	orgId?: string;
	projectId?: string;
	deploymentId?: string;
	environment?: string;
	sdkVersion?: string;
	cliVersion?: string;
	devmode?: boolean;
}

/**
 * Response from OpenTelemetry initialization
 */
interface OtelResponse {
	tracer: Tracer;
	meter: Meter;
	logger: Logger;
	shutdown: () => Promise<void>;
}

const devmodeExportInterval = 1_000; // 1 second
const productionExportInterval = 10_000; // 10 seconds

/**
 * Registers and initializes OpenTelemetry with the specified configuration
 *
 * @param config - The configuration for OpenTelemetry
 * @returns An object containing the tracer, logger, and shutdown function
 */
export function registerOtel(config: OtelConfig): OtelResponse {
	const {
		url,
		name,
		version,
		bearerToken,
		environment = 'development',
		sdkVersion,
		cliVersion,
		orgId,
		projectId,
		deploymentId,
		devmode = false,
	} = config;

	let headers: Record<string, string> | undefined;

	if (bearerToken) {
		headers = {};
		headers.Authorization = `Bearer ${bearerToken}`;
	}

	const resource = new Resource({
		[ATTR_SERVICE_NAME]: name,
		[ATTR_SERVICE_VERSION]: version,
		'@agentuity/orgId': orgId ?? 'unknown',
		'@agentuity/projectId': projectId ?? 'unknown',
		'@agentuity/deploymentId': deploymentId ?? 'unknown',
		'@agentuity/env': environment,
		'@agentuity/devmode': devmode,
		'@agentuity/sdkVersion': sdkVersion ?? 'unknown',
		'@agentuity/cliVersion': cliVersion ?? 'unknown',
	});

	let otlpLogExporter: OTLPLogExporter | undefined;
	let logRecordProcessor: LogRecordProcessor | undefined;

	if (url) {
		otlpLogExporter = new OTLPLogExporter({
			url: `${url}/v1/logs`,
			headers,
			compression: CompressionAlgorithm.GZIP,
			timeoutMillis: 10_000,
		});
		logRecordProcessor = new BatchLogRecordProcessor(otlpLogExporter);
	} else {
		logRecordProcessor = new SimpleLogRecordProcessor(
			new ConsoleLogRecordExporter()
		);
	}

	const loggerProvider = new LoggerProvider({
		resource,
	});
	loggerProvider.addLogRecordProcessor(logRecordProcessor);
	LogsAPI.logs.setGlobalLoggerProvider(loggerProvider);

	const logger = createLogger(!!url);

	// must do this after we have created the logger
	patchConsole(!!url, {
		'@agentuity/orgId': orgId ?? 'unknown',
		'@agentuity/projectId': projectId ?? 'unknown',
		'@agentuity/deploymentId': deploymentId ?? 'unknown',
		'@agentuity/env': environment,
		'@agentuity/devmode': devmode,
		'@agentuity/language': 'javascript',
	});

	const traceExporter = url
		? new OTLPTraceExporter({
				url: `${url}/v1/traces`,
				headers,
				keepAlive: true,
			})
		: undefined;

	const metricExporter = url
		? new OTLPMetricExporter({
				url: `${url}/v1/metrics`,
				headers,
				keepAlive: true,
			})
		: undefined;

	// Create a separate metric reader for the NodeSDK
	const sdkMetricReader =
		url && metricExporter
			? new PeriodicExportingMetricReader({
					exporter: metricExporter,
					exportTimeoutMillis: devmode
						? devmodeExportInterval
						: productionExportInterval,
					exportIntervalMillis: devmode
						? devmodeExportInterval
						: productionExportInterval,
				})
			: undefined;

	// Create a separate metric reader for the MeterProvider
	const hostMetricReader =
		url && metricExporter
			? new PeriodicExportingMetricReader({
					exporter: metricExporter,
					exportTimeoutMillis: devmode
						? devmodeExportInterval
						: productionExportInterval,
					exportIntervalMillis: devmode
						? devmodeExportInterval
						: productionExportInterval,
				})
			: undefined;

	const meterProvider = hostMetricReader
		? new MeterProvider({
				resource,
				readers: [hostMetricReader],
			})
		: undefined;

	if (meterProvider) {
		metrics.setGlobalMeterProvider(meterProvider);
	}

	const hostMetrics = meterProvider
		? new HostMetrics({ meterProvider })
		: undefined;

	let running = false;
	let instrumentationSDK: NodeSDK | undefined;

	if (url) {
		const propagator = new CompositePropagator({
			propagators: [
				new W3CTraceContextPropagator(),
				new W3CBaggagePropagator(),
			],
		});
		propagation.setGlobalPropagator(propagator);

		instrumentFetch();
		instrumentationSDK = new NodeSDK({
			logRecordProcessor,
			traceExporter,
			metricReader: sdkMetricReader,
			instrumentations: [getNodeAutoInstrumentations()],
			resource,
			textMapPropagator: propagator,
		});
		instrumentationSDK.start();
		hostMetrics?.start();
		running = true;
	}

	const tracer = opentelemetry.trace.getTracer(name, version);
	const meter = metrics.getMeter(name, version);

	const shutdown = async () => {
		if (running) {
			running = false;
			logger.debug('shutting down OpenTelemetry');
			await otlpLogExporter
				?.forceFlush()
				.catch((e) =>
					logger.warn('error in forceFlush of otel exporter. %s', e)
				);
			await otlpLogExporter
				?.shutdown()
				.catch(
					(e) =>
						!devmode && logger.warn('error in shutdown of otel exporter. %s', e)
				);
			await instrumentationSDK
				?.shutdown()
				.catch(
					(e) =>
						!devmode &&
						logger.warn('error in shutdown of otel instrumentation. %s', e)
				);
			logger.debug('shut down OpenTelemetry');
		}
	};

	if (url) {
		logger.debug('connected to Agentuity Agent Cloud');
	}

	return { tracer, meter, logger, shutdown };
}
