/**
 * Global test setup file for Bun tests
 * This file ensures proper test isolation and environment consistency
 */
import { beforeEach, afterEach, mock } from 'bun:test';

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...originalEnv };
  
  process.env.AGENTUITY_API_KEY = 'test-api-key';
  process.env.AGENTUITY_TRANSPORT_URL = 'https://test.agentuity.ai/';
  process.env.AGENTUITY_URL = 'https://test.agentuity.ai/';
  
  mock.restore();
});

afterEach(() => {
  process.env = { ...originalEnv };
  
  mock.restore();
});

export const setupTestEnvironment = () => {
  process.env.AGENTUITY_API_KEY = 'test-api-key';
  process.env.AGENTUITY_TRANSPORT_URL = 'https://test.agentuity.ai/';
  process.env.AGENTUITY_URL = 'https://test.agentuity.ai/';
};

export const createMockFetch = () => {
  const fetchCalls: Array<[URL | RequestInfo, RequestInit | undefined]> = [];
  
  const mockResponse = {
    status: 200,
    headers: new Headers({
      'content-type': 'application/json',
    }),
    json: () => Promise.resolve({ success: true }),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    text: () => Promise.resolve('{"success":true}'),
  };
  
  const mockFetch = mock((url: URL | RequestInfo, options?: RequestInit) => {
    fetchCalls.push([url, options]);
    return Promise.resolve(mockResponse);
  });
  
  return { mockFetch, fetchCalls, mockResponse };
};
