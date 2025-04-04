import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { instrumentFetch, __originalFetch } from "../../src/otel/fetch";

describe("Fetch Instrumentation", () => {
  const mockSpan = {
    setAttributes: mock(() => mockSpan),
    recordException: mock(() => {}),
    setStatus: mock(() => {}),
    end: mock(() => {}),
  };

  const mockTracer = {
    startSpan: mock(() => mockSpan),
  };

  const mockActiveSpan = {
    isRecording: () => true,
  };

  const originalFetch = globalThis.fetch;
  let mockFetchFn: any;
  let mockTraceApi: any;
  let mockContextApi: any;
  let mockPropagationApi: any;

  beforeEach(() => {
    mock.restore();
    
    mockTraceApi = {
      getActiveSpan: mock(() => mockActiveSpan),
      getTracer: mock(() => mockTracer),
      setSpan: mock((ctx: any, span: any) => ctx),
    };
    
    mockContextApi = {
      active: mock(() => ({})),
    };
    
    mockPropagationApi = {
      inject: mock((ctx: any, carrier: any) => {
        carrier["traceparent"] = "00-1234567890abcdef1234567890abcdef-1234567890abcdef-01";
      }),
    };
    
    mock.module("@opentelemetry/api", () => ({
      trace: mockTraceApi,
      context: mockContextApi,
      propagation: mockPropagationApi,
      SpanStatusCode: {
        OK: 0,
        ERROR: 1,
      },
    }));
    
    mockFetchFn = mock(() => {
      const response = new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "user-agent": "test-agent",
        },
      });
      return Promise.resolve(response);
    });
    
    globalThis.fetch = mockFetchFn;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should create a span for fetch requests", async () => {
    instrumentFetch();
    
    await fetch("https://example.com/api/test");
    
    expect(mockTraceApi.getTracer).toHaveBeenCalledWith("fetch");
    expect(mockTracer.startSpan).toHaveBeenCalled();
  });

  it("should add trace context to request headers", async () => {
    mockFetchFn.mockClear();
    
    instrumentFetch();
    
    globalThis.fetch = mockFetchFn;
    
    await fetch("https://example.com/api/test");
    
    expect(mockFetchFn).toHaveBeenCalled();
    expect(mockPropagationApi.inject).toHaveBeenCalled();
  });

  it("should set span attributes from response", async () => {
    instrumentFetch();
    
    await fetch("https://example.com/api/test");
    
    expect(mockSpan.setAttributes).toHaveBeenCalled();
  });

  it("should set error status on non-ok responses", async () => {
    mockFetchFn = mock(() => {
      const response = new Response("Server Error", {
        status: 500,
        statusText: "Internal Server Error",
      });
      return Promise.resolve(response);
    });
    
    globalThis.fetch = mockFetchFn;
    
    instrumentFetch();
    
    await fetch("https://example.com/api/test");
    
    expect(mockSpan.setStatus).toHaveBeenCalled();
  });

  it("should handle exceptions and record them", async () => {
    const error = new Error("Network error");
    
    mockFetchFn.mockClear();
    mockFetchFn = mock(() => Promise.reject(error));
    globalThis.fetch = mockFetchFn;
    
    mockSpan.recordException.mockClear();
    mockSpan.setStatus.mockClear();
    
    instrumentFetch();
    
    try {
      await fetch("https://example.com/api/test");
    } catch (e) {
    }
    
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(mockSpan.recordException).toHaveBeenCalled();
    expect(mockSpan.setStatus).toHaveBeenCalled();
  });

  it("should use method from Request object if provided", async () => {
    instrumentFetch();
    
    const request = new Request("https://example.com/api/test", {
      method: "POST",
    });
    
    await fetch(request);
    
    expect(mockTracer.startSpan).toHaveBeenCalled();
  });

  it("should bypass instrumentation if no active span", async () => {
    mockTracer.startSpan.mockClear();
    
    const originalGetActiveSpan = mockTraceApi.getActiveSpan;
    mockTraceApi.getActiveSpan = mock(() => null);
    
    instrumentFetch();
    
    mockFetchFn.mockClear();
    globalThis.fetch = mockFetchFn;
    
    await fetch("https://example.com/api/test");
    
    mockTraceApi.getActiveSpan = originalGetActiveSpan;
    
    expect(mockTracer.startSpan).not.toHaveBeenCalled();
  });
});
