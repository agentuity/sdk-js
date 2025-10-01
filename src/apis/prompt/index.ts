// Main entry point for prompts - following POC pattern exactly

import { PromptConfig, PromptName } from './generated/_index.js';

// Default empty prompts object
const defaultPrompts = {};

export default class PromptAPI {
	public prompts: typeof defaultPrompts;

	constructor() {
		// Initialize with empty prompts by default
		this.prompts = defaultPrompts;
	}

	// Method to load prompts dynamically (called by context)
	public async loadPrompts(): Promise<void> {
		// console.log('loadPrompts() called');
		try {
			// Try multiple possible paths for the generated prompts
			let generatedModule: any;

			// Skip relative path - doesn't work in bundled environment
			// Try absolute path from node_modules
			const path = require('path');
			const fs = require('fs');

			// Look for the generated file in common locations
			const possiblePaths = [
				path.join(
					process.cwd(),
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
					process.cwd(),
					'node_modules',
					'@agentuity',
					'sdk',
					'src',
					'apis',
					'prompt',
					'generated',
					'_index.js'
				),
			];

			// console.log('Trying absolute paths:');
			for (const possiblePath of possiblePaths) {
				// console.log('  Checking:', possiblePath);
				// console.log('  Exists:', fs.existsSync(possiblePath));
				if (fs.existsSync(possiblePath)) {
					delete require.cache[possiblePath];
					generatedModule = require(possiblePath);
					// console.log('  Successfully loaded from:', possiblePath);
					break;
				}
			}

			if (!generatedModule) {
				throw new Error('Generated prompts file not found');
			}

			// console.log('Generated module:', generatedModule);
			// console.log(
			// 	'Prompts in module:',
			// 	Object.keys(generatedModule.prompts || {})
			// );
			this.prompts = generatedModule.prompts || defaultPrompts;
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
export { defaultPrompts as prompts, PromptConfig, PromptName };
export * from './generated/index.js';
