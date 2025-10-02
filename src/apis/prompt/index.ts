// Main entry point for prompts - following POC pattern exactly

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PromptsCollection } from './generated/index.js';

// Default empty prompts object that satisfies PromptsCollection
const defaultPrompts: PromptsCollection = {};

// Expected shape of generated module
interface GeneratedModule {
	prompts?: PromptsCollection;
}

export default class PromptAPI {
	public prompts: PromptsCollection;

	constructor() {
		// Initialize with empty prompts by default
		this.prompts = defaultPrompts;
	}

	/**
	 * Compile a prompt by name with variables - returns compiled strings
	 * @param name - The name/slug of the prompt to compile
	 * @param variables - Variables to interpolate
	 * @returns Object with system and prompt strings
	 */
	public compile<T extends keyof PromptsCollection>(
		name: T,
		...args: PromptsCollection[T]['system'] extends () => string
			? PromptsCollection[T]['prompt'] extends () => string
				? [] // No variables needed
				: [
						{
							system?: Parameters<PromptsCollection[T]['system']>[0];
							prompt?: Parameters<PromptsCollection[T]['prompt']>[0];
						},
					]
			: [
					{
						system: Parameters<PromptsCollection[T]['system']>[0];
						prompt: Parameters<PromptsCollection[T]['prompt']>[0];
					},
				]
	): { system: string; prompt: string } {
		const prompt = this.prompts[name as string];
		if (!prompt) {
			throw new Error(`Prompt '${String(name)}' not found`);
		}

		const variables = args[0];
		return {
			system: prompt.system(variables?.system as any),
			prompt: prompt.prompt(variables?.prompt as any),
		};
	}

	/**
	 * Get a prompt by name for individual system/prompt compilation
	 * @param name - The name/slug of the prompt
	 * @returns Prompt object with system and prompt functions that can be called directly
	 */
	public getPrompt<T extends keyof typeof this.prompts>(name: T) {
		const prompt = this.prompts[name as string];
		if (!prompt) {
			throw new Error(`Prompt '${String(name)}' not found`);
		}

		return {
			system: (variables?: Parameters<typeof prompt.system>[0]) =>
				prompt.system(variables),
			prompt: (variables?: Parameters<typeof prompt.prompt>[0]) =>
				prompt.prompt(variables),
		};
	}

	/**
	 * Resolve possible paths for generated prompts using dynamic module resolution
	 */
	private async resolveGeneratedPaths(): Promise<string[]> {
		const paths: string[] = [];

		try {
			// Try to resolve the @agentuity/sdk package
			const sdkPath = require.resolve('@agentuity/sdk/package.json');
			const sdkRoot = path.dirname(sdkPath);

			// Add both dist and src paths relative to resolved package
			paths.push(
				path.join(sdkRoot, 'dist', 'apis', 'prompt', 'generated', '_index.js'),
				path.join(sdkRoot, 'src', 'apis', 'prompt', 'generated', '_index.js')
			);
		} catch {
			// Fallback to process.cwd() if package resolution fails
			// (e.g., in bundled/serverless environments)
			const fallbackRoot = process.cwd();
			paths.push(
				path.join(
					fallbackRoot,
					'node_modules',
					'@agentuity',
					'sdk',
					'dist',
					'apis',
					'prompt',
					'generated',
					'_index.js'
				),
				path.join(
					fallbackRoot,
					'node_modules',
					'@agentuity',
					'sdk',
					'src',
					'apis',
					'prompt',
					'generated',
					'_index.js'
				)
			);
		}

		return paths;
	}

	/**
	 * Type guard to validate generated module shape
	 */
	private isValidGeneratedModule(module: unknown): module is GeneratedModule {
		return (
			typeof module === 'object' &&
			module !== null &&
			((module as GeneratedModule).prompts === undefined ||
				typeof (module as GeneratedModule).prompts === 'object')
		);
	}

	// Method to load prompts dynamically (called by context)
	public async loadPrompts(): Promise<void> {
		// console.log('loadPrompts() called');
		try {
			// Try multiple possible paths for the generated prompts
			let generatedModule: unknown;

			// Dynamic module resolution strategy
			const possiblePaths = await this.resolveGeneratedPaths();

			// console.log('Trying absolute paths:');
			for (const possiblePath of possiblePaths) {
				// console.log('  Checking:', possiblePath);
				try {
					await fs.access(possiblePath);
					// Get file stats for cache-busting
					const stats = await fs.stat(possiblePath);
					const mtime = stats.mtime.getTime();

					// Convert to file URL with cache-busting query param
					const fileUrl = pathToFileURL(possiblePath).href + `?t=${mtime}`;

					// Use ESM dynamic import instead of require
					generatedModule = await import(fileUrl);
					// console.log('  Successfully loaded from:', possiblePath);
					break;
				} catch {}
			}

			if (!generatedModule) {
				throw new Error('Generated prompts file not found');
			}

			// Type guard to ensure generatedModule has expected shape
			if (!this.isValidGeneratedModule(generatedModule)) {
				throw new Error('Generated module has invalid shape');
			}

			// console.log('Generated module:', generatedModule);
			// console.log(
			// 	'Prompts in module:',
			// 	Object.keys(generatedModule.prompts || {})
			// );
			this.prompts =
				// biome-ignore lint/suspicious/noExplicitAny: <we are loading the generated module>
				(generatedModule as any).prompts ||
				(defaultPrompts as PromptsCollection);
			// console.log('Final prompts:', Object.keys(this.prompts));
		} catch (error) {
			// Fallback to empty prompts if generated file doesn't exist
			console.log(
				'Error loading prompts:',
				error instanceof Error ? error.message : String(error)
			);
			this.prompts = defaultPrompts;
			console.warn(
				'⚠️  No generated prompts found. Run `agentuity bundle` to generate prompts from src/prompts.yaml'
			);
		}
	}
}

// Re-export generated types and prompts (following POC pattern)
export { defaultPrompts as prompts };
export * from './generated/index.js';
