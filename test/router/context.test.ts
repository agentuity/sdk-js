import { describe, expect, it, beforeEach, mock } from 'bun:test';
import AgentContextWaitUntilHandler from '../../src/router/context';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import '../setup'; // Import global test setup

// Mock the markSessionCompleted function to avoid API calls during testing
mock.module('../../src/apis/session', () => ({
	markSessionCompleted: mock(() => Promise.resolve()),
}));

describe('AgentContextWaitUntilHandler', () => {
	let handler: AgentContextWaitUntilHandler;
	let mockTracer: any;
	let mockSpan: any;

	beforeEach(() => {
		// Create mock span
		mockSpan = {
			setStatus: mock(() => {}),
			recordException: mock(() => {}),
			end: mock(() => {}),
		};

		// Create mock tracer
		mockTracer = {
			startSpan: mock(() => mockSpan),
		};

		// Create handler with mock tracer
		handler = new AgentContextWaitUntilHandler(mockTracer);
	});

	describe('waitUntil with direct promises', () => {
		it('should accept and handle a direct promise that resolves', async () => {
			const promise = Promise.resolve();
			
			handler.waitUntil(promise);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockTracer.startSpan).toHaveBeenCalledWith('waitUntil', {}, expect.any(Object));
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
			expect(mockSpan.end).toHaveBeenCalled();
		});

		it('should accept and handle a direct promise that rejects', async () => {
			const error = new Error('Test error');
			const promise = Promise.reject(error);
			
			handler.waitUntil(promise);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises - should handle the rejection
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
		});
	});

	describe('waitUntil with callback functions', () => {
		it('should accept and handle a callback that returns a resolving promise', async () => {
			const callback = () => Promise.resolve();
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockTracer.startSpan).toHaveBeenCalledWith('waitUntil', {}, expect.any(Object));
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
			expect(mockSpan.end).toHaveBeenCalled();
		});

		it('should accept and handle a callback that returns a rejecting promise', async () => {
			const error = new Error('Callback error');
			const callback = () => Promise.reject(error);
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
		});

		it('should accept and handle a callback that returns void', async () => {
			const callback = () => {};
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
			expect(mockSpan.end).toHaveBeenCalled();
		});

		it('should accept and handle a callback that throws synchronously', async () => {
			const error = new Error('Sync error');
			const callback = () => {
				throw error;
			};
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
		});
	});

	describe('error handling and re-throwing', () => {
		it('should re-throw errors from direct promises', async () => {
			const error = new Error('Direct promise error');
			const promise = Promise.reject(error);
			
			handler.waitUntil(promise);
			
			// The promise should be wrapped and stored
			expect(handler.hasPending()).toBe(true);
			
			// When waitUntilAll executes, it should handle the re-thrown error
			await handler.waitUntilAll(console, 'test-session');
			
			// Verify error was recorded and re-thrown (span status should be ERROR)
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
		});

		it('should re-throw errors from callback functions', async () => {
			const error = new Error('Callback error');
			const callback = () => Promise.reject(error);
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			// Verify error was recorded and re-thrown
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.ERROR });
		});
	});

	describe('Promise.resolve normalization', () => {
		it('should normalize sync callbacks with Promise.resolve', async () => {
			const callback = mock(() => 'sync result');
			
			handler.waitUntil(callback);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			// Verify the callback was called
			expect(callback).toHaveBeenCalled();
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
		});

		it('should handle already-resolved promises correctly', async () => {
			const resolvedPromise = Promise.resolve('already resolved');
			
			handler.waitUntil(resolvedPromise);
			
			expect(handler.hasPending()).toBe(true);
			
			// Execute all pending promises
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
		});
	});

	describe('type safety', () => {
		it('should accept both promise types at compile time', () => {
			// This test ensures TypeScript compilation works correctly
			const directPromise: Promise<void> = Promise.resolve();
			const callbackPromise: () => Promise<void> = () => Promise.resolve();
			const callbackVoid: () => void = () => {};
			
			// These should all compile without TypeScript errors
			handler.waitUntil(directPromise);
			handler.waitUntil(callbackPromise);
			handler.waitUntil(callbackVoid);
			
			expect(true).toBe(true); // Just to have an assertion
		});
	});

	describe('span context and tracing', () => {
		it('should create spans with correct parameters', async () => {
			const promise = Promise.resolve();
			
			handler.waitUntil(promise);
			await handler.waitUntilAll(console, 'test-session');
			
			expect(mockTracer.startSpan).toHaveBeenCalledWith(
				'waitUntil', 
				{}, 
				expect.any(Object) // context
			);
		});

		it('should record exceptions with proper error type casting', async () => {
			const error = new Error('Test error');
			const promise = Promise.reject(error);
			
			handler.waitUntil(promise);
			await handler.waitUntilAll(console, 'test-session');
			
			// Verify the error was cast to Error type for recordException
			expect(mockSpan.recordException).toHaveBeenCalledWith(error);
		});
	});
});
