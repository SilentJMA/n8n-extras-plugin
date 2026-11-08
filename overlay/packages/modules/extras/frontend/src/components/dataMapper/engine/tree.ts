import { parseDefinition, parsePath } from './mapping';
import type { IfMissing, LookupFallback, MappingRule, Transform } from './mapping';
import { autoMap, parseProfile, parseSynonyms, sourceFields } from './profile';
import type { FieldType, ProfileField, ProfileFormat } from './profile';

/** One mapping as the visual editor shows it. Converts 1:1 to a rule of the JSON definition. */
export interface VisualMapping {
	id: string;
	target: string;
	/** Source path. Absent for a fixed value. */
	source?: string;
	value?: string;
	transform: Transform;
	separator?: string;
	decimals?: number;
	dateInputFormat?: string;
	dateOutputFormat?: string;
	lookup?: string;
	lookupFallback?: LookupFallback;
	lookupDefault?: string;
	template?: string;
	ifMissing: IfMissing;
	default?: string;
	/** Set when the line starts at an output port of a function (then `source` is unused). */
	fromFunction?: number;
	fromKey?: number;
	/** Set when the line ends at an input port of a function (then `target` is unused). */
	toFunction?: number;
	toKey?: number;
}

export interface TreeNode {
	/** Stable key: `field:<path>` for a leaf, `group:<path prefix>` for a group. */
	key: string;
	label: string;
	depth: number;
	repeating: boolean;
	attribute: boolean;
	/** Key of the parent group row, if any. */
	parent?: string;
	/** Set on leaves: the field a line connects to. */
	field?: ProfileField;
}

export interface LoadedProfile {
	fields: ProfileField[];
	tree: TreeNode[];
	error?: string;
}

export const TRANSFORMS: Array<{ value: Transform; label: string }> = [
	{ value: 'none', label: 'None' },
	{ value: 'concat', label: 'Concatenate' },
	{ value: 'date', label: 'Format Date' },
	{ value: 'join', label: 'Join List' },
	{ value: 'lookup', label: 'Lookup Table' },
	{ value: 'lowercase', label: 'Lowercase' },
	{ value: 'round', label: 'Round' },
	{ value: 'split', label: 'Split Into List' },
	{ value: 'boolean', label: 'To Boolean' },
	{ value: 'integer', label: 'To Integer' },
	{ value: 'number', label: 'To Number' },
	{ value: 'string', label: 'To String' },
	{ value: 'trim', label: 'Trim' },
	{ value: 'uppercase', label: 'Uppercase' },
];

export const transformLabel = (t: Transform) => TRANSFORMS.find((x) => x.value === t)?.label ?? t;

export const typeLabel = (type: FieldType) => (type === 'string' ? 'text' : type);

const stars = (path: string) => (path.match(/\[\*\]/g) ?? []).length;

let counter = 0;
export const newMappingId = () => `m${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Parses a profile. As a source, sample XML keeps its root element, like the node reads XML input. */
export function loadProfile(
	text: string,
	format: ProfileFormat,
	role: 'source' | 'target',
): LoadedProfile {
	if (text.trim() === '') return { fields: [], tree: [] };
	try {
		const profile = parseProfile(text, format);
		const fields = role === 'source' ? sourceFields(profile) : profile.fields;
		return { fields, tree: buildTree(fields) };
	} catch (error) {
		return { fields: [], tree: [], error: error instanceof Error ? error.message : String(error) };
	}
}

/** Turns flat field paths (order.line[*].$.sku) into an indented tree with group rows. */
export function buildTree(fields: ProfileField[]): TreeNode[] {
	const rows: TreeNode[] = [];
	const seen = new Set<string>();
	for (const field of fields) {
		let tokens: Array<string | number>;
		try {
			tokens = parsePath(field.path);
		} catch {
			tokens = [field.path];
		}
		// '*' marks the previous segment as a list, '$' marks the next segment as an attribute.
		const segments: Array<{ label: string; repeating: boolean; attribute: boolean; key: string }> =
			[];
		let key = '';
		let attribute = false;
		for (const token of tokens) {
			const text = String(token);
			if (token === '*') {
				key += '[*]';
				if (segments.length) {
					segments[segments.length - 1].repeating = true;
					segments[segments.length - 1].key = key;
				}
				continue;
			}
			key += key === '' ? text : `.${text}`;
			if (text === '$') {
				attribute = true;
				continue;
			}
			segments.push({ label: attribute ? `@${text}` : text, repeating: false, attribute, key });
			attribute = false;
		}
		let parent: string | undefined;
		segments.forEach((segment, depth) => {
			const leaf = depth === segments.length - 1;
			const rowKey = leaf ? `field:${field.path}` : `group:${segment.key}`;
			if (!seen.has(rowKey)) {
				seen.add(rowKey);
				rows.push({
					key: rowKey,
					label: segment.label,
					depth,
					repeating: leaf ? field.repeating && segment.repeating : segment.repeating,
					attribute: segment.attribute,
					parent,
					field: leaf ? field : undefined,
				});
			}
			parent = rowKey;
		});
	}
	return rows;
}

/** Matches unmapped target fields to source fields by name, like the community node's Auto-Map. */
export function autoMapFields(
	sources: ProfileField[],
	targets: ProfileField[],
	existing: VisualMapping[],
	options: { threshold: number; synonyms?: string },
): VisualMapping[] {
	const mapped = new Set(existing.map((m) => m.target));
	const remaining = targets.filter((f) => !mapped.has(f.path));
	const result = autoMap(
		sources.map((f) => ({ path: f.path, name: f.name })),
		{ kind: 'sampleJson', fields: remaining },
		{
			threshold: options.threshold,
			strategy: 'fuzzy',
			caseSensitive: false,
			reuseSources: false,
			unmatched: 'skip',
			synonyms: parseSynonyms(options.synonyms ?? ''),
		},
	);
	return result.rules.map((rule) => ({
		id: newMappingId(),
		source: rule.source,
		target: rule.target,
		// Date needs formats to be useful. Number and boolean conversions are safe defaults.
		transform:
			rule.transform === 'number' || rule.transform === 'boolean' ? rule.transform : 'none',
		ifMissing: 'skip',
	}));
}

/** Builds the JSON definition the node executes. */
export function toDefinition(mappings: VisualMapping[]): MappingRule[] {
	return mappings.map((m) => {
		if (m.fromFunction !== undefined) {
			return { target: m.target, fromFunction: m.fromFunction, fromKey: m.fromKey };
		}
		if (m.toFunction !== undefined) {
			const link: MappingRule = { target: '', toFunction: m.toFunction, toKey: m.toKey };
			if (m.source === undefined) link.value = m.value ?? '';
			else link.source = m.source;
			return link;
		}
		const rule: MappingRule = { target: m.target };
		if (m.source === undefined) rule.value = m.value ?? '';
		else {
			rule.source = m.source;
			// A field from a single element fills a repeating target: let the engine find the lists.
			if (stars(m.target) > stars(m.source)) rule.broadcast = true;
			if (m.ifMissing !== 'skip') rule.ifMissing = m.ifMissing;
			if (m.ifMissing === 'default') rule.default = m.default ?? '';
		}
		if (m.transform !== 'none') rule.transform = m.transform;
		if (m.transform === 'number' || m.transform === 'boolean' || m.transform === 'integer')
			rule.lenient = true;
		if (m.transform === 'split' || m.transform === 'join') rule.separator = m.separator ?? ',';
		if (m.transform === 'round') rule.decimals = m.decimals ?? 2;
		if (m.transform === 'date') {
			if (m.dateInputFormat) rule.dateInputFormat = m.dateInputFormat;
			if (m.dateOutputFormat) rule.dateOutputFormat = m.dateOutputFormat;
		}
		if (m.transform === 'lookup') {
			rule.lookup = m.lookup ?? '';
			rule.lookupFallback = m.lookupFallback ?? 'keep';
			if (rule.lookupFallback === 'default') rule.lookupDefault = m.lookupDefault ?? '';
		}
		if (m.transform === 'concat') rule.template = m.template ?? '{value}';
		return rule;
	});
}

/** Reads a JSON definition back into visual mappings. Throws the engine's validation errors. */
export function fromDefinition(definition: unknown): VisualMapping[] {
	return parseDefinition(definition).map((rule) => ({
		id: newMappingId(),
		target: rule.target,
		source:
			rule.value !== undefined || rule.fromFunction !== undefined ? undefined : (rule.source ?? ''),
		value:
			rule.value !== undefined
				? typeof rule.value === 'string'
					? rule.value
					: JSON.stringify(rule.value)
				: undefined,
		transform: rule.transform ?? 'none',
		separator: rule.separator,
		decimals: rule.decimals,
		dateInputFormat: rule.dateInputFormat,
		dateOutputFormat: rule.dateOutputFormat,
		lookup:
			typeof rule.lookup === 'string'
				? rule.lookup
				: rule.lookup
					? JSON.stringify(rule.lookup)
					: undefined,
		lookupFallback: rule.lookupFallback,
		lookupDefault: rule.lookupDefault === undefined ? undefined : String(rule.lookupDefault),
		template: rule.template,
		ifMissing: rule.ifMissing ?? 'skip',
		default: rule.default === undefined ? undefined : String(rule.default),
		fromFunction: rule.fromFunction,
		fromKey: rule.fromKey,
		toFunction: rule.toFunction,
		toKey: rule.toKey,
	}));
}
