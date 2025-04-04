import { describe, expect, it, mock, beforeEach } from "bun:test";
import VectorAPI from "../../src/apis/vector";
import * as router from "../../src/router/router";
import * as api from "../../src/apis/api";

describe("VectorAPI", () => {
  let vectorAPI: VectorAPI;
  const mockTracer = {
    startActiveSpan: mock((name, fn) => {
      return fn({
        setAttribute: mock(() => {}),
        addEvent: mock(() => {}),
        end: mock(() => {}),
      });
    }),
  };

  beforeEach(() => {
    mock.restore();
    vectorAPI = new VectorAPI();
    
    mock.module("../../src/router/router", () => ({
      getTracer: () => mockTracer,
      recordException: mock(() => {}),
    }));
  });

  describe("search", () => {
    it("should return search results successfully", async () => {
      const mockSearchResults = [{ id: "1", distance: 0.9 }];
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
