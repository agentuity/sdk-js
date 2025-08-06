import { POST } from './api';
import { getTracer, recordException } from '../router/router';
import { context, trace, SpanStatusCode } from '@opentelemetry/api';
import type { PromptService, PromptCompileResult } from '../types';



/**
 * Request model for prompt compilation
 */
export interface CompilePromptRequest {
	name: string;
	variables: Record<string, unknown>;
	version?: number;
}

/**
 * Response model for prompt compilation
 */
export interface CompilePromptResponse {
	success: boolean;
	data?: PromptCompileResult;
	error?: string;
}

/**
 * Custom error for prompt compilation failures
 */
export class PromptCompileError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PromptCompileError';
	}
}

/**
 * A prompt client for compiling prompt templates with variables. This class provides
 * methods to interact with the Agentuity prompt management service, supporting
 * template compilation with variable substitution and version management.
 */
export default class PromptAPI implements PromptService {
	/**
	 * Compile a prompt template with the provided variables.
	 *
	 * @param request - The prompt compilation request
	 * @param request.name - The name of the prompt template
	 * @param request.variables - Dictionary of variables to substitute in the template
	 * @param request.version - Optional specific version to compile (defaults to active version)
	 * @returns The compiled prompt with metadata
	 * @throws PromptCompileError if the compilation fails or the prompt is not found
	 */
	async compile(request: {
		name: string;
		variables: Record<string, unknown>;
		version?: number;
	}): Promise<PromptCompileResult> {
		const tracer = getTracer();
		const currentContext = context.active();

		// Create a child span using the current context
		const span = tracer.startSpan('agentuity.prompt.compile', {}, currentContext);

		try {
			// Create a new context with the child span
			const spanContext = trace.setSpan(currentContext, span);

			// Execute the operation within the new context
			return await context.with(spanContext, async () => {
			const { name, variables, version } = request;
			
			span.setAttribute('prompt.name', name);
			span.setAttribute('prompt.variables_count', Object.keys(variables).length);
			if (version !== undefined) {
			 span.setAttribute('prompt.version', version);
			}

			// Validate inputs
			if (!name || typeof name !== 'string') {
			 throw new PromptCompileError('Prompt name must be a non-empty string');
			}

			if (!variables || typeof variables !== 'object') {
			 throw new PromptCompileError('Variables must be an object');
			}

			if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
			 throw new PromptCompileError('Version must be a positive integer');
			}

			// Prepare request payload
			const requestPayload: CompilePromptRequest = {
			name,
			variables,
			 ...(version !== undefined && { version }),
			};

				const resp = await POST<CompilePromptResponse>(
				'/prompt/2025-03-17/compile',
				JSON.stringify(requestPayload),
				{
				'Content-Type': 'application/json',
				}
				);

				if (resp.status === 200) {
					if (resp.json?.success && resp.json.data) {
						span.setStatus({ code: SpanStatusCode.OK });
						span.setAttribute('prompt.id', resp.json.data.promptId);
						span.setAttribute('prompt.compiled_version', resp.json.data.version);

						return resp.json.data;
					}

					const errorMessage = resp.json?.error || 'Unknown error during compilation';
					span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
					throw new PromptCompileError(`Prompt compilation failed: ${errorMessage}`);
				}

				const body = await resp.response.text();
				span.setStatus({ code: SpanStatusCode.ERROR, message: body });
				throw new PromptCompileError(
					`Failed to compile prompt: ${resp.response.statusText} (${resp.response.status}) ${body}`
				);
			});
		} catch (ex) {
			recordException(span, ex);
			throw ex;
		} finally {
			span.end();
		}
	}
}
