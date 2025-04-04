import { describe, expect, it, beforeEach } from "bun:test";
import { getSDKVersion } from "../../src/router/router";
import AgentResponseHandler from "../../src/router/response";
import type { JsonObject } from "../../src/types";

describe("Router", () => {
  describe("getSDKVersion", () => {
    it("should throw error when no store is found", () => {
      expect(() => getSDKVersion()).toThrow("no store");
    });
  });

  describe("AgentResponseHandler", () => {
    let responseHandler: AgentResponseHandler;

    beforeEach(() => {
      responseHandler = new AgentResponseHandler();
    });

    it("should create text response correctly", async () => {
      const textData = "Hello, world!";
      const metadata: JsonObject = { key: "value" };
      
      const response = await responseHandler.text(textData, metadata);
      
      expect(response.data).toBeDefined();
      expect(response.metadata).toEqual(metadata);
    });

    it("should create JSON response correctly", async () => {
      const jsonData = { message: "Hello, world!" };
      const metadata: JsonObject = { key: "value" };
      
      const response = await responseHandler.json(jsonData, metadata);
      
      expect(response.data).toBeDefined();
      expect(response.metadata).toEqual(metadata);
    });

    it("should create binary response correctly", async () => {
      const binaryData = new Uint8Array(new TextEncoder().encode("Hello, world!")).buffer;
      const metadata: JsonObject = { key: "value" };
      
      const response = await responseHandler.binary(binaryData, metadata);
      
      expect(response.data).toBeDefined();
      expect(response.metadata).toEqual(metadata);
    });
  });
});
