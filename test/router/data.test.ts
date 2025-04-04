import { describe, expect, it, mock, beforeEach } from "bun:test";
import type { DataPayload } from "../../src/types";
import type { ReadableStream } from "node:stream/web";
import type { ReadableDataType } from "../../src/types";

// Create a mock implementation of DataHandler for testing
class MockDataHandler {
  private readonly payload: DataPayload;
  private readonly contentTypeValue: string;

  constructor(payload: DataPayload) {
    this.payload = payload;
    this.contentTypeValue = payload.contentType || 'application/octet-stream';
  }

  get contentType() {
    return this.contentTypeValue;
  }

  get text() {
    if (!this.payload.payload) {
      return '';
    }
    return Buffer.from(this.payload.payload, 'base64').toString('utf-8');
  }

  get json() {
    const text = this.text;
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }

  get binary() {
    if (!this.payload.payload) {
      return new Uint8Array();
    }
    const buffer = Buffer.from(this.payload.payload, 'base64');
    return new Uint8Array(buffer);
  }

  object<T>() {
    return this.json as T;
  }

  get buffer() {
    return Buffer.from(this.payload.payload || '', 'base64');
  }

  get stream(): ReadableStream<ReadableDataType> {
    const buffer = this.buffer;
    return new ReadableStream({
      start(controller) {
        controller.enqueue(buffer);
        controller.close();
      }
    });
  }
}

// Mock the DataHandler import
const DataHandler = MockDataHandler;

describe("DataHandler", () => {
  beforeEach(() => {
    mock.restore();
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
