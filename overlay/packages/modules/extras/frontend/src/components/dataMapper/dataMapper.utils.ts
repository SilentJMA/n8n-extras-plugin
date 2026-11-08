import type { MapFunction, MappingRule, TreeNode } from './engine';

/** Drag payload of a source field: its path. */
export const DRAG_FIELD = 'application/x-n8n-data-mapper-field';
/** Drag payload of a function output port: `<function key>:<port key>`. */
export const DRAG_FUNCTION_OUTPUT = 'application/x-n8n-data-mapper-function-output';

export const portId = (fnKey: number, side: 'in' | 'out', portKey: number) =>
	`fn:${fnKey}:${side}:${portKey}`;

/** Keys of the rows to show: rows that match the filter, their ancestors, and nothing inside a collapsed group. */
export function visibleRowKeys(
	rows: TreeNode[],
	filter: string,
	collapsed: Set<string>,
): Set<string> {
	const byKey = new Map(rows.map((row) => [row.key, row]));
	const query = filter.trim().toLowerCase();
	const matched = new Set<string>();
	if (query) {
		for (const row of rows) {
			const text = `${row.label} ${row.field?.path ?? ''}`.toLowerCase();
			if (!text.includes(query)) continue;
			// Keep the ancestors so the match stays in context.
			let key: string | undefined = row.key;
			while (key && !matched.has(key)) {
				matched.add(key);
				key = byKey.get(key)?.parent;
			}
		}
	}
	const visible = new Set<string>();
	for (const row of rows) {
		if (query && !matched.has(row.key)) continue;
		// A filter opens collapsed groups, so a match is never hidden.
		if (!query && hasCollapsedAncestor(row, byKey, collapsed)) continue;
		visible.add(row.key);
	}
	return visible;
}

function hasCollapsedAncestor(
	row: TreeNode,
	byKey: Map<string, TreeNode>,
	collapsed: Set<string>,
): boolean {
	let parent = row.parent;
	while (parent) {
		if (collapsed.has(parent)) return true;
		parent = byKey.get(parent)?.parent;
	}
	return false;
}

/** The row a line attaches to: the row of the field, or the nearest visible group above it. */
export function anchorRowKey(
	rows: TreeNode[],
	fieldPath: string,
	visible: Set<string>,
): string | undefined {
	const byKey = new Map(rows.map((row) => [row.key, row]));
	let key: string | undefined = `field:${fieldPath}`;
	if (!byKey.has(key)) return undefined;
	while (key && !visible.has(key)) key = byKey.get(key)?.parent;
	return key;
}

/** An S-curve from (x1, y1) to (x2, y2), as in a classic mapper. */
export function curve(x1: number, y1: number, x2: number, y2: number): string {
	const dx = Math.max(24, (x2 - x1) / 2);
	return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export interface StoredDefinition {
	mappings: MappingRule[];
	functions: MapFunction[];
	/** Set when the stored text is not valid JSON. */
	error?: string;
}

/** Reads the stored definition: JSON text, an object, or a rule array (older format). */
export function readMapDefinition(raw: unknown): StoredDefinition {
	let value = raw;
	if (typeof raw === 'string') {
		if (raw.trim() === '') return { mappings: [], functions: [] };
		try {
			value = JSON.parse(raw);
		} catch (error) {
			return {
				mappings: [],
				functions: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}
	if (Array.isArray(value)) return { mappings: value as MappingRule[], functions: [] };
	if (value && typeof value === 'object') {
		const definition = value as { mappings?: unknown; functions?: unknown };
		return {
			mappings: Array.isArray(definition.mappings) ? (definition.mappings as MappingRule[]) : [],
			functions: Array.isArray(definition.functions) ? (definition.functions as MapFunction[]) : [],
		};
	}
	return { mappings: [], functions: [] };
}

/** The text stored in the node: readable when the map is opened as JSON. */
export function serializeDefinition(definition: {
	mappings: MappingRule[];
	functions: MapFunction[];
}): string {
	return JSON.stringify(definition, null, 2);
}
