// Simplified generic types for prompt generation
type HasSystem = boolean;
type HasPrompt = boolean;
type HasVariables = boolean;

// Base prompt structure
interface BasePrompt {
	slug: string;
}

// Conditional system field
interface SystemField {
	system: (params: { system: Record<string, unknown> }) => string;
}

// Conditional prompt field
interface PromptField {
	prompt: (params: { prompt: Record<string, unknown> }) => string;
}

// Simplified generic prompt type
export type Prompt<
	THasSystem extends HasSystem = true,
	THasPrompt extends HasPrompt = true,
	THasVariables extends HasVariables = true,
	TVariablesSystem = Record<string, string>,
	TVariablesPrompt = Record<string, string>,
> = BasePrompt &
	(THasSystem extends true ? SystemField : Record<string, never>) &
	(THasPrompt extends true ? PromptField : Record<string, never>) &
	(THasVariables extends true
		? {
				variables: {
					system?: TVariablesSystem;
					prompt?: TVariablesPrompt;
				};
			}
		: Record<string, never>);

// Simple signature function type
export type PromptSignature<
	_T extends Prompt<boolean, boolean, boolean, unknown, unknown>,
> = (params: Record<string, unknown>) => string;

// Simple collection types
export type PromptsCollection = Record<string, unknown>;
export type GetPromptSignatures<T extends Record<string, unknown>> = {
	[K in keyof T]: PromptSignature<T[K]>;
};
