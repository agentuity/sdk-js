import { defineConfig } from 'tsup';

export default defineConfig([
	{
		entry: ['src/index.ts'],
		outDir: 'dist',
		format: ['esm'],
		dts: true,
		sourcemap: true,
		treeshake: false,
		splitting: false,
		external: ['bun', '@agentuity/sdk', '@grpc/grpc-js'],
	},
]);
