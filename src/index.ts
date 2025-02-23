export * from './server';
export * from './logger';
export * from './types';

export async function runner(
	autoStart = false,
	dir = process.env.AGENTUITY_SDK_DIR
) {
	if (autoStart && !!dir) {
		const runner = await import('./autostart');
		await runner.run(dir, process.env.AGENTUITY_SDK_DIST_DIR);
	}
}
