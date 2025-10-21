import {
	context,
	SpanStatusCode,
	type Tracer,
	trace,
} from '@opentelemetry/api';
import EvalAPI from '../apis/eval';
import EvalJobScheduler from '../apis/evaljobscheduler';
import { markSessionCompleted } from '../apis/session';
import type { Logger } from '../logger';

let running = 0;
export function isIdle(): boolean {
	return running === 0;
}

export default class AgentContextWaitUntilHandler {
	private promises: Promise<void>[];
	private tracer: Tracer;
	private started: number | undefined;
	private hasCalledWaitUntilAll = false;

	public constructor(tracer: Tracer) {
		this.tracer = tracer;
		this.promises = [];
		this.hasCalledWaitUntilAll = false;
	}

	public waitUntil(
		promise: Promise<void> | (() => void | Promise<void>)
	): void {
		if (this.hasCalledWaitUntilAll) {
			throw new Error(
				'Cannot call waitUntil after waitUntilAll has been called'
			);
		}
		const currentContext = context.active();

		// Start execution immediately, don't defer it
		const executingPromise = (async () => {
			running++;
			if (this.started === undefined) {
				this.started = Date.now(); /// this first execution marks the start time
			}
			const span = this.tracer.startSpan('waitUntil', {}, currentContext);
			const spanContext = trace.setSpan(currentContext, span);
			try {
				await context.with(spanContext, async () => {
					const resolvedPromise =
						typeof promise === 'function' ? promise() : promise;
					return await Promise.resolve(resolvedPromise);
				});
				span.setStatus({ code: SpanStatusCode.OK });
			} catch (ex: unknown) {
				span.recordException(ex as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				throw ex;
			} finally {
				span.end();
			}
			// NOTE: we only decrement when the promise is removed from the array in waitUntilAll
		})();

		// Store the executing promise for cleanup tracking
		this.promises.push(executingPromise);
	}

	public hasPending(): boolean {
		return this.promises.length > 0;
	}

	public async waitUntilAll(logger: Logger, sessionId: string): Promise<void> {
		logger.info(`🔍 waitUntilAll() called for session ${sessionId}`);

		if (this.hasCalledWaitUntilAll) {
			throw new Error('waitUntilAll can only be called once per instance');
		}
		this.hasCalledWaitUntilAll = true;

		if (this.promises.length === 0) {
			logger.info('📭 No promises to wait for, executing evals directly');
			// Execute evals even if no promises
			await this.executeEvalsForSession(logger, sessionId);
			return;
		}

		logger.info(
			`⏳ Waiting for ${this.promises.length} promises to complete...`
		);
		try {
			// Promises are already executing, just wait for them to complete
			await Promise.all(this.promises);
			const duration = Date.now() - (this.started as number);
			logger.info('✅ All promises completed, marking session completed');
			await markSessionCompleted(sessionId, duration);

			// Execute evals after session completion
			logger.info('🚀 Starting eval execution after session completion');
			await this.executeEvalsForSession(logger, sessionId);
		} catch (ex) {
			logger.error('error sending session completed', ex);
		} finally {
			running -= this.promises.length;
			this.promises.length = 0;
		}
	}

	/**
	 * Execute evals for the completed session
	 */
	private async executeEvalsForSession(
		logger: Logger,
		sessionId: string
	): Promise<void> {
		try {
			logger.info(`🔍 Starting eval execution for session ${sessionId}`);

			// Get pending eval jobs for this session
			logger.info('🔍 Getting EvalJobScheduler instance...');
			const evalJobScheduler = await EvalJobScheduler.getInstance();
			logger.info('✅ EvalJobScheduler instance obtained');

			logger.info(`🔍 Querying jobs for session ${sessionId}...`);
			const jobs = evalJobScheduler.getJobs({ sessionId });

			if (jobs.length === 0) {
				logger.info(`📭 No eval jobs found for session ${sessionId}`);
				return;
			}

			logger.info(`📋 Found ${jobs.length} eval jobs for session ${sessionId}`);

			// Load eval metadata map
			logger.info('🔧 Loading eval metadata map...');
			const evalAPI = new EvalAPI();
			const evalMetadataMap = await evalAPI.loadEvalMetadataMap();
			logger.info(`📚 Loaded ${evalMetadataMap.size} eval mappings`);

			// Execute evals for each job
			let totalEvalsExecuted = 0;
			for (let i = 0; i < jobs.length; i++) {
				const job = jobs[i];
				logger.info(
					`🎯 Processing job ${i + 1}/${jobs.length} (spanId: ${job.spanId})`
				);
				const evalsInJob = await this.executeEvalsForJob(
					logger,
					job,
					evalAPI,
					evalMetadataMap
				);
				totalEvalsExecuted += evalsInJob;
				logger.info(
					`✅ Completed job ${i + 1}/${jobs.length}: ${evalsInJob} evals executed`
				);
			}

			logger.info(
				`✅ Completed eval execution for session ${sessionId}: ${totalEvalsExecuted} evals executed`
			);

			// Clean up completed jobs
			logger.info(`🧹 Cleaning up ${jobs.length} completed jobs...`);
			for (const job of jobs) {
				evalJobScheduler.removeJob(job.spanId);
			}
			logger.info(`✅ Cleaned up ${jobs.length} completed jobs`);
		} catch (error) {
			logger.error('❌ Error executing evals for session:', error);
		}
	}

	/**
	 * Execute evals for a specific job
	 */
	private async executeEvalsForJob(
		logger: Logger,
		job: {
			spanId: string;
			sessionId: string;
			promptMetadata: Array<{ evals?: string[] }>;
			input?: string;
			output?: string;
		},
		evalAPI: EvalAPI,
		evalMetadataMap: Map<string, string>
	): Promise<number> {
		let evalsExecuted = 0;

		logger.info(
			`🎯 Processing job ${job.spanId} with ${job.promptMetadata.length} prompt metadata entries`
		);

		for (const promptMeta of job.promptMetadata || []) {
			if (!promptMeta.evals || promptMeta.evals.length === 0) {
				logger.debug('⏭️  Skipping prompt metadata with no evals');
				continue;
			}

			logger.info(
				`📝 Found ${promptMeta.evals.length} evals for prompt: ${promptMeta.evals.join(', ')}`
			);

			for (const evalSlug of promptMeta.evals) {
				try {
					logger.info(
						`🚀 Running eval '${evalSlug}' for session ${job.sessionId}`
					);

					const result = await evalAPI.runEval(
						evalSlug,
						job.input || '',
						job.output || '',
						job.sessionId,
						job.spanId
					);

					if (result.success) {
						logger.info(`✅ Successfully executed eval '${evalSlug}'`);
						evalsExecuted++;
					} else {
						logger.warn(
							`⚠️  Eval '${evalSlug}' completed but returned error: ${result.message}`
						);
					}
				} catch (error) {
					logger.error(`❌ Failed to execute eval '${evalSlug}':`, error);
					// Continue with other evals even if one fails
				}
			}
		}

		logger.info(
			`📊 Job ${job.spanId} completed: ${evalsExecuted} evals executed`
		);
		return evalsExecuted;
	}
}
