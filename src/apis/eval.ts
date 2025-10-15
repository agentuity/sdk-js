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
export interface EvalResult {
	sessionId: string;
	resultType: 'pass' | 'fail' | 'score';
	scoreValue?: number;
	metadata?: { reasoning?: string; [key: string]: unknown };
	timestamp: Date;
}

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
		evalName: string,
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
				evalId: evalName,
				promptHash: null, // TODO: Add prompt hash when available
			};

			const url = '/evalrun/2025-03-17';
			internal.debug(`Storing eval run for ${evalName}`);

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
	 * Load eval function from eval name
	 */
	async loadEval(evalName: string): Promise<EvalFunction> {
		// For bundled code, eval files are .js in .agentuity/
		// For dev code, eval files are .ts in src/evals/
		const evalFile = this.isBundled ? `${evalName}.js` : evalName;
		const evalPath = path.join(this.evalsDir, evalFile);

		internal.debug(`Loading eval function from ${evalPath}`);

		try {
			// Convert to file URL for proper ESM import
			const fileUrl = pathToFileURL(evalPath).href;
			const module = await import(fileUrl);
			return module.default;
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
		spanId: string
	): Promise<EvalResult> {
		console.log(`Running eval ${evalName} for session ${sessionId}`);

		// Get project ID from environment
		const projectId = process.env.AGENTUITY_CLOUD_PROJECT_ID || '';

		const request: EvalRequest = {
			input,
			output,
			sessionId,
		};

		// Prepare response object
		let resultType: 'pass' | 'fail' | 'score' = 'fail';
		let scoreValue: number | undefined;
		let metadata: { reasoning?: string; [key: string]: unknown } | undefined;

		const response: EvalResponse = {
			pass: (
				value: boolean,
				meta?: { reasoning?: string; [key: string]: unknown }
			) => {
				resultType = value ? 'pass' : 'fail';
				metadata = meta;
			},
			score: (
				val: number,
				meta?: { reasoning?: string; [key: string]: unknown }
			) => {
				resultType = 'score';
				scoreValue = val;
				metadata = meta;
			},
		};

		const evalContext: EvalContext = {};

		// Load and run eval function
		console.log('loading eval function');

		const evaluate = await this.loadEval(evalName);
		await evaluate(evalContext, request, response);

		// Create result
		const result: EvalResult = {
			sessionId,
			resultType,
			scoreValue,
			metadata,
			timestamp: new Date(),
		};

		console.log('BOBBY!! Eval result:', result);

		console.log(
			`Eval complete for session ${sessionId} -> ${resultType}${scoreValue !== undefined ? ` (${scoreValue})` : ''}`
		);

		// Store result in database (non-blocking)
		if (projectId && spanId) {
			console.log('writing eval result to database');
			// Don't await - fire and forget
			this.storeEvalRun(evalName, projectId, sessionId, spanId, result).catch(
				(error) => {
					internal.error(`Failed to store eval run: ${error}`);
				}
			);
		} else {
			internal.warn('Skipping eval storage - missing projectId or spanId');
		}

		return result;
	}
}
