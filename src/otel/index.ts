import opentelemetry, {
	type Meter,
	metrics,
	propagation,
	type Tracer,
} from '@opentelemetry/api';
import * as LogsAPI from '@opentelemetry/api-logs';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import {
	CompositePropagator,
	W3CBaggagePropagator,
	W3CTraceContextPropagator,
} from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base';
import { Resource } from '@opentelemetry/resources';
import {
	BatchLogRecordProcessor,
	LoggerProvider,
	type LogRecordProcessor,
	SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
	MeterProvider,
	PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
	ATTR_SERVICE_NAME,
	ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import type { Logger } from '../logger';
import { ConsoleLogRecordExporter } from './console';
import { instrumentFetch } from './fetch';
import { createLogger, patchConsole } from './logger';
import { initialize } from '@traceloop/node-server-sdk';

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


export const createResource = (config: OtelConfig): Resource => {
	const {
		name,
		version,
		orgId,
		projectId,
		deploymentId,
		environment,
		devmode,
		sdkVersion,
		cliVersion,
	} = config;

	return new Resource({
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
};

export const createAgentuityLoggerProvider = ({
	url,
	headers,
	resource,
}: {
	url?: string,
	headers?: Record<string, string>,
	resource: Resource;
}) => {

	let processor: LogRecordProcessor | undefined;
	let exporter: OTLPLogExporter | undefined;

	if (url) {
		exporter = new OTLPLogExporter({
			url: `${url}/v1/logs`,
			headers,
			compression: CompressionAlgorithm.GZIP,
			timeoutMillis: 10_000,
		});
		processor = new BatchLogRecordProcessor(exporter);
	} else {
		processor = new SimpleLogRecordProcessor(
			new ConsoleLogRecordExporter()
		);
	}
	const provider = new LoggerProvider({
		resource,
	});
	provider.addLogRecordProcessor(processor);
	LogsAPI.logs.setGlobalLoggerProvider(provider);

	return {
		processor,
		provider,
		exporter,
	};
};

export const createUserLoggerProvider = ({
	url,
	headers,
	resource,
}: {
	url: string,
	headers?: Record<string, string>,
	resource: Resource;
}) => {
	let exporter = new OTLPLogExporter({
		url: `${url}/v1/logs`,
		headers,
		compression: CompressionAlgorithm.GZIP,
		timeoutMillis: 10_000,
	});
	const processor = new BatchLogRecordProcessor(exporter);
	const provider = new LoggerProvider({
		resource,
	});
	provider.addLogRecordProcessor(processor);
	return provider.getLogger('default');
};

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

	const resource = createResource(config);
	const loggerProvider = createAgentuityLoggerProvider({
		url,
		headers,
		resource,
	});
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
			logRecordProcessor: loggerProvider.processor,
			traceExporter,
			metricReader: sdkMetricReader,
			instrumentations: [getNodeAutoInstrumentations()],
			resource,
			textMapPropagator: propagator,
		});
		instrumentationSDK.start();
		hostMetrics?.start();

		try {
			const projectName = config.projectId || '';
			const orgName = config.orgId || '';
			const appName = `${orgName}:${projectName}`;

			const traceloopHeaders: Record<string, string> = {};
			if (bearerToken) {
				traceloopHeaders.Authorization = `Bearer ${bearerToken}`;
			}

			initialize({
				appName,
				baseUrl: url,
				headers: traceloopHeaders,
				disableBatch: devmode,
				tracingEnabled: false, // Disable traceloop's own tracing (equivalent to Python's telemetryEnabled: false)
				// Note: JavaScript SDK doesn't support resourceAttributes like Python
			});
			logger.debug(`Traceloop initialized with app_name: ${appName}`);
			logger.info('Traceloop configured successfully');
		} catch (error) {
			logger.warn('Traceloop not available, skipping automatic instrumentation', { error: error instanceof Error ? error.message : String(error) });
		}
		running = true;
	}

	const tracer = opentelemetry.trace.getTracer(name, version);
	const meter = metrics.getMeter(name, version);

	const shutdown = async () => {
		if (running) {
			running = false;
			logger.debug('shutting down OpenTelemetry');
			await loggerProvider.exporter
				?.forceFlush()
				.catch((e) =>
					logger.warn('error in forceFlush of otel exporter. %s', e)
				);
			await loggerProvider.exporter
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
