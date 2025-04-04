import { describe, expect, it } from "bun:test";
import AgentRequestHandler from "../../src/router/request";
import type { AgentRequestType } from "../../src/types";

describe("AgentRequestHandler", () => {
  describe("json method", () => {
    it("should parse JSON payload correctly", () => {
      const jsonData = { message: "Hello, world!" };
      const jsonString = JSON.stringify(jsonData);
      const base64Payload = Buffer.from(jsonString).toString("base64");

      const request: AgentRequestType = {
        trigger: "test",
        contentType: "application/json",
        payload: base64Payload,
      };

      const handler = new AgentRequestHandler(request);
      const result = handler.json();
      
      expect(result).toEqual(jsonData);
    });

    it("should throw error if content type is not application/json", () => {
      const request: AgentRequestType = {
        trigger: "test",
        contentType: "text/plain",
        payload: Buffer.from("plain text").toString("base64"),
      };

      const handler = new AgentRequestHandler(request);
      
      expect(() => handler.json()).toThrow();
    });
  });

  describe("text method", () => {
    it("should parse text payload correctly", () => {
      const text = "Hello, world!";
      const base64Payload = Buffer.from(text).toString("base64");

      const request: AgentRequestType = {
        trigger: "test",
        contentType: "text/plain",
        payload: base64Payload,
      };

      const handler = new AgentRequestHandler(request);
      const result = handler.text();
      
      expect(result).toEqual(text);
    });
  });

  describe("metadata method", () => {
    it("should return metadata value when present", () => {
      const request: AgentRequestType = {
        trigger: "test",
        contentType: "text/plain",
        metadata: {
          key: "value",
        },
      };

      const handler = new AgentRequestHandler(request);
      const result = handler.metadata("key");
      
      expect(result).toEqual("value");
    });

    it("should return default value when metadata key is not present", () => {
      const request: AgentRequestType = {
        trigger: "test",
        contentType: "text/plain",
        metadata: {},
      };

      const handler = new AgentRequestHandler(request);
      const result = handler.metadata("missing-key", "default-value");
      
      expect(result).toEqual("default-value");
    });
  });
});
