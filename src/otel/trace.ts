import {
	type Context,
	type TextMapPropagator,
	type TextMapSetter,
	type TextMapGetter,
	type SpanContext,
	trace,
	TraceFlags,
} from '@opentelemetry/api';

const AGENTUITY_TRACE_ID = 'x-agentuity-trace-id';
const AGENTUITY_PARENT_ID = 'x-agentuity-parent-id';

class MyCarrier implements Context {
	private values: Record<string, unknown> = {};
	/**
	 * Get a value from the context.
	 *
	 * @param key key which identifies a context value
	 */
	getValue(key: symbol): unknown {
		return this.values[String(key).toLowerCase()];
	}
	/**
	 * Create a new context which inherits from this context and has
	 * the given key set to the given value.
	 *
	 * @param key context key for which to set the value
	 * @param value value to set for the given key
	 */
	setValue(key: symbol, value: unknown): Context {
		this.values[String(key).toLowerCase()] = value;
		return this;
	}
	/**
	 * Return a new context which inherits from this context but does
	 * not contain a value for the given key.
	 *
	 * @param key context key for which to clear a value
	 */
	deleteValue(key: symbol): Context {
		delete this.values[String(key).toLowerCase()];
		return this;
	}
}

export default class AgentuityIdPropagator
	implements TextMapPropagator<MyCarrier>
{
	inject(
		ctx: Context,
		carrier: MyCarrier,
		setter: TextMapSetter<MyCarrier>
	): void {
		const activeSpan = trace.getSpan(ctx);
		if (activeSpan?.isRecording()) {
			const spanContext = activeSpan.spanContext();
			if (spanContext.traceId) {
				setter.set(carrier, AGENTUITY_TRACE_ID, spanContext.traceId);
			}
			if (spanContext.spanId) {
				setter.set(carrier, AGENTUITY_PARENT_ID, spanContext.spanId);
			}
		}
	}

	extract(
		ctx: Context,
		carrier: MyCarrier,
		getter: TextMapGetter<MyCarrier>
	): Context {
		const traceId = getter.get(carrier, AGENTUITY_TRACE_ID);
		const parentId = getter.get(carrier, AGENTUITY_PARENT_ID);
		if (traceId && typeof traceId === 'string' && traceId.length === 32) {
			// Valid trace IDs are 16 bytes (32 hex chars)
			// Create a new span context with the extracted traceId
			// Generate a new spanId if we don't have a parentId
			const spanId =
				parentId && typeof parentId === 'string' && parentId.length === 32
					? parentId
					: this.generateSpanId();

			const spanContext: SpanContext = {
				traceId,
				spanId,
				traceFlags: TraceFlags.SAMPLED,
				isRemote: true,
			};

			// Set the span context in the context
			return trace.setSpanContext(ctx, spanContext);
		}
		return ctx;
	}

	fields(): string[] {
		return [AGENTUITY_TRACE_ID, AGENTUITY_PARENT_ID];
	}

	/**
	 * Generates a random span ID (8 bytes as 16 hex characters)
	 */
	private generateSpanId(): string {
		const bytes = new Uint8Array(8);
		crypto.getRandomValues(bytes);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}
}
