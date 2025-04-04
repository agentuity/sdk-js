import { describe, expect, it, mock } from "bun:test";
import AgentResolver from "../../src/server/agents";
import type { ServerAgent } from "../../src/server/types";

describe("AgentResolver", () => {
  const mockLogger = {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    child: mock(() => mockLogger),
  };

  it("should resolve local agent by id", async () => {
    const agents: ServerAgent[] = [
      {
        id: "agent-id-1",
        name: "Agent 1",
        path: "agent-path-1",
        filename: "agent1.ts",
      },
      {
        id: "agent-id-2",
        name: "Agent 2",
        path: "agent-path-2",
        filename: "agent2.ts",
      },
    ];

    const resolver = new AgentResolver(
      mockLogger, 
      agents, 
      3000, 
      "project-id",
      "current-agent-id"
    );

    const agent = await resolver.getAgent({ id: "agent-id-1" });
    
    expect(agent).toBeDefined();
    expect(agent.id).toEqual("agent-id-1");
    expect(agent.name).toEqual("Agent 1");
    expect(agent.projectId).toEqual("project-id");
  });

  it("should resolve local agent by name", async () => {
    const agents: ServerAgent[] = [
      {
        id: "agent-id-1",
        name: "Agent 1",
        path: "agent-path-1",
        filename: "agent1.ts",
      },
      {
        id: "agent-id-2",
        name: "Agent 2",
        path: "agent-path-2",
        filename: "agent2.ts",
      },
    ];

    const resolver = new AgentResolver(
      mockLogger, 
      agents, 
      3000, 
      "project-id",
      "current-agent-id"
    );

    const agent = await resolver.getAgent({ name: "Agent 2" });
    
    expect(agent).toBeDefined();
    expect(agent.id).toEqual("agent-id-2");
    expect(agent.name).toEqual("Agent 2");
    expect(agent.projectId).toEqual("project-id");
  });

  it("should throw error when resolving the current agent", async () => {
    const agents: ServerAgent[] = [
      {
        id: "current-agent-id",
        name: "Current Agent",
        path: "agent-path",
        filename: "agent.ts",
      },
    ];

    const resolver = new AgentResolver(
      mockLogger, 
      agents, 
      3000, 
      "project-id",
      "current-agent-id"
    );

    await expect(resolver.getAgent({ id: "current-agent-id" })).rejects.toThrow();
  });
});
