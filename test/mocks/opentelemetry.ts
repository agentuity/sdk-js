/**
 * Mock implementation for OpenTelemetry modules
 * This helps resolve version compatibility issues between local and CI environments
 */
import { mock } from 'bun:test';

export const createContextKey = (name: string) => ({
  _name: name,
});

export const SUPPRESS_TRACING_KEY = createContextKey('OpenTelemetry SDK Context Key SUPPRESS_TRACING');

export const mockOpenTelemetry = () => {
  mock.module('@opentelemetry/api', () => ({
    createContextKey,
    context: {
      active: () => ({}),
      bind: (context: any, target: any) => target,
      with: (context: any, fn: any) => fn(),
    },
    trace: {
      getTracer: () => ({
        startSpan: () => ({
          end: () => {},
          setAttribute: () => {},
          setStatus: () => {},
          recordException: () => {},
        }),
        startActiveSpan: (_name: string, options: any, fn: any) => fn({
          end: () => {},
          setAttribute: () => {},
          setStatus: () => {},
          recordException: () => {},
        }),
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
      extract() { return {}; }
    },
    W3CBaggagePropagator: class MockW3CBaggagePropagator {
      inject() {}
      extract() { return {}; }
    },
    CompositePropagator: class MockCompositePropagator {
      constructor() {}
      inject() {}
      extract() { return {}; }
    },
    suppressTracing: () => ({}),
    unsuppressTracing: () => ({}),
    isTracingSuppressed: () => false,
    SUPPRESS_TRACING_KEY,
  }));
};
