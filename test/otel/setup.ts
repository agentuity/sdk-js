import { mock } from 'bun:test';
import { mockOpenTelemetry } from '../mocks/opentelemetry';

export function setupOtelMocks() {
  if (process.env.SKIP_OTEL_TESTS === 'true') {
    mock.module('@opentelemetry/api', () => ({}));
    mock.module('@opentelemetry/core', () => ({}));
    mock.module('@opentelemetry/sdk-node', () => ({}));
    mock.module('@opentelemetry/resources', () => ({}));
    mock.module('@opentelemetry/sdk-metrics', () => ({}));
    mock.module('@opentelemetry/exporter-trace-otlp-http', () => ({}));
    mock.module('@opentelemetry/exporter-metrics-otlp-http', () => ({}));
    mock.module('@opentelemetry/exporter-logs-otlp-http', () => ({}));
    mock.module('@opentelemetry/sdk-logs', () => ({}));
    mock.module('@opentelemetry/api-logs', () => ({}));
    return;
  }
  
  mockOpenTelemetry();
}
