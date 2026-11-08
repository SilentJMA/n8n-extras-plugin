import type { Component } from 'vue';

/** The slice of a workflow list item a module extension may read. */
export type ExtensionWorkflow = {
	id: string;
	name: string;
	/** `null` when the workflow is not published. */
	activeVersionId: string | null;
	isArchived: boolean;
	readOnly: boolean;
	scopes?: string[];
};

/** The slice of a folder list item a module extension may read. */
export type ExtensionFolder = {
	id: string;
	name: string;
	workflowCount: number;
	/** Id of the project that owns the folder, when known. */
	projectId?: string;
};

/** The slice of an execution summary a module extension may read. */
export type ExtensionExecution = {
	id: string;
	mode: string;
	/** Fields the backend added through `ExecutionQueryExtensions`. */
	ext?: Record<string, unknown>;
};

export type WorkflowCardMenuItem = {
	label: string;
	value: string;
	disabled?: boolean;
};

/** Items a module adds to a workflow card's "..." menu. */
export type WorkflowCardMenuContribution = {
	items(workflow: ExtensionWorkflow): WorkflowCardMenuItem[];
	/** Called for every selected menu value. Return `true` when the value was handled here. */
	onSelect(value: string, workflow: ExtensionWorkflow): boolean | Promise<boolean>;
};

/**
 * Places in the existing workflow, folder and execution lists where a module can
 * add UI. Every field is optional. Components are rendered only while the module
 * is active.
 *
 * - `workflowCardActions` — props `{ workflow }`; rendered in the card's action row.
 * - `workflowCardMenu` — extra items in the card's "..." menu.
 * - `folderCardToggle` — props `{ folder, expanded }`; emits `toggle`. Rendered at the start of a
 *   folder card. The shell owns the expanded state.
 * - `folderCardContent` — props `{ folder, publishedOnly }`; rendered under an expanded folder card.
 * - `executionFilterFields` — props `{ modelValue }` (the `ext` filter object); emits
 *   `update:modelValue`. Rendered inside the executions filter. The object is sent to the backend as
 *   the `ext` filter key.
 * - `executionRowCells` — props `{ execution }`; rendered next to the mode icon in an execution row.
 */
export type ModuleUiExtensions = {
	workflowCardActions?: Component[];
	workflowCardMenu?: WorkflowCardMenuContribution[];
	folderCardToggle?: Component;
	folderCardContent?: Component;
	executionFilterFields?: Component[];
	executionRowCells?: Component[];
};
