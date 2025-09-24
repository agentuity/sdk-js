import {
	context,
	SpanStatusCode,
	trace,
	type Tracer,
} from '@opentelemetry/api';
import { markSessionCompleted } from '../apis/session';
import type { Logger } from '../logger';

let running = 0;
export function isIdle(): boolean {
	return running === 0;
}

export default class AgentContextWaitUntilHandler {
	private promises: (() => void | Promise<void>)[];
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
		this.promises.push(async () => {
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
		});
	}

	public hasPending(): boolean {
		return this.promises.length > 0;
	}

	public async waitUntilAll(logger: Logger, sessionId: string): Promise<void> {
		if (this.hasCalledWaitUntilAll) {
			throw new Error('waitUntilAll can only be called once per instance');
		}
		this.hasCalledWaitUntilAll = true;

		if (this.promises.length === 0) {
			return;
		}
		try {
			await Promise.all(this.promises.map((p) => p()));
			const duration = Date.now() - (this.started as number);
			await markSessionCompleted(sessionId, duration);
		} catch (ex) {
			logger.error('error sending session completed', ex);
		} finally {
			running -= this.promises.length;
			this.promises.length = 0;
		}
	}
}
