import { dependencies } from './package.json';

await Bun.build({
	entrypoints: ['./src/index.ts'],
	outdir: './dist',
	format: 'esm',
	target: 'node',
	sourcemap: 'external',
	minify: true,
	splitting: false,
	treeShaking: false,
	external: Object.keys(dependencies),
});
