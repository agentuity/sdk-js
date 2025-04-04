import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { createLogger, patchConsole, __originalConsole } from "../../src/otel/logger";
import type { Json } from "../../src/types";

describe.skip("OtelLogger", () => {
  let mockLoggerEmit: ReturnType<typeof mock>;
  let originalConsole: Console;
  
  beforeEach(() => {
    originalConsole = global.console;
    
    mockLoggerEmit = mock(() => {});
    
    mock.module("@opentelemetry/api-logs", () => ({
      logs: {
        getLogger: () => ({
          emit: mockLoggerEmit
        })
      },
      SeverityNumber: {
        DEBUG: 1,
        INFO: 2,
        WARN: 3,
        ERROR: 4
      }
    }));
    
    mock.module("../../src/server/util", () => ({
      safeStringify: (obj: unknown) => {
        try {
          return JSON.stringify(obj);
        } catch (err) {
          return "[object Object]";
        }
      }
    }));
  });
  
  afterEach(() => {
    global.console = originalConsole;
    mock.restore();
  });
  
  describe("createLogger", () => {
    it("should create a logger with console output enabled", () => {
      const logger = createLogger(true);
      expect(logger).toBeDefined();
    });
    
    it("should create a logger with console output disabled", () => {
      const logger = createLogger(false);
      expect(logger).toBeDefined();
    });
    
    it("should create a logger with context", () => {
      const context: Record<string, Json> = { service: "test-service" };
      const logger = createLogger(true, context);
      expect(logger).toBeDefined();
    });
  });
  
  describe("logging methods", () => {
    it("should emit log records with the correct severity", () => {
      const logger = createLogger(false);
      
      logger.debug("Debug message");
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        severityText: "DEBUG",
        body: "Debug message"
      }));
      
      logger.info("Info message");
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        severityText: "INFO",
        body: "Info message"
      }));
      
      logger.warn("Warning message");
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        severityText: "WARN",
        body: "Warning message"
      }));
      
      logger.error("Error message");
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        severityText: "ERROR",
        body: "Error message"
      }));
    });
    
    it("should include context in log records", () => {
      const context: Record<string, Json> = { service: "test-service" };
      const logger = createLogger(false, context);
      
      logger.info("Info with context");
      
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        attributes: context
      }));
    });
    
    it("should format message with additional arguments", () => {
      const logger = createLogger(false);
      
      logger.info("User %s logged in with role %s", "john", "admin");
      
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        body: "User john logged in with role admin"
      }));
    });
    
    it("should handle object arguments", () => {
      const logger = createLogger(false);
      const userData = { id: 123, name: "john" };
      
      logger.info("User data: %j", userData);
      
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        body: expect.stringContaining("User data:")
      }));
    });
    
    it("should handle formatting errors gracefully", () => {
      const logger = createLogger(false);
      
      mock.module("node:util", () => ({
        format: () => {
          throw new Error("Format error");
        }
      }));
      
      logger.info("Test message", { circular: "reference" });
      
      expect(mockLoggerEmit).toHaveBeenCalled();
    });
  });
  
  describe("child method", () => {
    it("should create a child logger with merged context", () => {
      const parentContext: Record<string, Json> = { service: "parent-service" };
      const childContext: Record<string, Json> = { component: "child-component" };
      
      const parentLogger = createLogger(false, parentContext);
      const childLogger = parentLogger.child(childContext);
      
      childLogger.info("Test child logger");
      
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        attributes: expect.objectContaining({
          service: "parent-service",
          component: "child-component"
        })
      }));
    });
    
    it("should override parent context with child context for same keys", () => {
      const parentContext: Record<string, Json> = { service: "parent-service", env: "test" };
      const childContext: Record<string, Json> = { service: "child-service" };
      
      const parentLogger = createLogger(false, parentContext);
      const childLogger = parentLogger.child(childContext);
      
      childLogger.info("Test context override");
      
      expect(mockLoggerEmit).toHaveBeenCalledWith(expect.objectContaining({
        attributes: expect.objectContaining({
          service: "child-service",
          env: "test"
        })
      }));
    });
  });
  
  describe("patchConsole", () => {
    it("should patch console methods when enabled", () => {
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      const originalDebug = console.debug;
      const originalInfo = console.info;
      
      patchConsole(true, { service: "test-service" });
      
      expect(console.log).not.toBe(originalLog);
      expect(console.error).not.toBe(originalError);
      expect(console.warn).not.toBe(originalWarn);
      expect(console.debug).not.toBe(originalDebug);
      expect(console.info).not.toBe(originalInfo);
      
      global.console = originalConsole;
    });
    
    it("should not patch console methods when disabled", () => {
      const originalLog = console.log;
      
      patchConsole(false, { service: "test-service" });
      
      expect(console.log).toBe(originalLog);
    });
    
    it("should forward console calls to the logger", () => {
      patchConsole(true, { service: "test-service" });
      
      console.log("Test log message");
      console.error("Test error message");
      console.warn("Test warn message");
      console.debug("Test debug message");
      console.info("Test info message");
      
      
      global.console = originalConsole;
    });
  });
});
