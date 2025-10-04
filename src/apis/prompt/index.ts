// Main entry point for prompts - following POC pattern exactly

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import type { PromptsCollection } from './generic_types.js';

// Default empty prompts object
const defaultPrompts = {};

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
				generatedModule.prompts || (defaultPrompts as PromptsCollection);
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
export { defaultPrompts };

// Conditional exports for generated content
let PromptConfig: any;
let PromptName: any;
let GeneratedPromptsCollection: any;
let prompts: any;

try {
	const generatedModule = require('./generated/_index.js');
	PromptConfig = generatedModule.PromptConfig;
	PromptName = generatedModule.PromptName;
	GeneratedPromptsCollection = generatedModule.GeneratedPromptsCollection;
	prompts = generatedModule.prompts;
} catch {
	// Fallback to placeholder values when generated content doesn't exist
	PromptConfig = {};
	PromptName = {};
	GeneratedPromptsCollection = {};
	prompts = {};
}

export { PromptConfig, PromptName, GeneratedPromptsCollection, prompts };
export * from './generic_types.js';
