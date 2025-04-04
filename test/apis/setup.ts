/**
 * Setup file for API tests
 * Provides consistent mock implementations for fetch and other dependencies
 */
import { mock } from 'bun:test';

export function setupApiMocks() {
  const mockFetch = mock(() => 
    Promise.resolve({
      status: 200,
      headers: new Headers({
        "content-type": "application/json",
      }),
      json: () => Promise.resolve({ success: true }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
  );
  
  global.fetch = mockFetch;
  
  mock.module("../../src/router/router", () => ({
    getSDKVersion: () => "1.0.0",
  }));
  
  return mockFetch;
}
