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
		console.log(
			'🏗️ PatchPortal constructor called, instanceId:',
			this.instanceId
		);
	}

	/**
	 * Get the singleton instance of PatchPortal
	 */
	public static async getInstance(): Promise<PatchPortal> {
		console.debug('🔍 PatchPortal.getInstance() called');
		console.debug(
			'🔍 globalThis.__patchPortalInstance exists:',
			!!globalThis.__patchPortalInstance
		);

		if (!globalThis.__patchPortalInstance) {
			globalThis.__patchPortalInstance = new PatchPortal();
			console.debug(
				'🆕 Created new PatchPortal instance, ID:',
				globalThis.__patchPortalInstance.instanceId
			);
			console.debug(
				'🔍 Global state after creation:',
				Object.keys(globalThis).filter((k) => k.includes('patch'))
			);
		} else {
			console.debug(
				'♻️ Returning existing PatchPortal instance, ID:',
				globalThis.__patchPortalInstance.instanceId
			);
			console.debug(
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
		console.debug('🔍 PatchPortal.set() called with key:', key);
		console.debug('🔍 Instance ID:', this.instanceId);
		console.debug('🔍 State before set:', Object.keys(this.state));
		this.state[key] = data;
		console.debug('🔍 State after set:', Object.keys(this.state));
		console.debug(
			'🔍 Data stored:',
			typeof data === 'object' ? Object.keys(data as any) : typeof data
		);
	}

	public async get<T = unknown>(key: string): Promise<T> {
		console.debug('🔍 PatchPortal.get() called with key:', key);
		console.debug('🔍 Instance ID:', this.instanceId);
		console.debug('🔍 Current state keys:', Object.keys(this.state));
		console.debug('🔍 Key exists:', key in this.state);
		const result = this.state[key] as T;
		console.debug(
			'🔍 Retrieved data:',
			result
				? typeof result === 'object'
					? Object.keys(result as any)
					: typeof result
				: 'undefined'
		);
		return result;
	}

	/**
	 * Print out the whole state of the PatchPortal
	 */
	public printState(): void {
		console.debug('🔍 PatchPortal.printState() called');
		console.debug('🔍 Instance ID:', this.instanceId);
		console.log('🔍 PatchPortal State:');
		console.log('📊 Total keys:', Object.keys(this.state).length);
		console.log('📋 All keys:', Object.keys(this.state));
		console.log('📦 Full state:', JSON.stringify(this.state, null, 2));
		console.debug(
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
