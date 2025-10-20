import { internal } from '../logger/internal';
import type { PromptAttributes } from '../utils/promptMetadata';

// Global instance storage to ensure true singleton across all module contexts
declare global {
	var __evalJobSchedulerInstance: EvalJobScheduler | undefined;
}

export interface PendingEvalJob {
	spanId: string;
	sessionId: string;
	promptMetadata: PromptAttributes[];
	output?: string;
	createdAt: string;
}

export interface JobFilter {
	sessionId?: string;
}

/**
 * Singleton class for EvalJobScheduler
 */
export default class EvalJobScheduler {
	private pendingJobs: Map<string, PendingEvalJob> = new Map();
	private instanceId: string;

	private constructor() {
		// Private constructor to prevent direct instantiation
		this.instanceId = `EvalJobScheduler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		internal.debug(
			'🏗️ EvalJobScheduler constructor called, instanceId:',
			this.instanceId
		);
	}

	/**
	 * Get the singleton instance of EvalJobScheduler
	 */
	public static async getInstance(): Promise<EvalJobScheduler> {
		internal.debug('🔍 EvalJobScheduler.getInstance() called');
		internal.debug(
			'🔍 globalThis.__evalJobSchedulerInstance exists:',
			!!globalThis.__evalJobSchedulerInstance
		);

		if (!globalThis.__evalJobSchedulerInstance) {
			globalThis.__evalJobSchedulerInstance = new EvalJobScheduler();
			internal.debug(
				'🆕 Created new EvalJobScheduler instance, ID:',
				globalThis.__evalJobSchedulerInstance.instanceId
			);
		} else {
			internal.debug(
				'♻️ Returning existing EvalJobScheduler instance, ID:',
				globalThis.__evalJobSchedulerInstance.instanceId
			);
		}
		return globalThis.__evalJobSchedulerInstance;
	}

	/**
	 * Create a new eval job
	 */
	public createJob(
		spanId: string,
		sessionId: string,
		promptMetadata: PromptAttributes[]
	): string {
		internal.debug('🔍 EvalJobScheduler.createJob() called with:', {
			spanId,
			sessionId,
			promptMetadataCount: promptMetadata.length,
		});

		const now = new Date().toISOString();

		// Check if job already exists
		if (this.pendingJobs.has(spanId)) {
			internal.debug('⚠️ Job already exists, overwriting:', spanId);
		}

		const job: PendingEvalJob = {
			spanId,
			sessionId,
			promptMetadata,
			createdAt: now,
		};

		this.pendingJobs.set(spanId, job);
		internal.debug('✅ Job created successfully:', spanId);
		internal.debug('📊 Total jobs:', this.pendingJobs.size);

		return spanId;
	}

	/**
	 * Remove a job
	 */
	public removeJob(spanId: string): boolean {
		internal.debug('🔍 EvalJobScheduler.removeJob() called with:', spanId);
		const removed = this.pendingJobs.delete(spanId);
		internal.debug('🔍 Job removed:', removed);
		return removed;
	}

	/**
	 * Get jobs with optional filtering
	 */
	public getJobs(filter?: JobFilter): PendingEvalJob[] {
		internal.debug('🔍 EvalJobScheduler.getJobs() called with filter:', filter);

		let jobs = Array.from(this.pendingJobs.values());

		if (filter?.sessionId) {
			jobs = jobs.filter((job) => job.sessionId === filter.sessionId);
		}

		internal.debug('🔍 Found jobs:', jobs.length);
		return jobs;
	}

	/**
	 * Print out the whole state of the EvalJobScheduler
	 */
	public printState(): void {
		internal.debug('🔍 EvalJobScheduler.printState() called');
		internal.debug('🔍 Instance ID:', this.instanceId);
		internal.debug('🔍 EvalJobScheduler State:');
		internal.debug('📊 Total jobs:', this.pendingJobs.size);
		internal.debug('📋 Job IDs:', Array.from(this.pendingJobs.keys()));
		internal.debug(
			'📦 All jobs:',
			JSON.stringify(Array.from(this.pendingJobs.values()), null, 2)
		);
		internal.debug(
			'🔍 Global instance check:',
			globalThis.__evalJobSchedulerInstance === this
		);
	}

	/**
	 * Get the instance ID
	 */
	public getInstanceId(): string {
		return this.instanceId;
	}
}
