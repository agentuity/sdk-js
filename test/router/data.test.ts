import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { DataHandler } from "../../src/router/data";
import type { DataPayload } from "../../src/types";


describe("DataHandler", () => {
  
  beforeEach(() => {
    mock.restore();
    
    mock.module("../../src/server/util", () => ({
      safeParse: (text: string, defaultValue?: unknown) => {
        try {
          return JSON.parse(text);
        } catch (error) {
          return defaultValue;
        }
      }
    }));
    
    mock.module("node:fs", () => ({
      readFileSync: mock((path: string, encoding: string) => {
        if (path.includes("test-file")) {
          return "test file content";
        }
        throw new Error(`File not found: ${path}`);
      }),
      existsSync: mock((path: string) => path.includes("test-file")),
      createReadStream: mock(() => {
        const events: Record<string, Function[]> = {};
        const stream = {
          on: (event: string, callback: Function) => {
            if (!events[event]) {
              events[event] = [];
            }
            events[event].push(callback);
            return stream;
          },
          emit: (event: string, ...args: any[]) => {
            if (events[event]) {
              events[event].forEach(callback => callback(...args));
            }
            return true;
          },
          destroy: mock(() => {})
        };
        
        setTimeout(() => {
          stream.emit("data", Buffer.from("test file content"));
          stream.emit("end");
        }, 0);
        
        return stream;
      })
    }));
  });
  
  let originalEnv: NodeJS.ProcessEnv;
  
  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.AGENTUITY_IO_INPUT_DIR = "/tmp";
  });
  
  afterEach(() => {
    process.env = originalEnv;
  });

  describe("constructor", () => {
    it("should initialize with payload and content type", () => {
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "text/plain",
        payload: Buffer.from("Hello, world!").toString("base64")
      };
      
      const handler = new DataHandler(payload);
      
      expect(handler.contentType).toBe("text/plain");
    });
    
    it("should default to application/octet-stream if no content type provided", () => {
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "application/octet-stream",
        payload: Buffer.from("Hello, world!").toString("base64")
      };
      
      const handler = new DataHandler(payload);
      
      expect(handler.contentType).toBe("application/octet-stream");
    });
  });
  
  describe("text property", () => {
    it("should decode base64 payload to text", () => {
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "text/plain",
        payload: Buffer.from("Hello, world!").toString("base64")
      };
      
      const handler = new DataHandler(payload);
      
      expect(handler.text).toBe("Hello, world!");
    });
    
    it("should handle empty payload", () => {
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "text/plain",
        payload: ""
      };
      
      const handler = new DataHandler(payload);
      
      expect(handler.text).toBe("");
    });
  });
  
  describe("json property", () => {
    it("should parse JSON payload correctly", () => {
      const jsonData = { message: "Hello, world!" };
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(jsonData)).toString("base64")
      };
      
      const handler = new DataHandler(payload);
      
      expect(handler.json).toEqual(jsonData);
    });
    
    it("should throw error for invalid JSON", () => {
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "application/json",
        payload: Buffer.from("invalid json").toString("base64")
      };
      
      const handler = new DataHandler(payload);
      
      expect(() => handler.json).toThrow();
    });
  });
  
  describe("binary property", () => {
    it("should return Uint8Array from payload", () => {
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "application/octet-stream",
        payload: Buffer.from(binaryData).toString("base64")
      };
      
      const handler = new DataHandler(payload);
      const result = handler.binary;
      
      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(4);
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(2);
      expect(result[2]).toBe(3);
      expect(result[3]).toBe(4);
    });
  });
  
  describe("object method", () => {
    it("should return typed object from JSON payload", () => {
      interface TestData {
        message: string;
        count: number;
      }
      
      const jsonData: TestData = { message: "Hello, world!", count: 42 };
      const payload: DataPayload = {
        trigger: "webhook",
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(jsonData)).toString("base64")
      };
      
      const handler = new DataHandler(payload);
      const result = handler.object<TestData>();
      
      expect(result).toEqual(jsonData);
      expect(result.message).toBe("Hello, world!");
      expect(result.count).toBe(42);
    });
  });
});
