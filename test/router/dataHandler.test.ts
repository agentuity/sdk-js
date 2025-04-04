import { describe, expect, it } from "bun:test";
import { DataHandler } from "../../src/router/data";

describe("DataHandler", () => {
  describe("contentType property", () => {
    it("should return the content type from constructor", () => {
      const handler = new DataHandler({
        contentType: "text/plain",
        payload: Buffer.from("test").toString("base64")
      });
      
      expect(handler.contentType).toBe("text/plain");
    });
    
    it("should default to application/octet-stream if no content type provided", () => {
      // Create with explicit undefined to test default behavior
      const handler = new DataHandler({
        contentType: undefined,
        payload: Buffer.from("test").toString("base64")
      });
      
      expect(handler.contentType).toBe("application/octet-stream");
    });
    
    it("should be accessible through toJSON method", () => {
      const handler = new DataHandler({
        contentType: "text/plain",
        payload: Buffer.from("test").toString("base64")
      });
      
      const json = handler.toJSON();
      expect(json.contentType).toBe("text/plain");
    });
  });
});
