// Main entry point for prompts - following POC pattern exactly

import { prompts } from './generated/_index.js';
import { PromptConfig, PromptName } from './generated/index.ts';

export default class PromptAPI {
	public prompts: typeof prompts;

	constructor() {
		// Initialize with generated prompts (following POC pattern exactly)
		this.prompts = prompts;

		// Warn if no prompts are available (clean state)
		if (Object.keys(prompts).length === 0) {
			console.warn(
				'⚠️  No generated prompts found. Run `agentuity bundle` to generate prompts from src/prompts.yaml'
			);
		}
	}
}

// Re-export generated types and prompts (following POC pattern)
export { prompts, PromptConfig, PromptName };
export * from './generated/index.js';
