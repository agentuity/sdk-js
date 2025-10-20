import { describe, expect, it } from 'bun:test';
import AgentRequestHandler from '../../src/router/request';
import { ReadableStream } from 'node:stream/web';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { JsonObject } from '../../src/types';
import '../setup'; // Import global test setup

describe('AgentRequestHandler', () => {
	describe('trigger property', () => {
		it('should return the trigger from the request', () => {
			const handler = new AgentRequestHandler(
				'webhook',
				new ReadableStream(),
				'application/json',
				{}
			);

			expect(handler.trigger).toEqual('webhook');
		});
	});

	describe('data property', () => {
		it('should return the data handler instance', () => {
			const jsonData = { message: 'Hello, world!' };
			const jsonString = JSON.stringify(jsonData);
			const payload = Buffer.from(jsonString);

			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue(payload);
					controller.close();
				},
			});

			const handler = new AgentRequestHandler(
				'webhook',
				stream,
				'application/json',
				{}
			);

			expect(handler).toBeDefined();
			expect(handler.data).toBeDefined();

			expect(handler.data.contentType).toEqual('application/json');
			expect(handler.data.base64()).resolves.toBe(payload.toString('base64'));
		});
	});

	describe('metadata property', () => {
		it('should return metadata object when present', () => {
			const metadata: JsonObject = { key: 'value' };
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue('base64payload');
					controller.close();
				},
			});

			const handler = new AgentRequestHandler(
				'webhook',
				stream,
				'application/json',
				metadata
			);

			expect(handler.metadata).toEqual(metadata);
		});
	});

	describe('get method', () => {
		it('should return metadata value when key is present', () => {
			const metadata: JsonObject = { key: 'value' };
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue('base64payload');
					controller.close();
				},
			});

			const handler = new AgentRequestHandler(
				'webhook',
				stream,
				'application/json',
				metadata
			);

			expect(handler.get('key')).toEqual('value');
		});

		it('should return default value when key is not present', () => {
			const stream = new ReadableStream({
				start(controller) {
					controller.enqueue('base64payload');
					controller.close();
				},
			});

			const handler = new AgentRequestHandler(
				'webhook',
				stream,
				'application/json',
				{}
			);

			expect(handler.get('missing-key', 'default-value')).toEqual(
				'default-value'
			);
		});
	});

	describe('getRawHTTP method', () => {
		it('should return raw HTTP context when available', () => {
			const mockReq = {} as IncomingMessage;
			const mockRes = {} as ServerResponse;

			const handler = new AgentRequestHandler(
				'webhook',
				new ReadableStream(),
				'application/json',
				{},
				{ request: mockReq, response: mockRes }
			);

			const rawHttp = handler.getRawHTTP();
			expect(rawHttp.request).toBe(mockReq);
			expect(rawHttp.response).toBe(mockRes);
		});

		it('should throw error when raw HTTP context not available', () => {
			const handler = new AgentRequestHandler(
				'cron',
				new ReadableStream(),
				'application/json',
				{}
			);

			expect(() => handler.getRawHTTP()).toThrow(
				"Raw HTTP context not available for trigger type 'cron'"
			);
		});
	});
});
