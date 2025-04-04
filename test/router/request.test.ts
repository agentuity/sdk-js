import { describe, expect, it } from "bun:test";
import AgentRequestHandler from "../../src/router/request";
import type { TriggerType, JsonObject } from "../../src/types";

describe("AgentRequestHandler", () => {
  describe("trigger property", () => {
    it("should return the trigger from the request", () => {
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.trigger).toEqual("webhook");
    });
  });

  describe("data property", () => {
    it("should return the data handler instance", () => {
      const jsonData = { message: "Hello, world!" };
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: Buffer.from(JSON.stringify(jsonData)).toString("base64"),
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.data).toBeDefined();
      expect(handler.data.contentType).toEqual("application/json");
      expect(handler.data.json).toEqual(jsonData);
    });
  });

  describe("metadata property", () => {
    it("should return metadata object when present", () => {
      const metadata: JsonObject = { key: "value" };
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
        metadata,
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.metadata).toEqual(metadata);
    });

    it("should return empty object when metadata is not present", () => {
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.metadata).toEqual({});
    });
  });

  describe("get method", () => {
    it("should return metadata value when key is present", () => {
      const metadata: JsonObject = { key: "value" };
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
        metadata,
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.get("key")).toEqual("value");
    });

    it("should return default value when key is not present", () => {
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
        metadata: {},
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.get("missing-key", "default-value")).toEqual("default-value");
    });
  });
});
