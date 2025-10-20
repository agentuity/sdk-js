import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { internal } from '../logger/internal';
import { POST } from './api';

// Eval SDK types
export interface EvalRequest {
	input: string;
	output: string;
	sessionId: string;
}

export interface EvalResponse {
	pass: (
		value: boolean,
		metadata?: { reasoning?: string; [key: string]: unknown }
	) => void;
	score: (
		value: number,
		metadata?: { reasoning?: string; [key: string]: unknown }
	) => void; // 0 to 1
}

export interface EvalContext {
	// optional for now
	[key: string]: unknown;
}
export type EvalRunResultMetadata = {
	reason: string;
	// biome-ignore lint/suspicious/noExplicitAny: metadata can contain any type of data
	[key: string]: any;
};

type BaseEvalRunResult = {
	success: boolean;
	metadata?: EvalRunResultMetadata;
};

export type EvalRunResultBinary = BaseEvalRunResult & {
	success: true;
	passed: boolean;
	metadata: EvalRunResultMetadata;
};

export type EvalRunResultScore = BaseEvalRunResult & {
	success: true;
	score: number; // 0-1 range
	metadata: EvalRunResultMetadata;
};

export type EvalRunResultError = BaseEvalRunResult & {
	success: false;
	error: string;
};

export type EvalRunResult =
	| EvalRunResultBinary
	| EvalRunResultScore
	| EvalRunResultError;

export type CreateEvalRunRequest = {
	projectId: string;
	sessionId: string;
	spanId: string;
	result: EvalRunResult;
	evalId: string;
	promptHash?: string;
};

type EvalFunction = (
	ctx: EvalContext,
	req: EvalRequest,
	res: EvalResponse
) => Promise<void>;

type CreateEvalRunResponse =
	| {
			success: true;
			data: {
				id: string;
			};
	  }
	| {
			success: false;
			message: string;
	  };

export default class EvalAPI {
	private evalsDir: string;
	private isBundled: boolean;

	constructor(evalsDir?: string) {
		// Check if we're running from bundled code (.agentuity directory)
		const bundledDir = path.join(process.cwd(), '.agentuity', 'src', 'evals');
		const sourceDir = path.join(process.cwd(), 'src', 'evals');
		this.isBundled = fs.existsSync(bundledDir);

		// Use .agentuity/src/evals for bundled code, src/evals for development
		this.evalsDir = evalsDir || (this.isBundled ? bundledDir : sourceDir);

		internal.debug(
			`EvalAPI initialized with evalsDir: ${this.evalsDir}, isBundled: ${this.isBundled}`
		);
	}

	/**
	 * Load eval function and metadata by ID
	 * Scans through all eval files to find the one with matching ID
	 */
	async loadEvalById(evalId: string): Promise<{
		evalFn: EvalFunction;
		metadata?: { id: string; slug: string; name: string; description: string };
	}> {
		internal.debug(`Loading eval by ID: ${evalId}`);

		try {
			// Get all files in the evals directory
			const files = fs.readdirSync(this.evalsDir);

			for (const file of files) {
				// Skip index files and non-eval files
				if (file === 'index.ts' || file === 'index.js') {
					continue;
				}

				// Check file extension based on bundled state
				const expectedExt = this.isBundled ? '.js' : '.ts';
				if (!file.endsWith(expectedExt)) {
					continue;
				}

				const filePath = path.join(this.evalsDir, file);

				try {
					// Convert to file URL for proper ESM import
					const fileUrl = pathToFileURL(filePath).href;
					const module = await import(fileUrl);

					// Check if this module has the matching ID
					if (module.metadata && module.metadata.id === evalId) {
						internal.debug(`Found eval with ID ${evalId} in file ${file}`);
						return {
							evalFn: module.default,
							metadata: module.metadata,
						};
					}
				} catch (error) {
					// Skip files that can't be imported (might not be eval files)
					internal.debug(`Skipping file ${file} due to import error: ${error}`);
				}
			}

			throw new Error(`No eval found with ID: ${evalId}`);
		} catch (error) {
			throw new Error(`Failed to load eval by ID ${evalId}: ${error}`);
		}
	}

	/**
	 * Run eval with input/output/sessionId/spanId
	 */
	async runEval(
		evalName: string,
		input: string,
		output: string,
		sessionId: string,
		spanId: string,
		evalId: string,
		promptHash?: string
	): Promise<CreateEvalRunResponse> {
		internal.debug(`Running eval ${evalName} for session ${sessionId}`);
		// Get project ID from environment
		const projectId = process.env.AGENTUITY_CLOUD_PROJECT_ID || '';

		const request: EvalRequest = {
			input,
			output,
			sessionId,
		};

		let createEvalRunRequest: CreateEvalRunRequest | null = null;
		const evalContext: EvalContext = {};

		// Load and run eval function
		internal.debug('loading eval function');

		try {
			// Try to load by ID first, fallback to name
			const { evalFn } = await this.loadEvalById(evalId);

			const response: EvalResponse = {
				pass: (
					value: boolean,
					meta?: { reasoning?: string; [key: string]: unknown }
				) => {
					createEvalRunRequest = {
						projectId,
						sessionId,
						spanId,
						result: {
							success: true,
							passed: value,
							metadata: {
								reason: meta?.reasoning || '',
								...meta,
							},
						},
						evalId,
						promptHash,
					};
				},
				score: (
					val: number,
					meta?: { reasoning?: string; [key: string]: unknown }
				) => {
					createEvalRunRequest = {
						projectId,
						sessionId,
						spanId,
						result: {
							success: true,
							score: val,
							metadata: {
								reason: meta?.reasoning || '',
								...meta,
							},
						},
						evalId,
						promptHash,
					};
				},
			};

			await evalFn(evalContext, request, response);

			// If no result was set, create an error result
			if (!createEvalRunRequest) {
				throw new Error('Eval function did not call res.pass() or res.score()');
			}

			const resp = await POST<CreateEvalRunResponse>(
				`/_agentuity/eval/${evalId}/runs`,
				JSON.stringify(createEvalRunRequest),
				{
					'Content-Type': 'application/json',
				}
			);

			if (!resp.json?.success) {
				throw new Error('Failed to create eval run');
			}

			return resp.json;
		} catch (error) {
			// Return error result if eval function throws
			return {
				success: false,
				message: error instanceof Error ? error.message : String(error),
			};
		}
	}
}
