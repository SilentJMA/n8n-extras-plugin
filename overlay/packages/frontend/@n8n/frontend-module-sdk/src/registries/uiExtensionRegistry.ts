import { shallowReactive, type Component } from 'vue';

import type { ModuleUiExtensions } from '../types/uiExtension';

type Contributions = Required<{
	[K in keyof ModuleUiExtensions]: NonNullable<ModuleUiExtensions[K]> extends unknown[]
		? NonNullable<ModuleUiExtensions[K]>
		: Array<NonNullable<ModuleUiExtensions[K]>>;
}>;

/**
 * What modules add to existing shell pages, flattened across modules. The shell registers
 * the contributions of every active module at startup; shell components read them.
 *
 * Shallow-reactive so a component can read a slot in a plain `computed`, and shallow so a
 * component is never turned into a reactive object. A slot nobody contributed to is `[]`.
 */
const contributions: Contributions = shallowReactive({
	workflowCardActions: [],
	workflowCardMenu: [],
	folderCardToggle: [],
	folderCardContent: [],
	executionFilterFields: [],
	executionRowCells: [],
	parameterInputs: [],
});

export function registerAll(extensions: ModuleUiExtensions): void {
	for (const key of Object.keys(extensions) as Array<keyof ModuleUiExtensions>) {
		const value = extensions[key];
		if (value === undefined) continue;
		const target = contributions[key] as unknown[];
		target.push(...(Array.isArray(value) ? value : [value]));
	}
}

export function get<K extends keyof ModuleUiExtensions>(slot: K): Contributions[K] {
	return contributions[slot];
}

/** The component that draws parameters with this `typeOptions.extensionComponent` name, if any. */
export function getParameterInput(name: string): Component | undefined {
	for (const components of contributions.parameterInputs) {
		if (Object.prototype.hasOwnProperty.call(components, name)) return components[name];
	}
	return undefined;
}

/** Test isolation only. */
export function clear(): void {
	for (const key of Object.keys(contributions) as Array<keyof Contributions>) {
		contributions[key].length = 0;
	}
}
