import { describe, expect, it, mock, beforeEach } from 'bun:test';
import PromptAPI, { PromptCompileError } from '../../src/apis/prompt';
import type { PromptCompileResult } from '../../src/types';
import '../setup'; // Import global test setup

describe('PromptAPI', () => {
	let promptAPI: PromptAPI;

	const mockTracer = {
		startSpan: mock((name: string, options: unknown, ctx: unknown) => {
			return {
				setAttribute: mock(() => {}),
				addEvent: mock(() => {}),
				end: mock(() => {}),
				setStatus: mock(() => {}),
				recordException: mock(() => {}),
			};
		}),
	};

	beforeEach(() => {
		mock.restore();
		promptAPI = new PromptAPI();

		mock.module('@opentelemetry/api', () => ({
			context: {
				active: () => ({}),
				with: (ctx: unknown, fn: () => unknown) => fn(),
			},
			trace: {
				setSpan: (ctx: unknown, span: unknown) => ctx,
				getTracer: () => mockTracer,
			},
			SpanStatusCode: {
				OK: 1,
				ERROR: 2,
			},
		}));

		mock.module('../../src/router/router', () => ({
			getTracer: () => mockTracer,
			recordException: mock(() => {}),
			asyncStorage: {
				getStore: () => ({
					tracer: mockTracer,
				}),
			},
		}));
	});

	describe('compile', () => {
		it('should compile a prompt successfully', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: {
						compiledContent: 'Hello John, good morning! Check out our Acme Widget.',
						promptId: 'prompt_123',
						version: 1,
					},
				},
				response: {
					statusText: 'OK',
					status: 200,
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await promptAPI.compile({
				name: 'greeting-template',
				variables: {
					userName: 'John',
					timeOfDay: 'morning',
					product: 'Acme Widget',
				},
				version: 1,
			});

			expect(result.compiledContent).toBe('Hello John, good morning! Check out our Acme Widget.');
			expect(result.promptId).toBe('prompt_123');
			expect(result.version).toBe(1);
		});

		it('should compile a prompt without version (defaults to active)', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					data: {
						compiledContent: 'Hello Jane!',
						promptId: 'prompt_456',
						version: 2,
					},
				},
				response: {
					statusText: 'OK',
					status: 200,
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			const result = await promptAPI.compile({
				name: 'simple-template',
				variables: {
					userName: 'Jane',
				},
			});

			expect(result.compiledContent).toBe('Hello Jane!');
			expect(result.promptId).toBe('prompt_456');
			expect(result.version).toBe(2);
		});

		it('should throw PromptCompileError when prompt is not found (404)', async () => {
			const mockResponse = {
				status: 404,
				json: {
					success: false,
					error: 'Prompt not found',
				},
				response: {
					statusText: 'Not Found',
					status: 404,
					text: () => Promise.resolve('{"message":"Not Found","success":false}'),
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(
				promptAPI.compile({
					name: 'non-existent-prompt',
					variables: {},
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'non-existent-prompt',
					variables: {},
				})
			).rejects.toThrow('Failed to compile prompt: Not Found (404)');
		});

		it('should throw PromptCompileError when compilation fails with error message', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: false,
					error: 'Variable "missingVar" not found in template',
				},
				response: {
					statusText: 'OK',
					status: 200,
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(
				promptAPI.compile({
					name: 'template-with-missing-var',
					variables: {
						userName: 'John',
					},
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'template-with-missing-var',
					variables: {
						userName: 'John',
					},
				})
			).rejects.toThrow('Prompt compilation failed: Variable "missingVar" not found in template');
		});

		it('should throw PromptCompileError on server error (500)', async () => {
			const mockResponse = {
				status: 500,
				response: {
					statusText: 'Internal Server Error',
					status: 500,
					text: () => Promise.resolve('Internal server error occurred'),
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(
				promptAPI.compile({
					name: 'any-prompt',
					variables: {},
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'any-prompt',
					variables: {},
				})
			).rejects.toThrow('Failed to compile prompt: Internal Server Error (500)');
		});

		it('should throw PromptCompileError for invalid prompt name', async () => {
			await expect(
				promptAPI.compile({
					name: '',
					variables: {},
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: '',
					variables: {},
				})
			).rejects.toThrow('Prompt name must be a non-empty string');

			await expect(
				promptAPI.compile({
					name: 123 as unknown as string,
					variables: {},
				})
			).rejects.toThrow('Prompt name must be a non-empty string');
		});

		it('should throw PromptCompileError for invalid variables', async () => {
			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: null as unknown as Record<string, unknown>,
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: null as unknown as Record<string, unknown>,
				})
			).rejects.toThrow('Variables must be an object');

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: 'not-an-object' as unknown as Record<string, unknown>,
				})
			).rejects.toThrow('Variables must be an object');
		});

		it('should throw PromptCompileError for invalid version', async () => {
			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
					version: 0,
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
					version: 0,
				})
			).rejects.toThrow('Version must be a positive integer');

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
					version: -1,
				})
			).rejects.toThrow('Version must be a positive integer');

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
					version: 1.5,
				})
			).rejects.toThrow('Version must be a positive integer');
		});

		it('should handle response with missing data', async () => {
			const mockResponse = {
				status: 200,
				json: {
					success: true,
					// Missing data field
				},
				response: {
					statusText: 'OK',
					status: 200,
				},
			};

			mock.module('../../src/apis/api', () => ({
				POST: mock(() => Promise.resolve(mockResponse)),
			}));

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
				})
			).rejects.toThrow(PromptCompileError);

			await expect(
				promptAPI.compile({
					name: 'test-prompt',
					variables: {},
				})
			).rejects.toThrow('Prompt compilation failed: Unknown error during compilation');
		});
	});
});
