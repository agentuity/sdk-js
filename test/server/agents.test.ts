import { describe, expect, it, mock } from 'bun:test';
import AgentResolver from '../../src/server/agents';
import '../setup'; // Import global test setup

interface ServerAgent {
	id: string;
	name: string;
	filename: string;
	description?: string;
}

describe('AgentResolver', () => {
	const mockLogger = {
		debug: mock(() => {}),
		info: mock(() => {}),
		warn: mock(() => {}),
		error: mock(() => {}),
		child: mock(() => mockLogger),
	};

	it('should resolve local agent by id', async () => {
		const agents: ServerAgent[] = [
			{
				id: 'agent-id-1',
				name: 'Agent 1',
				filename: 'agent-path-1',
				description: 'Agent 1 description',
			},
			{
				id: 'agent-id-2',
				name: 'Agent 2',
				filename: 'agent-path-2',
				description: 'Agent 2 description',
			},
		];

		const resolver = new AgentResolver(
			mockLogger,
			agents,
			3000,
			'project-id',
			'current-agent-id'
		);

		const agent = await resolver.getAgent({ id: 'agent-id-1' });

		expect(agent).toBeDefined();
		expect(agent.id).toEqual('agent-id-1');
		expect(agent.name).toEqual('Agent 1');
		expect(agent.projectId).toEqual('project-id');
	});

	it('should resolve local agent by name', async () => {
		const agents: ServerAgent[] = [
			{
				id: 'agent-id-1',
				name: 'Agent 1',
				filename: 'agent-path-1',
				description: 'Agent 1 description',
			},
			{
				id: 'agent-id-2',
				name: 'Agent 2',
				filename: 'agent-path-2',
				description: 'Agent 2 description',
			},
		];

		const resolver = new AgentResolver(
			mockLogger,
			agents,
			3000,
			'project-id',
			'current-agent-id'
		);

		const agent = await resolver.getAgent({ name: 'Agent 2' });

		expect(agent).toBeDefined();
		expect(agent.id).toEqual('agent-id-2');
		expect(agent.name).toEqual('Agent 2');
		expect(agent.projectId).toEqual('project-id');
	});

	it('should throw error when resolving the current agent', async () => {
		const agents: ServerAgent[] = [
			{
				id: 'current-agent-id',
				name: 'Current Agent',
				filename: 'agent-path',
				description: 'Current Agent description',
			},
		];

		const resolver = new AgentResolver(
			mockLogger,
			agents,
			3000,
			'project-id',
			'current-agent-id'
		);

		await expect(
			resolver.getAgent({ id: 'current-agent-id' })
		).rejects.toThrow();
	});
});
