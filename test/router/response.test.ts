import { describe, expect, it, mock, beforeEach } from "bun:test";
import AgentResponseHandler from "../../src/router/response";
import type { JsonObject } from "../../src/types";
import "../setup"; // Import global test setup

describe("AgentResponseHandler", () => {
  let responseHandler: AgentResponseHandler;

  beforeEach(() => {
    responseHandler = new AgentResponseHandler();
    
    mock.module("../../src/router/data", () => ({
      DataHandler: mock((payload) => ({
        contentType: payload.contentType,
        base64: payload.payload,
        toString: () => payload.payload,
        toJSON: () => ({ contentType: payload.contentType, base64: payload.payload }),
      })),
    }));
    
    mock.module("../../src/server/util", () => ({
      safeStringify: mock((data) => JSON.stringify(data)),
      fromDataType: mock((data, contentType, metadata) => {
        return Promise.resolve({
          data: {
            contentType,
            base64: typeof data === "string" ? Buffer.from(data).toString("base64") : "mock-base64",
          },
          metadata,
        });
      }),
    }));
  });

  describe("handoff", () => {
    it("should create a redirect response to another agent", async () => {
      const agent = { id: "agent-123" };
      const args = { data: "test-data" };
      
      const result = await responseHandler.handoff(agent, args);
      
      expect(result.redirect).toBe(true);
      expect(result.agent).toEqual(agent);
      expect(result.invocation).toEqual(args);
    });
  });

  describe("empty", () => {
    it("should create an empty response with metadata", async () => {
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.empty(metadata);
      
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("text", () => {
    it("should create a text response with content", async () => {
      const textData = "Hello, world!";
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.text(textData, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("json", () => {
    it("should create a JSON response with content", async () => {
      const jsonData = { message: "Hello, world!" };
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.json(jsonData, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("binary", () => {
    it("should create a binary response with content", async () => {
      const binaryData = new Uint8Array([1, 2, 3, 4]);
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.binary(binaryData, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("html", () => {
    it("should create an HTML response with content", async () => {
      const htmlData = "<html><body>Hello, world!</body></html>";
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.html(htmlData, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("markdown", () => {
    it("should create a markdown response with content", async () => {
      const markdownData = "# Hello, world!";
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.markdown(markdownData, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });

  describe("media type methods", () => {
    it("should create a PDF response", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await responseHandler.pdf(data);
      expect(result.data).toBeDefined();
    });

    it("should create a PNG response", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await responseHandler.png(data);
      expect(result.data).toBeDefined();
    });

    it("should create a JPEG response", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await responseHandler.jpeg(data);
      expect(result.data).toBeDefined();
    });

    it("should create a GIF response", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await responseHandler.gif(data);
      expect(result.data).toBeDefined();
    });

    it("should create a WebP response", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      const result = await responseHandler.webp(data);
      expect(result.data).toBeDefined();
    });

    it("should create audio responses", async () => {
      const data = new Uint8Array([1, 2, 3, 4]);
      
      const mp3Result = await responseHandler.mp3(data);
      expect(mp3Result.data).toBeDefined();
      
      const wavResult = await responseHandler.wav(data);
      expect(wavResult.data).toBeDefined();
      
      const oggResult = await responseHandler.ogg(data);
      expect(oggResult.data).toBeDefined();
    });
  });

  describe("data", () => {
    it("should create a response with custom content type", async () => {
      const data = "Custom data";
      const contentType = "application/custom";
      const metadata: JsonObject = { key: "value" };
      
      const result = await responseHandler.data(data, contentType, metadata);
      
      expect(result.data).toBeDefined();
      expect(result.metadata).toEqual(metadata);
    });
  });
});
