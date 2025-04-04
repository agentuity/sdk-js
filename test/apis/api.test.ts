import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { send, GET, POST, PUT, DELETE } from "../../src/apis/api";

describe("API Client", () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockFetch: any;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AGENTUITY_API_KEY = "test-api-key";
    process.env.AGENTUITY_TRANSPORT_URL = "https://test.agentuity.ai/";
    
    const mockResponse = {
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      json: () => Promise.resolve({ success: true }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    };
    
    mockFetch = {
      mock: {
        calls: [] as any[][]
      },
      mockImplementation: function(impl: any) {
        this.implementation = impl;
        return this;
      },
      implementation: () => Promise.resolve(mockResponse),
      mockClear: function() {
        this.mock.calls = [];
      },
      toHaveBeenCalled: function() {
        return this.mock.calls.length > 0;
      },
      toHaveBeenCalledTimes: function(times: number) {
        return this.mock.calls.length === times;
      }
    };
    
    global.fetch = function(url: any, options: any) {
      mockFetch.mock.calls.push([url, options]);
      return mockFetch.implementation(url, options);
    } as any;
    
    mock.module("../../src/router/router", () => ({
      getSDKVersion: () => "1.0.0",
    }));
  });
  
  afterEach(() => {
    process.env = originalEnv;
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
      
      expect(mockFetch).toHaveBeenCalled();
      const [url, options] = mockFetch.mock.calls[0];
      
      expect(url.toString()).toEqual("https://test.agentuity.ai/test");
      expect(options.headers.Authorization).toEqual("Bearer test-api-key");
      expect(options.headers["User-Agent"]).toEqual("Agentuity JS SDK/1.0.0");
      expect(options.headers["Content-Type"]).toEqual("application/json");
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
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["X-Custom-Header"]).toEqual("custom-value");
    });
    
    it("should retry on 429 status", async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
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
      
      const result = await send({
        method: "GET",
        path: "/test",
        body: undefined as never
      });
      
      expect(mockFetch).toHaveBeenCalledTimes(2);
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
      await GET("/test");
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toEqual("GET");
    });
    
    it("should send POST request with body", async () => {
      const body = JSON.stringify({ test: "data" });
      await POST("/test", body);
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toEqual("POST");
      expect(options.body).toEqual(body);
    });
    
    it("should send PUT request with body", async () => {
      const body = JSON.stringify({ test: "data" });
      await PUT("/test", body);
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toEqual("PUT");
      expect(options.body).toEqual(body);
    });
    
    it("should send DELETE request", async () => {
      await DELETE("/test");
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toEqual("DELETE");
    });
    
    it("should send DELETE request with body", async () => {
      const body = JSON.stringify({ test: "data" });
      await DELETE("/test", body);
      
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toEqual("DELETE");
      expect(options.body).toEqual(body);
    });
  });
});
