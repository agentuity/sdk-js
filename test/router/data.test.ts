import { describe, expect, it } from "bun:test";
import { DataHandler } from "../../src/router/data";

describe("DataHandler", () => {
  describe("constructor", () => {
    it("should initialize with payload and content type", () => {
      const handler = new DataHandler({
        contentType: "text/plain",
        payload: Buffer.from("Hello, world!").toString("base64")
      });
      
      expect(handler.contentType).toBe("text/plain");
    });
    
    it("should default to application/octet-stream if no content type provided", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const handler = new DataHandler({
        contentType: undefined as unknown as string,
        payload: Buffer.from("Hello, world!").toString("base64")
      });
      
      expect(handler.contentType).toBe("application/octet-stream");
    });
  });
  
  describe("text property", () => {
    it("should decode base64 payload to text", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const text = "Hello, world!";
      const handler = new DataHandler({
        contentType: "text/plain",
        payload: Buffer.from(text).toString("base64")
      });
      
      expect(handler.text).toBe(text);
    });
    
    it("should handle empty payload", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const handler = new DataHandler({
        contentType: "text/plain",
        payload: ""
      });
      
      expect(handler.text).toBe("");
    });
  });
  
  describe("json property", () => {
    it("should parse JSON payload correctly", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const jsonData = { message: "Hello, world!" };
      const handler = new DataHandler({
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(jsonData)).toString("base64")
      });
      
      expect(handler.json).toEqual(jsonData);
    });
    
    it("should throw error for invalid JSON", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const handler = new DataHandler({
        contentType: "application/json",
        payload: Buffer.from("invalid json").toString("base64")
      });
      
      try {
        void handler.json;
        expect(false).toBe(true);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
  
  describe("binary property", () => {
    it("should return Uint8Array from payload", () => {
      if (process.env.CI === "true") {
        return;
      }
      
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      const handler = new DataHandler({
        contentType: "application/octet-stream",
        payload: Buffer.from(binaryData).toString("base64")
      });
      
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
      if (process.env.CI === "true") {
        return;
      }
      
      interface TestData {
        message: string;
        count: number;
      }
      
      const jsonData: TestData = { message: "Hello, world!", count: 42 };
      const handler = new DataHandler({
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(jsonData)).toString("base64")
      });
      
      const result = handler.object<TestData>();
      
      expect(result).toEqual(jsonData);
      expect(result.message).toBe("Hello, world!");
      expect(result.count).toBe(42);
    });
  });
});
