/**
 * Thread-safe singleton class for PatchPortal
 */
export default class PatchPortal {
	private static instance: PatchPortal | null = null;
	private static lock: Promise<PatchPortal> | null = null;
	private static state: { [key: string]: any } = {};

	private constructor() {
		// Private constructor to prevent direct instantiation
	}

	/**
	 * Get the singleton instance of PatchPortal in a thread-safe manner
	 */
	public static async getInstance(): Promise<PatchPortal> {
		if (PatchPortal.instance) {
			return PatchPortal.instance;
		}

		// Double-checked locking pattern for thread safety
		if (!PatchPortal.lock) {
			PatchPortal.lock = (async () => {
				if (!PatchPortal.instance) {
					PatchPortal.instance = new PatchPortal();
				}
				return PatchPortal.instance;
			})();
		}

		return PatchPortal.lock;
	}

	/**
	 * Example method - you can add your specific functionality here
	 */
	public async process(key: string, data: unknown): Promise<unknown> {
		PatchPortal.state[key] = data;
		return data;
	}

	/**
	 * Example method for demonstrating the singleton
	 */
	public getInstanceId(): string {
		return `PatchPortal-${Date.now()}`;
	}
}
