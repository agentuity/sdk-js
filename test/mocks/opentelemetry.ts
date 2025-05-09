/**
 * Mock implementation for OpenTelemetry modules
 * This helps resolve version compatibility issues between local and CI environments
 */
import { mock } from 'bun:test';

export const createContextKey = (name: string) => ({
	_name: name,
});

export const SUPPRESS_TRACING_KEY = createContextKey(
	'OpenTelemetry SDK Context Key SUPPRESS_TRACING'
);

export const mockOpenTelemetry = () => {
	mock.module('@opentelemetry/api', () => ({
		createContextKey,
		diag: {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
			verbose: () => {},
		},
		context: {
			active: () => ({}),
			bind: (context: unknown, target: unknown) => target,
			with: (context: unknown, fn: unknown) =>
				typeof fn === 'function' ? fn() : undefined,
		},
		trace: {
			getTracer: () => ({
				startSpan: () => ({
					end: () => {},
					setAttribute: () => {},
					setStatus: () => {},
					recordException: () => {},
				}),
				startActiveSpan: (_name: string, _options: unknown, fn: unknown) => {
					if (typeof fn === 'function') {
						return fn({
							end: () => {},
							setAttribute: () => {},
							setStatus: () => {},
							recordException: () => {},
						});
					}
					return {
						end: () => {},
						setAttribute: () => {},
						setStatus: () => {},
						recordException: () => {},
					};
				},
			}),
			setSpan: () => ({}),
			getSpan: () => ({
				spanContext: () => ({
					traceId: '1234567890abcdef1234567890abcdef',
					spanId: '1234567890abcdef',
					traceFlags: 1,
				}),
			}),
		},
		propagation: {
			setGlobalPropagator: () => {},
			inject: () => {},
			extract: () => ({}),
		},
		SpanStatusCode: {
			OK: 'ok',
			ERROR: 'error',
		},
		SpanKind: {
			INTERNAL: 'internal',
			SERVER: 'server',
			CLIENT: 'client',
			PRODUCER: 'producer',
			CONSUMER: 'consumer',
		},
	}));

	mock.module('@opentelemetry/core', () => ({
		W3CTraceContextPropagator: class MockW3CTraceContextPropagator {
			inject() {}
			extract() {
				return {};
			}
		},
		W3CBaggagePropagator: class MockW3CBaggagePropagator {
			inject() {}
			extract() {
				return {};
			}
		},
		CompositePropagator: class MockCompositePropagator {
			inject() {}
			extract() {
				return {};
			}
		},
		suppressTracing: () => ({}),
		unsuppressTracing: () => ({}),
		isTracingSuppressed: () => false,
		SUPPRESS_TRACING_KEY,
		createContextKey,
	}));

	mock.module('@opentelemetry/sdk-node', () => ({
		NodeSDK: class MockNodeSDK {
			start() {
				return this;
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/resources', () => ({
		Resource: class MockResource {
			static default() {
				return new MockResource();
			}
			merge() {
				return this;
			}
		},
		SEMRESATTRS_SERVICE_NAME: 'service.name',
	}));

	mock.module('@opentelemetry/sdk-metrics', () => ({
		MeterProvider: class MockMeterProvider {
			addMetricReader() {
				return this;
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/exporter-trace-otlp-http', () => ({
		OTLPTraceExporter: class MockOTLPTraceExporter {
			export() {
				return Promise.resolve({ code: 0 });
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/exporter-metrics-otlp-http', () => ({
		OTLPMetricExporter: class MockOTLPMetricExporter {
			export() {
				return Promise.resolve({ code: 0 });
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/exporter-logs-otlp-http', () => ({
		OTLPLogExporter: class MockOTLPLogExporter {
			export() {
				return Promise.resolve({ code: 0 });
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/sdk-logs', () => ({
		LoggerProvider: class MockLoggerProvider {
			addLogRecordProcessor() {
				return this;
			}
			shutdown() {
				return Promise.resolve();
			}
		},
		SimpleLogRecordProcessor: class MockSimpleLogRecordProcessor {
			forceFlush() {
				return Promise.resolve();
			}
			shutdown() {
				return Promise.resolve();
			}
		},
	}));

	mock.module('@opentelemetry/api-logs', () => ({
		logs: {
			getLogger: () => ({
				emit: () => {},
			}),
		},
		SeverityNumber: {
			INFO: 9,
			ERROR: 17,
			DEBUG: 5,
			WARN: 13,
		},
	}));
};
