import crypto from 'crypto';
import PatchPortal from '../apis/patchportal.js';
import { internal } from '../logger/internal';
import { hashSync } from './hash.js';

export interface PromptAttributesParams {
	slug: string;
	compiled: string;
	template: string;
	variables?: Record<string, string>;
	evals?: string[];
}

export interface PromptAttributes extends PromptAttributesParams {
	templateHash: string;
	compiledHash: string;
}
[];

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
		evals: attributes.evals,
	});

	const patchPortal = await PatchPortal.getInstance();
	internal.debug('✅ PatchPortal instance obtained');

	// Generate hash
	const templateHash = hashSync(attributes.template);
	internal.debug('🔑 Template hash:', templateHash);

	const compiledHash = hashSync(attributes.compiled);

	internal.debug('🔑 Compiled hash:', compiledHash);

	// Create metadata object
	const metadata = {
		...attributes,
		templateHash,
		compiledHash,
	};

	internal.debug('📦 Created metadata object:', {
		slug: metadata.slug,
		templateHash: metadata.templateHash,
		compiledHash: metadata.compiledHash,
		evals: metadata.evals,
		timestamp: new Date().toISOString(),
	});

	// Store in PatchPortal using compiled hash as key
	const key = `prompt:${compiledHash}`;
	internal.debug('🔑 Storing with key:', key);

	await patchPortal.set(key, [metadata]);
	internal.debug('✅ Metadata stored successfully in PatchPortal');

	// Print state after storing
	internal.debug('📊 PatchPortal state after storing:');
	patchPortal.printState();
}

/**
 * Process a prompt and store its metadata in PatchPortal
 */
export async function processPromptMetadataConcat(
	comiledPrompts: string[]
): Promise<string> {
	const compiledPromptsString = comiledPrompts.join('');
	const patchPortal = await PatchPortal.getInstance();
	let combinedMetadata = await Promise.all(
		comiledPrompts.map(async (compiledPrompt) => {
			const compiledHash = crypto
				.createHash('sha256')
				.update(compiledPrompt)
				.digest('hex');
			const metadata = await patchPortal.get<PromptAttributes[]>(
				`prompt:${compiledHash}`
			);
			if (!metadata || metadata.length === 0) {
				return null;
			}
			return metadata[0];
		})
	);
	combinedMetadata = combinedMetadata.filter((metadata) => metadata !== null);

	const newCompiledHash = crypto
		.createHash('sha256')
		.update(comiledPrompts.join(''))
		.digest('hex');

	internal.debug('🔑 New compiled hash:', newCompiledHash);
	internal.debug('🔑 New combined metadata:', combinedMetadata);

	await patchPortal.set(`prompt:${newCompiledHash}`, combinedMetadata);

	patchPortal.printState();
	return compiledPromptsString;
}
