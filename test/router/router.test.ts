import { describe, expect, it } from "bun:test";
import { toAgentResponseJSON } from "../../src/router/router";
import type { AgentResponseType } from "../../src/types";

describe("Router", () => {
  describe("toAgentResponseJSON", () => {
    it("should handle string payload correctly", () => {
      const result = toAgentResponseJSON(
        "agent",
        "Hello, world!",
        "utf-8"
      );
      
      expect(result).toEqual({
        trigger: "agent",
        contentType: "text/plain",
        payload: "Hello, world!",
      } as AgentResponseType);
    });

    it("should handle JSON payload correctly", () => {
      const jsonPayload = { message: "Hello, world!" };
      const result = toAgentResponseJSON(
        "agent",
        jsonPayload,
        "utf-8"
      );
      
      expect(result).toEqual({
        trigger: "agent",
        contentType: "application/json",
        payload: JSON.stringify(jsonPayload),
      } as AgentResponseType);
    });

    it("should handle ArrayBuffer payload correctly", () => {
      const buffer = new TextEncoder().encode("Hello, world!").buffer as ArrayBuffer;
      const result = toAgentResponseJSON(
        "agent",
        buffer,
        "utf-8",
        "application/octet-stream"
      );
      
      expect(result).toEqual({
        trigger: "agent",
        contentType: "application/octet-stream",
        payload: Buffer.from(buffer).toString("utf-8"),
      } as AgentResponseType);
    });

    it("should include metadata when provided", () => {
      const metadata = { key: "value" };
      const result = toAgentResponseJSON(
        "agent",
        "Hello, world!",
        "utf-8",
        "text/plain",
        metadata
      );
      
      expect(result).toEqual({
        trigger: "agent",
        contentType: "text/plain",
        payload: "Hello, world!",
        metadata,
      } as AgentResponseType);
    });
  });
});
