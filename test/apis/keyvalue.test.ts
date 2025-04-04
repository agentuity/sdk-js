import { describe, expect, it, mock, beforeEach } from "bun:test";
import KeyValueAPI from "../../src/apis/keyvalue";
import * as router from "../../src/router/router";
import * as api from "../../src/apis/api";

describe("KeyValueAPI", () => {
  let keyValueAPI: KeyValueAPI;
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
    keyValueAPI = new KeyValueAPI();
    
    mock.module("../../src/router/router", () => ({
      getTracer: () => mockTracer,
      recordException: mock(() => {}),
    }));
  });

  describe("get", () => {
    it("should retrieve a value successfully", async () => {
      const mockResponse = {
        status: 200,
        response: {
          arrayBuffer: () => new ArrayBuffer(8),
          statusText: "OK",
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      const result = await keyValueAPI.get("test-store", "test-key");
      expect(result).not.toBeNull();
      expect(api.GET).toHaveBeenCalledWith(
        "/sdk/kv/test-store/test-key",
        true
      );
    });

    it("should return null when key is not found", async () => {
      const mockResponse = {
        status: 404,
        response: {
          statusText: "Not Found",
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      const result = await keyValueAPI.get("test-store", "not-found-key");
      expect(result).toBeNull();
    });

    it("should throw an error on failed request", async () => {
      const mockResponse = {
        status: 500,
        response: {
          statusText: "Internal Server Error",
          status: 500,
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      await expect(keyValueAPI.get("test-store", "test-key")).rejects.toThrow();
    });
  });
});
