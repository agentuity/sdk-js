import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { internal } from '../logger/internal';

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
	 * Run eval with input/output/sessionId
	 */
	async runEval(
		evalName: string,
		input: string,
		output: string,
		sessionId: string
	): Promise<EvalResult> {
		internal.debug(`Running eval ${evalName} for session ${sessionId}`);

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

		const context: EvalContext = {};

		// Load and run eval function
		const evaluate = await this.loadEval(evalName);
		await evaluate(context, request, response);

		// Create result
		const result: EvalResult = {
			sessionId,
			resultType,
			scoreValue,
			metadata,
			timestamp: new Date(),
		};

		internal.debug(
			`Eval complete for session ${sessionId} -> ${resultType}${scoreValue !== undefined ? ` (${scoreValue})` : ''}`
		);

		return result;
	}
}
