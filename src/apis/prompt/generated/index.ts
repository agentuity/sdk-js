export type PromptConfig = any;
export type PromptName = any;

// This will be replaced by the CLI with the actual generated types
export interface PromptsCollection {
	[promptSlug: string]: {
		slug: string;
		system: { compile: (variables?: Record<string, any>) => string };
		prompt: { compile: (variables?: Record<string, any>) => string };
	};
}
