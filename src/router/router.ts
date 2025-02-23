import type { ServerRoute, ServerRequest } from "../server/types";
import type { AgentHandler, AgentContext, AgentResponseType } from "../types";
import AgentRequest from "./request";
import AgentResponse from "./response";
import { SpanKind, type Exception } from "@opentelemetry/api";

interface RouterConfig {
	handler: AgentHandler;
	context: AgentContext;
}

export function createRouter(config: RouterConfig): ServerRoute["handler"] {
	return async (req: ServerRequest): Promise<AgentResponseType> => {
		return new Promise((resolve, reject) => {
			config.context.tracer.startActiveSpan(
				config.context.agent.name,
				{
					kind: SpanKind.SERVER,
					attributes: {
						agent: config.context.agent.name,
						runId: req.request.runId,
						deploymentId: config.context.deploymentId,
						projectId: config.context.projectId,
						orgId: config.context.orgId,
					},
				},
				async (span) => {
					const request = new AgentRequest(req.request);
					const response = new AgentResponse();
					const context = {
						...config.context,
						runId: req.request.runId,
					} as AgentContext;
					try {
						resolve(await config.handler(request, response, context));
					} catch (err) {
						config.context.logger.error((err as { message: string }).message);
						span.recordException(err as Exception);
						reject(err);
					} finally {
						span.end();
					}
				},
			);
		});
	};
}
