/**
 * Mock implementation for OpenTelemetry modules
 * This helps resolve version compatibility issues between local and CI environments
 */
import { mock } from 'bun:test';

export const createContextKey = (name: string) => ({
  _name: name,
});

export const mockOpenTelemetry = () => {
  mock.module('@opentelemetry/api', () => ({
    createContextKey,
    trace: {
      getTracer: () => ({})
    },
    propagation: {
      setGlobalPropagator: () => {}
    },
    SpanStatusCode: {
      OK: 'ok',
      ERROR: 'error'
    }
  }));

  mock.module('@opentelemetry/core', () => ({
    W3CTraceContextPropagator: class MockW3CTraceContextPropagator {},
    W3CBaggagePropagator: class MockW3CBaggagePropagator {},
    CompositePropagator: class MockCompositePropagator {},
    SUPPRESS_TRACING_KEY: { _name: 'OpenTelemetry SDK Context Key SUPPRESS_TRACING' }
  }));
};
