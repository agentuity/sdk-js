import { describe, expect, it } from 'bun:test';
import AgentRequestHandler from '../../src/router/request';
import { ReadableStream } from 'node:stream/web';
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
});
