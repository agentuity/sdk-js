import { describe, expect, it, mock } from "bun:test";
import AgentRequestHandler from "../../src/router/request";
import type { TriggerType, JsonObject } from "../../src/types";

mock.module("../../src/router/data", () => ({
  DataHandler: mock(() => ({
    text: "Hello, world!",
    json: { message: "Hello, world!" },
    contentType: "application/json",
    base64: "base64string",
  })),
}));

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
      const request = {
        trigger: "webhook" as TriggerType,
        contentType: "application/json",
        payload: "base64payload",
      };

      const handler = new AgentRequestHandler(request);
      
      expect(handler.data).toBeDefined();
      expect(handler.data.text).toEqual("Hello, world!");
      expect(handler.data.json).toEqual({ message: "Hello, world!" });
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
