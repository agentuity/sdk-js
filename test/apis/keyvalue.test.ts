import { describe, expect, it, mock, beforeEach } from "bun:test";
import KeyValueAPI from "../../src/apis/keyvalue";
import * as api from "../../src/apis/api";
import { context } from "@opentelemetry/api";

describe("KeyValueAPI", () => {
  let keyValueAPI: KeyValueAPI;
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
    keyValueAPI = new KeyValueAPI();
    
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

  describe("get", () => {
    it("should retrieve a value successfully", async () => {
      const mockData = {
        contentType: "application/json",
        base64: Buffer.from(JSON.stringify({ test: "data" })).toString("base64"),
        text: JSON.stringify({ test: "data" }),
        json: { test: "data" },
        object: () => ({ test: "data" }),
        binary: new Uint8Array(),
        buffer: Buffer.from(""),
        stream: {} as any,
      };

      const mockResponse = {
        status: 200,
        json: {
          success: true,
          data: {
            contentType: "application/json",
            base64: Buffer.from(JSON.stringify({ test: "data" })).toString("base64"),
          },
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      mock.module("../../src/router/data", () => ({
        DataHandler: mock.fn().mockImplementation(() => mockData),
      }));

      const result = await keyValueAPI.get("test-store", "test-key");
      expect(result.exists).toBe(true);
      expect(result.data).toBeDefined();
      expect(api.GET).toHaveBeenCalledWith(
        "/sdk/kv/test-store/test-key",
        true
      );
    });

    it("should return not found when key is not found", async () => {
      const mockResponse = {
        status: 404,
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      const result = await keyValueAPI.get("test-store", "not-found-key");
      expect(result.exists).toBe(false);
    });

    it("should throw an error on failed request", async () => {
      const mockResponse = {
        status: 500,
        json: {
          error: "Internal Server Error",
        },
      };
      
      mock.module("../../src/apis/api", () => ({
        GET: mock(() => Promise.resolve(mockResponse)),
      }));

      await expect(keyValueAPI.get("test-store", "test-key")).rejects.toThrow();
    });
  });
});
