// Main entry point for prompts - following POC pattern exactly

import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';

<<<<<<< HEAD

import { internal } from '../../logger/internal';
import { processPromptMetadataConcat } from '../../utils/promptMetadata';
import type { GeneratedPromptsCollection } from './generated/index';
import { prompts as generatedPrompts } from './generated/index';

=======

import type { PromptsCollection } from './generic_types.js';

>>>>>>> 33a7b267aa234612cd26793e2f28aa2bd0e27398

// Default empty prompts object
const defaultPrompts = {};

// Expected shape of generated module
interface GeneratedModule {
	prompts?: GeneratedPromptsCollection;
}

export default class PromptAPI {
	public prompts: GeneratedPromptsCollection;

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
		internal.debug('loadPrompts() called');
		try {
			// Try multiple possible paths for the generated prompts
			let generatedModule: unknown;

			// Dynamic module resolution strategy
			const possiblePaths = await this.resolveGeneratedPaths();

			internal.debug('Trying absolute paths:', possiblePaths);
			for (const possiblePath of possiblePaths) {
				internal.debug('  Checking:', possiblePath);
				try {
					await fs.access(possiblePath);
					// Get file stats for cache-busting
					const stats = await fs.stat(possiblePath);
					const mtime = stats.mtime.getTime();

					// Convert to file URL with cache-busting query param
					const fileUrl = pathToFileURL(possiblePath).href + `?t=${mtime}`;

					// Use ESM dynamic import instead of require
					generatedModule = await import(fileUrl);
					internal.debug('  Successfully loaded from:', possiblePath);
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

			internal.debug('Generated module:', generatedModule);
			internal.debug(
				'Prompts in module:',
				Object.keys(generatedModule.prompts || {})
			);
			this.prompts =
				generatedModule.prompts ||
				(defaultPrompts as GeneratedPromptsCollection);
			internal.debug('Final prompts:', Object.keys(this.prompts));
		} catch (error) {
			// Fallback to empty prompts if generated file doesn't exist
			internal.error(
				'Error loading prompts:',
				error instanceof Error ? error.message : String(error)
			);
			this.prompts = defaultPrompts;
			internal.warn(
				'⚠️  No generated prompts found. Run `agentuity bundle` to generate prompts from src/prompts.yaml'
			);
		}
	}

	/**
	 * Get a prompt by name
	 * @param name The prompt slug/name
	 * @returns The prompt object or undefined
	 */
	public getPrompt(name: string) {
		return this.prompts[name];
	}

	/**
	 * Concatenate metadata from multiple prompt slugs into an array
	 * @param args Array of prompt slugs to concatenate
	 * @returns Array of metadata objects for each found prompt
	 */
	public async concat(...args: string[]): Promise<string> {
		return processPromptMetadataConcat(args);
	}
}

// Re-export prompts
export { defaultPrompts, generatedPrompts as prompts };
