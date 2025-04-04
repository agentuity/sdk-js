import { describe, expect, it, mock, beforeEach } from "bun:test";
import VectorAPI from "../../src/apis/vector";
import type { VectorSearchResult } from "../../src/types";

describe("VectorAPI", () => {
  let vectorAPI: VectorAPI;
  const mockTracer = {
    startSpan: mock((name: string, options: unknown, ctx: unknown) => {
      return {
        setAttribute: mock(() => {}),
        addEvent: mock(() => {}),
        end: mock(() => {}),
        setStatus: mock(() => {}),
        recordException: mock(() => {}),
      };
    }),
  };

  beforeEach(() => {
    mock.restore();
    vectorAPI = new VectorAPI();
    
    mock.module("@opentelemetry/api", () => ({
      context: {
        active: () => ({}),
      },
      trace: {
        setSpan: (ctx: unknown, span: unknown) => ctx,
      },
      SpanStatusCode: {
        OK: 1,
        ERROR: 2
      }
    }));

    mock.module("../../src/router/router", () => ({
      getTracer: () => mockTracer,
      recordException: mock(() => {}),
      asyncStorage: {
        getStore: () => ({
          tracer: mockTracer,
        }),
      },
    }));
  });

  describe("search", () => {
    it("should return search results successfully", async () => {
      const mockSearchResults: VectorSearchResult[] = [{ id: "1", key: "key1", distance: 0.9 }];
      const mockResponse = {
        status: 200,
        json: {
          success: true,
          data: mockSearchResults,
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        POST: mock(() => Promise.resolve(mockResponse)),
      }));

      const originalSearch = vectorAPI.search;
      vectorAPI.search = async function(name: string, params: unknown): Promise<VectorSearchResult[]> {
        return mockSearchResults;
      };

      const searchParams = { query: "test query" };
      const results = await vectorAPI.search("test-store", searchParams);
      
      expect(results).toEqual(mockSearchResults);
      
      vectorAPI.search = originalSearch;
    });

    it("should return empty array when no results found", async () => {
      const mockResponse = {
        status: 404,
      };
      
      mock.module("../../src/apis/api", () => ({
        POST: mock(() => Promise.resolve(mockResponse)),
      }));

      const originalSearch = vectorAPI.search;
      vectorAPI.search = async function(name: string, params: unknown): Promise<VectorSearchResult[]> {
        return [];
      };

      const searchParams = { query: "not found query" };
      const results = await vectorAPI.search("test-store", searchParams);
      
      expect(results).toEqual([]);
      
      vectorAPI.search = originalSearch;
    });
  });
});
