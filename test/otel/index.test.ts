import { describe, expect, it, mock, beforeEach } from "bun:test";
import { registerOtel } from "../../src/otel/index";

describe("OpenTelemetry Registration", () => {
  beforeEach(() => {
    mock.restore();
    
    mock.module("@opentelemetry/sdk-node", () => ({
      NodeSDK: class MockNodeSDK {
        start() {}
        shutdown() { return Promise.resolve(); }
      }
    }));
    
    mock.module("@opentelemetry/host-metrics", () => ({
      HostMetrics: class MockHostMetrics {
        start() {}
      }
    }));
    
    mock.module("@opentelemetry/auto-instrumentations-node", () => ({
      getNodeAutoInstrumentations: () => []
    }));
    
    mock.module("@opentelemetry/sdk-metrics", () => ({
      PeriodicExportingMetricReader: class MockPeriodicExportingMetricReader {},
      MeterProvider: class MockMeterProvider {}
    }));
    
    mock.module("@opentelemetry/resources", () => ({
      Resource: class MockResource {}
    }));
    
    mock.module("@opentelemetry/exporter-trace-otlp-http", () => ({
      OTLPTraceExporter: class MockOTLPTraceExporter {
        forceFlush() { return Promise.resolve(); }
        shutdown() { return Promise.resolve(); }
      }
    }));
    
    mock.module("@opentelemetry/exporter-metrics-otlp-http", () => ({
      OTLPMetricExporter: class MockOTLPMetricExporter {}
    }));
    
    mock.module("@opentelemetry/semantic-conventions", () => ({
      ATTR_SERVICE_NAME: "service.name",
      ATTR_SERVICE_VERSION: "service.version"
    }));
    
    mock.module("@opentelemetry/api", () => ({
      default: {
        trace: {
          getTracer: () => ({})
        }
      },
      propagation: {
        setGlobalPropagator: () => {}
      }
    }));
    
    mock.module("@opentelemetry/core", () => ({
      W3CTraceContextPropagator: class MockW3CTraceContextPropagator {},
      W3CBaggagePropagator: class MockW3CBaggagePropagator {},
      CompositePropagator: class MockCompositePropagator {}
    }));
    
    mock.module("@opentelemetry/api-logs", () => ({
      logs: {
        setGlobalLoggerProvider: () => {},
        getLogger: () => ({
          emit: () => {}
        })
      },
      SeverityNumber: {
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
      }
    }));
    
    mock.module("@opentelemetry/sdk-logs", () => ({
      LoggerProvider: class MockLoggerProvider {
        addLogRecordProcessor() {}
      },
      BatchLogRecordProcessor: class MockBatchLogRecordProcessor {},
      SimpleLogRecordProcessor: class MockSimpleLogRecordProcessor {}
    }));
    
    mock.module("@opentelemetry/exporter-logs-otlp-http", () => ({
      OTLPLogExporter: class MockOTLPLogExporter {
        forceFlush() { return Promise.resolve(); }
        shutdown() { return Promise.resolve(); }
      }
    }));
    
    mock.module("@opentelemetry/otlp-exporter-base", () => ({
      CompressionAlgorithm: {
        GZIP: "gzip"
      }
    }));
    
    mock.module("../../src/otel/logger", () => ({
      createLogger: () => ({
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {}
      }),
      patchConsole: () => {}
    }));
    
    mock.module("../../src/otel/console", () => ({
      ConsoleLogRecordExporter: class MockConsoleLogRecordExporter {}
    }));
    
    mock.module("../../src/otel/fetch", () => ({
      instrumentFetch: () => {}
    }));
    
    mock.module("../../src/otel/trace", () => ({
      default: class MockAgentuityIdPropagator {}
    }));
  });
  
  describe("registerOtel", () => {
    it("should return tracer, logger, and shutdown function", () => {
      const result = registerOtel({
        name: "test-service",
        version: "1.0.0"
      });
      
      expect(result).toBeDefined();
      expect(result.tracer).toBeDefined();
      expect(result.logger).toBeDefined();
      expect(result.shutdown).toBeDefined();
      expect(typeof result.shutdown).toBe("function");
    });
    
    it("should initialize with minimal configuration", () => {
      const result = registerOtel({
        name: "test-service",
        version: "1.0.0"
      });
      
      expect(result).toBeDefined();
    });
    
    it("should initialize with full configuration", () => {
      const mockConfig = {
        url: "https://example.com",
        name: "test-service",
        version: "1.0.0",
        bearerToken: process.env.TEST_TOKEN,
        orgId: "org-id",
        projectId: "project-id",
        deploymentId: "deployment-id",
        environment: "test",
        sdkVersion: "1.0.0",
        cliVersion: "1.0.0",
        devmode: true
      };
      
      const result = registerOtel(mockConfig);
      expect(result).toBeDefined();
    });
    
    it("should handle shutdown correctly", async () => {
      const result = registerOtel({
        name: "test-service",
        version: "1.0.0"
      });
      
      expect(result.shutdown).toBeDefined();
      
      await result.shutdown();
    });
  });
});
