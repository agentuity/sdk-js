import crypto from 'crypto';
import PatchPortal from '../apis/patchportal.js';
import { internal } from '../logger/internal';

export interface PromptAttributesParams {
	slug: string;
	compiled: string;
	template: string;
	variables?: Record<string, string>;
}

export interface PromptAttributes extends PromptAttributesParams {
	hash: string;
	compiledHash: string;
}

/**
 * Process a prompt and store its metadata in PatchPortal
 */
export async function processPromptMetadata(
	attributes: PromptAttributesParams
): Promise<void> {
	internal.debug('🔧 processPromptMetadata called with:', {
		slug: attributes.slug,
		template: attributes.template?.substring(0, 50) + '...',
		compiled: attributes.compiled?.substring(0, 50) + '...',
		variables: attributes.variables,
	});

	const patchPortal = await PatchPortal.getInstance();
	internal.debug('✅ PatchPortal instance obtained');

	// Generate hash
	const hash = crypto
		.createHash('sha256')
		.update(attributes.template)
		.digest('hex');

	internal.debug('🔑 Template hash:', hash);

	const compiledHash = crypto
		.createHash('sha256')
		.update(attributes.compiled)
		.digest('hex');

	internal.debug('🔑 Compiled hash:', compiledHash);

	// Create metadata object
	const metadata = {
		...attributes,
		hash,
		compiledHash,
	};

	internal.debug('📦 Created metadata object:', {
		slug: metadata.slug,
		hash: metadata.hash,
		compiledHash: metadata.compiledHash,
		timestamp: new Date().toISOString(),
	});

	// Store in PatchPortal using compiled hash as key
	const key = `prompt:${compiledHash}`;
	internal.debug('🔑 Storing with key:', key);

	await patchPortal.set(key, metadata);
	internal.debug('✅ Metadata stored successfully in PatchPortal');

	// Print state after storing
	internal.debug('📊 PatchPortal state after storing:');
	patchPortal.printState();
}
