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
	// biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
			const { evalFn } = await this.loadEval(evalName);

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
