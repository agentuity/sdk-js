import { describe, expect, it, } from 'bun:test';
import { createServerContext } from '../../src/server/server';
import type { Logger, Meter, Tracer } from '@opentelemetry/api';
import type { AgentConfig } from '../../src/types';
import '../setup'; // Import global test setup

describe('Server Context', () => {
	const mockLogger = {} as Logger;
	const mockMeter = {} as Meter;
	const mockTracer = {} as Tracer;
	const mockAgents: AgentConfig[] = [];

	describe('createServerContext', () => {
		it('should create context with sessionId and set runId equal to sessionId', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				sessionId: 'test-session-123',
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_test-session-123');
			expect(context.runId).toBe('sess_test-session-123');
			expect(context.runId).toBe(context.sessionId);
		});

		it('should add sess_ prefix if sessionId does not start with it', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				sessionId: 'no-prefix-session',
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_no-prefix-session');
			expect(context.runId).toBe('sess_no-prefix-session');
		});

		it('should not add prefix if sessionId already starts with sess_', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				sessionId: 'sess_already-prefixed',
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_already-prefixed');
			expect(context.runId).toBe('sess_already-prefixed');
		});

		it('should fallback to runId if sessionId is not provided', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				runId: 'legacy-run-id',
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_legacy-run-id');
			expect(context.runId).toBe('sess_legacy-run-id');
		});

		it('should handle empty sessionId and runId', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_');
			expect(context.runId).toBe('sess_');
		});

		it('should prefer sessionId over runId when both are provided', () => {
			const req = {
				tracer: mockTracer,
				meter: mockMeter,
				logger: mockLogger,
				sessionId: 'new-session',
				runId: 'old-run-id',
				sdkVersion: '1.0.0',
				agents: mockAgents,
			};

			const context = createServerContext(req);

			expect(context.sessionId).toBe('sess_new-session');
			expect(context.runId).toBe('sess_new-session');
		});
	});
});
