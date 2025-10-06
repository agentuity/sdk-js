import { createClient } from '@clickhouse/client';
import { internal } from '../logger/internal';

// Eval SDK types
export interface EvalRequest {
	input: string;
	output: string;
	spanId: string;
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
	spanId: string;
	resultType: 'pass' | 'fail' | 'score';
	scoreValue?: number;
	metadata?: { reasoning?: string; [key: string]: unknown };
	timestamp: Date;
}

export interface EvalRunnerConfig {
	clickhouseHost: string;
	clickhouseUser: string;
	clickhousePassword: string;
	spansTable?: string;
	resultsTable?: string;
}

export default class EvalAPI {
	private config: EvalRunnerConfig;
	private client: ReturnType<typeof createClient>;

	constructor(config: EvalRunnerConfig) {
		this.config = {
			spansTable: 'spans',
			resultsTable: 'eval_results',
			...config,
		};

		this.client = createClient({
			host: this.config.clickhouseHost,
			username: this.config.clickhouseUser,
			password: this.config.clickhousePassword,
		});
	}

	/**
	 * Fetch span data from ClickHouse and transform it for eval
	 */
	async fetchSpan(spanId: string): Promise<EvalRequest> {
		internal.debug(`Fetching span ${spanId} from ClickHouse`);

		const query = `
      SELECT input, output
      FROM ${this.config.spansTable}
      WHERE spanId = {spanId:String}
      LIMIT 1
    `;

		const result = await this.client.query({
			query,
			query_params: { spanId },
		});

		const response = await result.json<{ input: string; output: string }>();
		const row = response.data?.[0];

		if (!row) {
			throw new Error(`No span found for id ${spanId}`);
		}

		return {
			input: row.input,
			output: row.output,
			spanId,
		};
	}

	/**
	 * Write eval result back to ClickHouse
	 */
	async writeResult(result: EvalResult): Promise<void> {
		internal.debug(`Writing eval result for span ${result.spanId}:`, result);

		await this.client.insert({
			table: this.config.resultsTable || 'eval_results',
			values: [
				{
					spanId: result.spanId,
					resultType: result.resultType,
					scoreValue: result.scoreValue ?? null,
					metadata: result.metadata ? JSON.stringify(result.metadata) : null,
					timestamp: result.timestamp.toISOString(),
				},
			],
			format: 'JSONEachRow',
		});
	}

	/**
	 * Load eval function from file path
	 */
	async loadEval(evalPath: string): Promise<EvalFunction> {
		internal.debug(`Loading eval function from ${evalPath}`);

		try {
			const module = await import(evalPath);
			return module.default;
		} catch (error) {
			throw new Error(
				`Failed to load eval function from ${evalPath}: ${error}`
			);
		}
	}

	/**
	 * Run eval on a span
	 */
	async runEval(spanId: string, evalPath: string): Promise<EvalResult> {
		internal.debug(`Running eval for span ${spanId} with function ${evalPath}`);

		// Load span data
		const request = await this.fetchSpan(spanId);

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
		const evaluate = await this.loadEval(evalPath);
		await evaluate(context, request, response);

		// Create result
		const result: EvalResult = {
			spanId,
			resultType,
			scoreValue,
			metadata,
			timestamp: new Date(),
		};

		// Write result to database
		await this.writeResult(result);

		internal.debug(
			`Eval complete for span ${spanId} -> ${resultType}${scoreValue !== undefined ? ` (${scoreValue})` : ''}`
		);

		return result;
	}

	/**
	 * Create the eval results table if it doesn't exist
	 */
	async createResultsTable(): Promise<void> {
		const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.config.resultsTable} (
        spanId String,
        resultType String,
        scoreValue Float64,
        metadata String,
        timestamp DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY (spanId, timestamp)
    `;

		await this.client.command({
			query: createTableQuery,
		});

		internal.debug(`Created eval results table: ${this.config.resultsTable}`);
	}
}
