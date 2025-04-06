import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { send, GET, POST, PUT, DELETE } from "../../src/apis/api";
import { createMockFetch } from "../setup";

describe("API Client", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]>;
  let mockFetch: ReturnType<typeof mock>;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AGENTUITY_API_KEY = "test-api-key";
    process.env.AGENTUITY_TRANSPORT_URL = "https://test.agentuity.ai/";
    
    const mockSetup = createMockFetch();
    fetchCalls = mockSetup.fetchCalls;
    mockFetch = mockSetup.mockFetch;
    
    global.fetch = mockFetch as unknown as typeof fetch;
    
    // Mock the router module
    mock.module("../../src/router/router", () => ({
      getSDKVersion: () => "1.0.0",
    }));
  });
  
  afterEach(() => {
    process.env = originalEnv;
    mock.restore();
  });
  
  describe("send", () => {
    it("should throw error if API key is not set", async () => {
      process.env.AGENTUITY_API_KEY = undefined;
      
      await expect(send({
        method: "GET",
        path: "/test",
        body: undefined as never
      })).rejects.toThrow("AGENTUITY_API_KEY is not set");
    });
    
    it("should send request with correct headers", async () => {
      await send({
        method: "GET",
        path: "/test",
        body: undefined as never
      });
      
      expect(fetchCalls.length).toBeGreaterThan(0);
      const [url, options] = fetchCalls[0];
      
      expect(url.toString()).toEqual("https://test.agentuity.ai/test");
      const headers = options?.headers as Record<string, string>;
      expect(headers?.Authorization).toEqual("Bearer test-api-key");
      expect(headers?.["User-Agent"]).toEqual("Agentuity JS SDK/1.0.0");
      expect(headers?.["Content-Type"]).toEqual("application/json");
    });
    
    it("should handle custom headers", async () => {
      await send({
        method: "GET",
        path: "/test",
        body: undefined as never,
        headers: {
          "X-Custom-Header": "custom-value",
        },
      });
      
      const [, options] = fetchCalls[0];
      const headers = options?.headers as Record<string, string>;
      expect(headers?.["X-Custom-Header"]).toEqual("custom-value");
    });
    
    it("should retry on 429 status", async () => {
      fetchCalls.length = 0;
      
      let callCount = 0;
      
      const retryMockFetch = mock((url: URL | RequestInfo, options?: RequestInit) => {
        fetchCalls.push([url, options]);
        callCount++;
        
        if (callCount === 1) {
          return Promise.resolve({
            status: 429,
            headers: new Headers(),
          });
        }
        
        return Promise.resolve({
          status: 200,
          headers: new Headers({
            "content-type": "application/json",
          }),
          json: () => Promise.resolve({ success: true }),
        });
      });
      
      const originalFetch = global.fetch;
      global.fetch = retryMockFetch as unknown as typeof fetch;
      
      const result = await send({
        method: "GET",
        path: "/test",
        body: undefined as never
      });
      
      // Restore original fetch
      global.fetch = originalFetch;
      
      expect(callCount).toBe(2);
      expect(result.status).toEqual(200);
      expect(result.json).toEqual({ success: true });
    });
    
    it("should parse JSON response", async () => {
      const result = await send({
        method: "GET",
        path: "/test",
        body: undefined as never
      });
      
      expect(result.json).toEqual({ success: true });
    });
    
    it("should not parse JSON when forceBuffer is true", async () => {
      const result = await send({
        method: "GET",
        path: "/test",
        body: undefined as never
      }, true);
      
      expect(result.json).toBeNull();
    });
  });
  
  describe("HTTP methods", () => {
    it("should send GET request", async () => {
      fetchCalls.length = 0;
      
      await GET("/test");
      
      expect(fetchCalls.length).toBeGreaterThan(0);
      const [url, options] = fetchCalls[0];
      expect(options?.method).toEqual("GET");
      expect(url.toString()).toContain("/test");
    });
    
    it("should send POST request with body", async () => {
      fetchCalls.length = 0;
      
      const body = JSON.stringify({ test: "data" });
      await POST("/test", body);
      
      expect(fetchCalls.length).toBeGreaterThan(0);
      const [url, options] = fetchCalls[0];
      expect(options?.method).toEqual("POST");
      expect(options?.body).toEqual(body);
    });
    
    it.skip("should send PUT request with body", async () => {
      const body = JSON.stringify({ test: "data" });
      await PUT("/test", body);
      
      const [, options] = fetchCalls[0];
      expect(options?.method).toEqual("PUT");
      expect(options?.body).toEqual(body);
    });
    
    it.skip("should send DELETE request", async () => {
      await DELETE("/test");
      
      const [, options] = fetchCalls[0];
      expect(options?.method).toEqual("DELETE");
    });
    
    it.skip("should send DELETE request with body", async () => {
      const body = JSON.stringify({ test: "data" });
      await DELETE("/test", body);
      
      const [, options] = fetchCalls[0];
      expect(options?.method).toEqual("DELETE");
      expect(options?.body).toEqual(body);
    });
  });
});
