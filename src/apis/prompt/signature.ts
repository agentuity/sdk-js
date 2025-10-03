import type { Prompt, PromptSignature } from './generic_types.js';

/**
 * Creates a signature function for a specific prompt type
 * The function signature adapts based on whether the prompt has system, prompt, and variables
 */
export function createPromptSignature<T extends Prompt>(
	_prompt: T
): PromptSignature<T> {
	// This is a type-safe wrapper that will be replaced by the CLI with actual implementation
	// The CLI will generate the appropriate function based on the prompt's structure

	// For now, return a generic function that handles all cases
	// The CLI will replace this with the specific implementation
	return ((..._args: unknown[]) => {
		// This will be replaced by the CLI with the actual template compilation logic
		throw new Error(
			'Generated signature function not found. Run `agentuity bundle` to generate prompts.'
		);
	}) as unknown as PromptSignature<T>;
}

/**
 * Type-safe prompt signature factory
 * This function creates signature functions that match the exact structure of each prompt
 */
export function createPromptSignatures<T extends Record<string, Prompt>>(
	prompts: T
): {
	[K in keyof T]: PromptSignature<T[K]>;
} {
	const signatures = {} as any;

	for (const [key, prompt] of Object.entries(prompts)) {
		signatures[key] = createPromptSignature(prompt);
	}

	return signatures;
}

/**
 * Utility type to extract the signature function type for a specific prompt
 */
export type GetPromptSignature<T extends Prompt> = PromptSignature<T>;

/**
 * Utility type to extract all signature functions from a prompts collection
 */
export type GetPromptSignatures<T extends Record<string, Prompt>> = {
	[K in keyof T]: PromptSignature<T[K]>;
};
