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

export type EvalFunction = (
	ctx: EvalContext,
	req: EvalRequest,
	res: EvalResponse
) => Promise<void>;

// Eval result types
interface BaseEvalRunResult {
	evalId: string;
	sessionId: string;
	timestamp: Date;
}

export type EvalRunResultBinary = BaseEvalRunResult & {
	success: true;
	passed: boolean;
	metadata: {
		reason: string;
		[key: string]: any;
	};
};

export type EvalRunResultScore = BaseEvalRunResult & {
	success: true;
	score: number; // 0-1 range
	metadata: {
		reason: string;
		[key: string]: any;
	};
};

export type EvalRunResultError = BaseEvalRunResult & {
	success: false;
	error: string;
};

export type EvalResult =
	| EvalRunResultBinary
	| EvalRunResultScore
	| EvalRunResultError;

// Request for storing eval run in DB
interface StoreEvalRunRequest {
	projectId: string;
	sessionId: string;
	spanId: string;
	result: EvalResult;
	evalId?: string | null;
	promptHash?: string | null;
}

// Response from storing eval run
interface StoreEvalRunResponse {
	success: boolean;
	data?: {
		id: string;
	};
	message?: string;
}

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
	 * Store eval run result in database
	 */
	private async storeEvalRun(
		evalId: string,
		projectId: string,
		sessionId: string,
		spanId: string,
		result: EvalResult
	): Promise<void> {
		try {
			const payload: StoreEvalRunRequest = {
				projectId,
				sessionId,
				spanId,
				result,
				evalId: evalId,
				promptHash: null, // TODO: Add prompt hash when available
			};

			const url = '/evalrun/2025-03-17';
			console.log('BOBBY!! Storing eval run with evalId:', evalId);
			console.log('BOBBY!! Full payload:', JSON.stringify(payload, null, 2));
			internal.debug(`Storing eval run for eval ID: ${evalId}`);

			const resp = await POST<StoreEvalRunResponse>(
				url,
				JSON.stringify(payload),
				{
					'Content-Type': 'application/json',
					Accept: 'application/json',
				},
				undefined,
				undefined,
				'eval'
			);

			if (resp.status === 200 || resp.status === 201) {
				internal.debug(`Eval run stored successfully: ${resp.json?.data?.id}`);
			} else {
				internal.error(
					`Failed to store eval run: ${resp.status} ${resp.json?.message}`
				);
			}
		} catch (error) {
			internal.error(`Error storing eval run: ${error}`);
			// Don't throw - we don't want to fail the eval if storage fails
		}
	}

	/**
	 * Load eval function and metadata from eval name
	 */
	async loadEval(
		evalName: string
	): Promise<{ evalFn: EvalFunction; metadata?: { id: string } }> {
		// For bundled code, eval files are .js in .agentuity/
		// For dev code, eval files are .ts in src/evals/
		const evalFile = this.isBundled ? `${evalName}.js` : evalName;
		const evalPath = path.join(this.evalsDir, evalFile);

		internal.debug(`Loading eval function from ${evalPath}`);

		try {
			// Convert to file URL for proper ESM import
			const fileUrl = pathToFileURL(evalPath).href;
			const module = await import(fileUrl);
			return {
				evalFn: module.default,
				metadata: module.metadata,
			};
		} catch (error) {
			throw new Error(
				`Failed to load eval function from ${evalPath}: ${error}`
			);
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
		evalId?: string
	): Promise<EvalResult> {
		console.log(`Running eval ${evalName} for session ${sessionId}`);

		// Get project ID from environment
		const projectId = process.env.AGENTUITY_CLOUD_PROJECT_ID || '';

		const request: EvalRequest = {
			input,
			output,
			sessionId,
		};

		// Prepare response tracking
		let result: EvalResult | null = null;
		const timestamp = new Date();

		const evalContext: EvalContext = {};

		// Load and run eval function
		console.log('loading eval function');

		try {
			const { evalFn, metadata: evalMetadata } = await this.loadEval(evalName);
			const finalEvalId = evalId || evalMetadata?.id || evalName;

			const response: EvalResponse = {
				pass: (
					value: boolean,
					meta?: { reasoning?: string; [key: string]: unknown }
				) => {
					result = {
						success: true,
						passed: value,
						metadata: {
							reason: meta?.reasoning || '',
							...meta,
						},
						evalId: finalEvalId,
						sessionId,
						timestamp,
					};
				},
				score: (
					val: number,
					meta?: { reasoning?: string; [key: string]: unknown }
				) => {
					result = {
						success: true,
						score: val,
						metadata: {
							reason: meta?.reasoning || '',
							...meta,
						},
						evalId: finalEvalId,
						sessionId,
						timestamp,
					};
				},
			};

			await evalFn(evalContext, request, response);

			// If no result was set, create an error result
			if (!result) {
				result = {
					success: false,
					error: 'Eval function did not call res.pass() or res.score()',
					evalId: finalEvalId,
					sessionId,
					timestamp,
				};
			}

			console.log('BOBBY!! Eval result:', result);

			// Store result in database (non-blocking)
			if (projectId && spanId) {
				console.log(
					'writing eval result to database with evalId:',
					finalEvalId
				);
				this.storeEvalRun(
					finalEvalId,
					projectId,
					sessionId,
					spanId,
					result
				).catch((error) => {
					internal.error(`Failed to store eval run: ${error}`);
				});
			} else {
				internal.warn('Skipping eval storage - missing projectId or spanId');
			}

			return result;
		} catch (error) {
			// Return error result if eval function throws
			result = {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				evalId: evalName,
				sessionId,
				timestamp,
			};

			console.log('BOBBY!! Eval error:', result);
			return result;
		}
	}
}
