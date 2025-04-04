import { mock } from 'bun:test';

export function setupOtelMocks() {
  mock.module('@opentelemetry/api', () => ({
    createContextKey: (name: string) => ({ _name: name }),
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
      }),
    },
    SpanStatusCode: {
      OK: 'ok',
      ERROR: 'error',
    },
  }));
  
  mock.module('@opentelemetry/core', () => ({
    suppressTracing: () => ({}),
    unsuppressTracing: () => ({}),
    isTracingSuppressed: () => false,
  }));
  
  mock.module('@opentelemetry/sdk-node', () => ({
    NodeSDK: class MockNodeSDK {
      constructor() {}
      start() { return this; }
      shutdown() { return Promise.resolve(); }
    }
  }));
}
