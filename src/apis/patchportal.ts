import { internal } from '../logger/internal';

// Global instance storage to ensure true singleton across all module contexts
declare global {
	var __patchPortalInstance: PatchPortal | undefined;
}

/**
 * Singleton class for PatchPortal
 */
export default class PatchPortal {
	private state: Record<string, unknown> = {};
	private instanceId: string;

	private constructor() {
		// Private constructor to prevent direct instantiation
		this.instanceId = `PatchPortal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		internal.debug(
			'🏗️ PatchPortal constructor called, instanceId:',
			this.instanceId
		);
	}

	/**
	 * Get the singleton instance of PatchPortal
	 */
	public static async getInstance(): Promise<PatchPortal> {
		internal.debug('🔍 PatchPortal.getInstance() called');
		internal.debug(
			'🔍 globalThis.__patchPortalInstance exists:',
			!!globalThis.__patchPortalInstance
		);

		if (!globalThis.__patchPortalInstance) {
			globalThis.__patchPortalInstance = new PatchPortal();
			internal.debug(
				'🆕 Created new PatchPortal instance, ID:',
				globalThis.__patchPortalInstance.instanceId
			);
			internal.debug(
				'🔍 Global state after creation:',
				Object.keys(globalThis).filter((k) => k.includes('patch'))
			);
		} else {
			internal.debug(
				'♻️ Returning existing PatchPortal instance, ID:',
				globalThis.__patchPortalInstance.instanceId
			);
			internal.debug(
				'🔍 Current state keys:',
				Object.keys(globalThis.__patchPortalInstance.state)
			);
		}
		return globalThis.__patchPortalInstance;
	}

	/**
	 * Example method - you can add your specific functionality here
	 */
	public async set<T = unknown>(key: string, data: T): Promise<void> {
		internal.debug('🔍 PatchPortal.set() called with key:', key);
		internal.debug('🔍 Instance ID:', this.instanceId);
		internal.debug('🔍 State before set:', Object.keys(this.state));
		this.state[key] = data;
		internal.debug('🔍 State after set:', Object.keys(this.state));
		internal.debug(
			'🔍 Data stored:',
			data && typeof data === 'object'
				? Object.keys(data as Record<string, unknown>)
				: typeof data
		);
	}

	public async get<T = unknown>(key: string): Promise<T> {
		internal.debug('🔍 PatchPortal.get() called with key:', key);
		internal.debug('🔍 Instance ID:', this.instanceId);
		internal.debug('🔍 Current state keys:', Object.keys(this.state));
		internal.debug('🔍 Key exists:', key in this.state);
		const result = this.state[key] as T;
		internal.debug(
			'🔍 Retrieved data:',
			result
				? typeof result === 'object'
					? Object.keys(result as Record<string, unknown>)
					: typeof result
				: 'undefined'
		);
		return result;
	}

	/**
	 * Print out the whole state of the PatchPortal
	 */
	public printState(): void {
		internal.debug('🔍 PatchPortal.printState() called');
		internal.debug('🔍 Instance ID:', this.instanceId);
		internal.debug('🔍 PatchPortal State:');
		internal.debug('📊 Total keys:', Object.keys(this.state).length);
		internal.debug('📋 All keys:', Object.keys(this.state));
		internal.debug('📦 Full state:', JSON.stringify(this.state, null, 2));
		internal.debug(
			'🔍 Global instance check:',
			globalThis.__patchPortalInstance === this
		);
	}

	/**
	 * Get all keys in the PatchPortal
	 */
	public getAllKeys(): string[] {
		return Object.keys(this.state);
	}

	/**
	 * Get the entire state object
	 */
	public getState(): Record<string, unknown> {
		return { ...this.state };
	}

	/**
	 * Example method for demonstrating the singleton
	 */
	public getInstanceId(): string {
		return this.instanceId;
	}
}
