import type { PromptStorage } from '../types';

/**
 * This class get patched in the CLI to get its prompt function.
 */
export default class PromptAPI implements PromptStorage {
	test(): Promise<string> {
		throw new Error('Method not implemented.');
	}
}
