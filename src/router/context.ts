import type { Tracer } from '@opentelemetry/api';
import { context, SpanStatusCode, trace } from '@opentelemetry/api';

export default class AgentContextWaitUntilHandler {
	private promises: (() => void | Promise<void>)[];
	private tracer: Tracer;

	public constructor(tracer: Tracer) {
		this.tracer = tracer;
		this.promises = [];
	}

	public waitUntil(promise: () => void | Promise<void>): void {
		const currentContext = context.active();
		this.promises.push(async () => {
			const span = this.tracer.startSpan('waitUntil', {}, currentContext);
			const spanContext = trace.setSpan(currentContext, span);
			try {
				await context.with(spanContext, async () => await promise());
				span.setStatus({ code: SpanStatusCode.OK });
			} catch (ex) {
				span.recordException(ex as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
			} finally {
				span.end();
			}
		});
	}

	public hasPending(): boolean {
		return this.promises.length > 0;
	}

	public async waitUntilAll(): Promise<void> {
		if (this.promises.length === 0) {
			return;
		}
		const currentContext = context.active();
		const span = this.tracer.startSpan('waitUntilAll', {}, currentContext);
		span.setAttribute('count', this.promises.length);
		const spanContext = trace.setSpan(currentContext, span);
		try {
			await context.with(spanContext, async () => {
				await Promise.all(this.promises.map((p) => p()));
			});
			span.setStatus({ code: SpanStatusCode.OK });
		} catch (ex) {
			span.recordException(ex as Error);
			span.setStatus({ code: SpanStatusCode.ERROR });
		} finally {
			span.end();
			this.promises.length = 0;
		}
	}
}
