/**
 * Interpolates a template string with variables using go-common syntax
 * Supports:
 * - {variable} - optional variable (defaults to empty string)
 * - {!variable} - required variable (throws error if missing)
 * - {variable:default} - variable with default value
 * - {!variable:default} - required variable with default value
 */
export function interpolateTemplate(
	template: string,
	variables: Record<string, any> = {}
): string {
	// Convert {{variable}} to {variable} for go-common compatibility
	const goCommonTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');

	// Use go-common InterpolateString logic: {variable}, {!required}, {variable:-default}
	// Support both {variable:default} and {variable:-default} syntax
	return goCommonTemplate.replace(
		/\{([!]?[^}:]+)(?::([^}]*))?\}/g,
		(match, varName, defaultValue) => {
			const isRequired = varName.startsWith('!');
			const cleanVarName = isRequired ? varName.substring(1) : varName;
			const value = variables[cleanVarName];

			if (value !== undefined && value !== '') {
				return String(value);
			}

			if (isRequired) {
				throw new Error(`Required variable '${cleanVarName}' not provided`);
			}

			return defaultValue !== undefined ? defaultValue : '';
		}
	);
}

/**
 * Extracts variable names from a template string
 * Supports the same syntax as interpolateTemplate
 */
export function extractVariables(template: string): string[] {
	// Convert {{variable}} to {variable} for go-common compatibility
	const goCommonTemplate = template.replace(/\{\{([^}]+)\}\}/g, '{$1}');

	const matches = goCommonTemplate.match(/\{([!]?[^}:]+)(?::([^}]*))?\}/g);
	if (!matches) {
		return [];
	}

	const variables: string[] = [];
	const seen = new Set<string>();

	for (const match of matches) {
		const varMatch = match.match(/\{([!]?[^}:]+)(?::([^}]*))?\}/);
		if (varMatch) {
			let varName = varMatch[1].trim();
			// Remove ! prefix if present
			if (varName.startsWith('!')) {
				varName = varName.substring(1);
			}
			// Remove :default suffix if present
			const colonIndex = varName.indexOf(':');
			if (colonIndex !== -1) {
				varName = varName.substring(0, colonIndex);
			}
			if (!seen.has(varName)) {
				variables.push(varName);
				seen.add(varName);
			}
		}
	}

	return variables;
}
