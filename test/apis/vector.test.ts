import { describe, expect, it, mock, beforeEach } from "bun:test";
import VectorAPI from "../../src/apis/vector";
import * as api from "../../src/apis/api";
import { context } from "@opentelemetry/api";

describe("VectorAPI", () => {
  let vectorAPI: VectorAPI;
  const mockTracer = {
    startSpan: mock((name, options, ctx) => {
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
        setSpan: (ctx, span) => ctx,
      },
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
      const mockSearchResults = [{ id: "1", key: "key1", distance: 0.9 }];
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

      const searchParams = { query: "test query" };
      const results = await vectorAPI.search("test-store", searchParams);
      
      expect(results).toEqual(mockSearchResults);
      expect(api.POST).toHaveBeenCalledWith(
        "/sdk/vector/search/test-store",
        JSON.stringify(searchParams)
      );
    });

    it("should return empty array when no results found", async () => {
      const mockResponse = {
        status: 404,
      };
      
      mock.module("../../src/apis/api", () => ({
        POST: mock(() => Promise.resolve(mockResponse)),
      }));

      const searchParams = { query: "not found query" };
      const results = await vectorAPI.search("test-store", searchParams);
      
      expect(results).toEqual([]);
    });
  });
});
