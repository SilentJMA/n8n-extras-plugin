<script setup lang="ts">
import {
	computed,
	nextTick,
	onBeforeUnmount,
	onMounted,
	reactive,
	ref,
	useTemplateRef,
	watch,
} from 'vue';
import type { INode, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import {
	N8nButton,
	N8nIconButton,
	N8nInput,
	N8nInputLabel,
	N8nNotice,
	N8nText,
} from '@n8n/design-system';

import { t } from '../../extras.i18n';
import { useExtrasStore } from '../../extras.store';
import {
	autoMapFields,
	createFunction,
	fromDefinition,
	loadProfile,
	newMappingId,
	toDefinition,
} from './engine';
import type {
	FunctionType,
	LoadedProfile,
	MapFunction,
	ProfileFormat,
	VisualMapping,
} from './engine';
import FunctionBox from './FunctionBox.vue';
import FunctionEditor from './FunctionEditor.vue';
import FunctionMenu from './FunctionMenu.vue';
import MapperTree from './MapperTree.vue';
import MappingEditor from './MappingEditor.vue';
import {
	anchorRowKey,
	curve,
	portId,
	readMapDefinition,
	serializeDefinition,
	visibleRowKeys,
} from './dataMapper.utils';

// Props and event of the shell's `parameterInputs` seam.
const props = withDefaults(
	defineProps<{
		parameter: INodeProperties;
		/** The JSON definition text: { "mappings": [...], "functions": [...] }. */
		value?: unknown;
		path: string;
		node: INode | null;
		isReadOnly?: boolean;
		/** Input items of the open node; the first one is the source structure without a source profile. */
		inputItems?: INodeExecutionData[];
	}>(),
	{ value: undefined, isReadOnly: false, inputItems: () => [] },
);

const emit = defineEmits<{
	valueChanged: [value: { name: string; node: string; value: string }];
}>();

const store = useExtrasStore();
onMounted(() => {
	void store.ensureLoaded().catch(() => {});
});
// A backend from before this switch existed does not report it: treat a missing flag as on.
const visualEnabled = computed(() => store.features.visualDataMapper !== false);

function emitText(text: string) {
	emit('valueChanged', { name: props.path, node: props.node?.name ?? '', value: text });
}

// ---- Map state: mappings (lines) and functions ----

const loadError = ref<string | null>(null);
const notice = ref<string | null>(null);

function read(value: unknown) {
	const stored = readMapDefinition(value);
	try {
		loadError.value = stored.error ?? null;
		return { mappings: fromDefinition(stored.mappings), functions: stored.functions };
	} catch (error) {
		loadError.value = error instanceof Error ? error.message : String(error);
		return { mappings: [], functions: stored.functions };
	}
}

const initial = read(props.value);
const mappings = ref<VisualMapping[]>(initial.mappings);
const functions = ref<MapFunction[]>(initial.functions);

const definitionText = computed(() =>
	serializeDefinition({ mappings: toDefinition(mappings.value), functions: functions.value }),
);

const storedText = (value: unknown) => {
	const stored = readMapDefinition(value);
	return serializeDefinition({ mappings: stored.mappings, functions: stored.functions });
};

watch(
	() => props.value,
	(value) => {
		// Only re-read when the value changed outside this component (undo, paste, import).
		if (storedText(value) === definitionText.value) return;
		const next = read(value);
		mappings.value = next.mappings;
		functions.value = next.functions;
	},
);

watch(definitionText, (text) => {
	if (text === storedText(props.value)) return;
	emitText(text);
});

type Selection =
	| { kind: 'mapping'; id: string }
	| { kind: 'function'; key: number }
	| { kind: 'source' | 'target'; path: string }
	| null;
const selection = ref<Selection>(null);
const selectedMapping = computed(() => {
	const current = selection.value;
	return current?.kind === 'mapping' ? mappings.value.find((m) => m.id === current.id) : undefined;
});
const selectedFunction = computed(() => {
	const current = selection.value;
	return current?.kind === 'function'
		? functions.value.find((f) => f.key === current.key)
		: undefined;
});

// ---- Profiles ----

const options = computed(() => props.parameter.typeOptions?.dataMapper);

function nodeParameter(name: string | undefined): string {
	if (!name) return '';
	const value = props.node?.parameters?.[name];
	return typeof value === 'string' ? value : '';
}

const sourceProfileText = computed(() => nodeParameter(options.value?.sourceProfileParameter));
const firstInputItem = computed(() => props.inputItems[0]?.json);

const source = computed<LoadedProfile & { fromInput: boolean }>(() => {
	const format = (nodeParameter(options.value?.sourceFormatParameter) || 'auto') as ProfileFormat;
	if (sourceProfileText.value.trim() || !firstInputItem.value) {
		return { ...loadProfile(sourceProfileText.value, format, 'source'), fromInput: false };
	}
	// Without a source profile, the structure of the first input item is the source.
	return {
		...loadProfile(JSON.stringify(firstInputItem.value), 'sampleJson', 'source'),
		fromInput: true,
	};
});

const target = computed<LoadedProfile>(() => {
	const format = (nodeParameter(options.value?.targetFormatParameter) || 'auto') as ProfileFormat;
	return loadProfile(nodeParameter(options.value?.targetProfileParameter), format, 'target');
});

// ---- Tree view state ----

const sourceFilter = ref('');
const targetFilter = ref('');
const sourceCollapsed = reactive(new Set<string>());
const targetCollapsed = reactive(new Set<string>());

const sourceVisible = computed(() =>
	visibleRowKeys(source.value.tree, sourceFilter.value, sourceCollapsed),
);
const targetVisible = computed(() =>
	visibleRowKeys(target.value.tree, targetFilter.value, targetCollapsed),
);

const isFieldTarget = (m: VisualMapping) => m.toFunction === undefined;

const mappedSources = computed(
	() => new Set(mappings.value.flatMap((m) => (m.source === undefined ? [] : [m.source]))),
);
const mappedTargets = computed(
	() => new Set(mappings.value.filter(isFieldTarget).map((m) => m.target)),
);
const fixedValues = computed(
	() =>
		new Map(
			mappings.value
				.filter((m) => isFieldTarget(m) && m.source === undefined && m.fromFunction === undefined)
				.map((m) => [m.target, m.value ?? '']),
		),
);
/** The mappings the selection touches: they and their fields, ports and lines get the highlight color. */
const highlighted = computed<VisualMapping[]>(() => {
	const current = selection.value;
	if (!current) return [];
	switch (current.kind) {
		case 'mapping':
			return mappings.value.filter((m) => m.id === current.id);
		case 'function':
			return mappings.value.filter(
				(m) => m.fromFunction === current.key || m.toFunction === current.key,
			);
		case 'source':
			return mappings.value.filter((m) => m.source === current.path);
		case 'target':
			return mappings.value.filter((m) => isFieldTarget(m) && m.target === current.path);
	}
});
const highlightedIds = computed(() => new Set(highlighted.value.map((m) => m.id)));
const selectedSources = computed(
	() => new Set(highlighted.value.flatMap((m) => (m.source === undefined ? [] : [m.source]))),
);
const selectedTargets = computed(
	() => new Set(highlighted.value.filter(isFieldTarget).map((m) => m.target)),
);
const highlightedPorts = computed(() => {
	const ids = new Set<string>();
	for (const m of highlighted.value) {
		if (m.toFunction !== undefined && m.toKey !== undefined) {
			ids.add(portId(m.toFunction, 'in', m.toKey));
		}
		if (m.fromFunction !== undefined && m.fromKey !== undefined) {
			ids.add(portId(m.fromFunction, 'out', m.fromKey));
		}
	}
	return ids;
});
const connectedPorts = computed(() => {
	const ids = new Set<string>();
	for (const m of mappings.value) {
		if (m.toFunction !== undefined && m.toKey !== undefined) {
			ids.add(portId(m.toFunction, 'in', m.toKey));
		}
		if (m.fromFunction !== undefined && m.fromKey !== undefined) {
			ids.add(portId(m.fromFunction, 'out', m.fromKey));
		}
	}
	return ids;
});

function toggle(collapsed: Set<string>, key: string) {
	if (collapsed.has(key)) collapsed.delete(key);
	else collapsed.add(key);
}

// ---- Editing ----

const baseMapping = (target: string): VisualMapping => ({
	id: newMappingId(),
	target,
	transform: 'none',
	ifMissing: 'skip',
});

/** A target field takes one value: a new line replaces the old one. */
function replaceTarget(mapping: VisualMapping) {
	mappings.value = [
		...mappings.value.filter((m) => !(isFieldTarget(m) && m.target === mapping.target)),
		mapping,
	];
	selection.value = { kind: 'mapping', id: mapping.id };
}

function connect(sourcePath: string, targetPath: string) {
	replaceTarget({ ...baseMapping(targetPath), source: sourcePath });
}

function connectFunctionOutput(functionKey: number, portKey: number, targetPath: string) {
	replaceTarget({ ...baseMapping(targetPath), fromFunction: functionKey, fromKey: portKey });
}

function connectFunctionInput(functionKey: number, portKey: number, sourcePath: string) {
	const mapping: VisualMapping = {
		...baseMapping(''),
		source: sourcePath,
		toFunction: functionKey,
		toKey: portKey,
	};
	// One value per input port.
	mappings.value = [
		...mappings.value.filter((m) => !(m.toFunction === functionKey && m.toKey === portKey)),
		mapping,
	];
	selection.value = { kind: 'mapping', id: mapping.id };
}

function addFixedValue(targetPath: string) {
	replaceTarget({ ...baseMapping(targetPath), value: '' });
}

function addFunction(type: FunctionType) {
	const fn = createFunction(type, functions.value);
	functions.value = [...functions.value, fn];
	selection.value = { kind: 'function', key: fn.key };
	void nextTick(scheduleMeasure);
}

function updateFunction(fn: MapFunction) {
	functions.value = functions.value.map((f) => (f.key === fn.key ? fn : f));
	// Drop lines to ports that no longer exist.
	const inputs = new Set(fn.inputs.map((p) => p.key));
	const outputs = new Set(fn.outputs.map((p) => p.key));
	mappings.value = mappings.value.filter(
		(m) =>
			!(m.toFunction === fn.key && !inputs.has(m.toKey ?? -1)) &&
			!(m.fromFunction === fn.key && !outputs.has(m.fromKey ?? -1)),
	);
}

function deleteFunction(key: number) {
	functions.value = functions.value.filter((f) => f.key !== key);
	mappings.value = mappings.value.filter((m) => m.toFunction !== key && m.fromFunction !== key);
	selection.value = null;
}

/** One mapping opens its editor. A field with several mappings highlights all of them. */
function selectField(kind: 'source' | 'target', path: string) {
	const found = mappings.value.filter((m) =>
		kind === 'source' ? m.source === path : isFieldTarget(m) && m.target === path,
	);
	if (found.length === 1) selection.value = { kind: 'mapping', id: found[0].id };
	else selection.value = found.length ? { kind, path } : null;
}

function updateMapping(mapping: VisualMapping) {
	const index = mappings.value.findIndex((m) => m.id === mapping.id);
	if (index !== -1) mappings.value.splice(index, 1, mapping);
}

function deleteMapping(id: string) {
	mappings.value = mappings.value.filter((m) => m.id !== id);
	selection.value = null;
}

function runAutoMap() {
	const added = autoMapFields(
		source.value.fields,
		target.value.fields,
		mappings.value.filter(isFieldTarget),
		{ threshold: 0.6 },
	);
	mappings.value.push(...added);
}

function clearAll() {
	mappings.value = [];
	functions.value = [];
	selection.value = null;
}

function showChainNotice() {
	notice.value = t('dataMapper.noChaining');
}

// ---- Geometry: lines ----

const canvasEl = useTemplateRef<HTMLElement>('canvas');
const functionsBody = useTemplateRef<HTMLElement>('functionsBody');
const sourceTree = useTemplateRef<InstanceType<typeof MapperTree>>('sourceTree');
const targetTree = useTemplateRef<InstanceType<typeof MapperTree>>('targetTree');

interface Line {
	id: string;
	d: string;
	dimmed: boolean;
}

const lines = ref<Line[]>([]);

interface Point {
	x: number;
	y: number;
	clipped: boolean;
}

function clampedCenter(element: Element, view: DOMRect, origin: DOMRect, x: number): Point {
	const rect = element.getBoundingClientRect();
	const center = rect.top + rect.height / 2;
	const y = Math.min(Math.max(center, view.top), view.bottom);
	return { x, y: y - origin.top, clipped: y !== center };
}

function measure() {
	const canvas = canvasEl.value;
	const sourceRoot = sourceTree.value?.$el as HTMLElement | undefined;
	const targetRoot = targetTree.value?.$el as HTMLElement | undefined;
	const sourceScroll = sourceTree.value?.scrollEl;
	const targetScroll = targetTree.value?.scrollEl;
	const fnBody = functionsBody.value;
	if (!canvas || !sourceRoot || !targetRoot || !sourceScroll || !targetScroll || !fnBody) return;

	const origin = canvas.getBoundingClientRect();
	const sourceX = sourceRoot.getBoundingClientRect().right - origin.left;
	const targetX = targetRoot.getBoundingClientRect().left - origin.left;
	const sourceView = sourceScroll.getBoundingClientRect();
	const targetView = targetScroll.getBoundingClientRect();
	const fnView = fnBody.getBoundingClientRect();

	const row = (root: HTMLElement, key: string | undefined) =>
		key ? root.querySelector(`[data-row-key="${CSS.escape(key)}"]`) : null;

	const sourcePoint = (path: string): Point | undefined => {
		const el = row(sourceRoot, anchorRowKey(source.value.tree, path, sourceVisible.value));
		return el ? clampedCenter(el, sourceView, origin, sourceX) : undefined;
	};
	const targetPoint = (path: string): Point | undefined => {
		const el = row(targetRoot, anchorRowKey(target.value.tree, path, targetVisible.value));
		return el ? clampedCenter(el, targetView, origin, targetX) : undefined;
	};
	const portPoint = (id: string): Point | undefined => {
		const el = fnBody.querySelector(`[data-port="${CSS.escape(id)}"]`);
		if (!el) return undefined;
		const rect = el.getBoundingClientRect();
		return clampedCenter(el, fnView, origin, rect.left + rect.width / 2 - origin.left);
	};

	const next: Line[] = [];
	for (const m of mappings.value) {
		let from: Point | undefined;
		let to: Point | undefined;
		if (m.fromFunction !== undefined && m.fromKey !== undefined) {
			from = portPoint(portId(m.fromFunction, 'out', m.fromKey));
		} else if (m.source !== undefined) {
			from = sourcePoint(m.source);
		}
		if (m.toFunction !== undefined && m.toKey !== undefined) {
			to = portPoint(portId(m.toFunction, 'in', m.toKey));
		} else {
			to = targetPoint(m.target);
		}
		if (!from || !to) continue;
		next.push({
			id: m.id,
			d: curve(from.x, from.y, to.x, to.y),
			dimmed: from.clipped || to.clipped,
		});
	}
	lines.value = next;
}

let frame = 0;
function scheduleMeasure() {
	cancelAnimationFrame(frame);
	frame = requestAnimationFrame(measure);
}

watch(
	[
		mappings,
		functions,
		sourceVisible,
		targetVisible,
		() => source.value.tree,
		() => target.value.tree,
	],
	async () => {
		await nextTick();
		scheduleMeasure();
	},
	{ deep: true },
);

let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
	resizeObserver = new ResizeObserver(scheduleMeasure);
	if (canvasEl.value) resizeObserver.observe(canvasEl.value);
	void nextTick(scheduleMeasure);
});
onBeforeUnmount(() => {
	resizeObserver?.disconnect();
	cancelAnimationFrame(frame);
});

// ---- Expanded view ----

const expanded = ref(false);
watch(expanded, async () => {
	await nextTick();
	scheduleMeasure();
});
</script>

<template>
	<div :class="$style.wrapper" data-test-id="data-mapper-parameter">
		<N8nInputLabel :label="parameter.displayName" size="small" :class="$style.label" />
		<template v-if="!visualEnabled">
			<N8nText size="xsmall" color="text-light">{{ t('dataMapper.switchedOff') }}</N8nText>
			<N8nInput
				type="textarea"
				:rows="10"
				:model-value="typeof value === 'string' ? value : definitionText"
				:disabled="isReadOnly"
				:class="$style.json"
				data-test-id="data-mapper-json"
				@update:model-value="emitText"
			/>
		</template>
		<Teleport v-else to="body" :disabled="!expanded">
			<div :class="{ [$style.backdrop]: expanded }" @click.self="expanded = false">
				<div :class="{ [$style.mapper]: true, [$style.expanded]: expanded }">
					<div :class="$style.toolbar">
						<N8nText size="small" color="text-light">
							{{
								t(
									mappings.length === 1
										? 'dataMapper.mappingCount.one'
										: 'dataMapper.mappingCount.other',
									{ count: String(mappings.length) },
								)
							}}
						</N8nText>
						<div :class="$style.actions">
							<N8nButton
								v-if="!isReadOnly"
								variant="ghost"
								size="small"
								icon="wand-sparkles"
								:label="t('dataMapper.autoMap')"
								:disabled="source.fields.length === 0 || target.fields.length === 0"
								data-test-id="data-mapper-auto-map"
								@click="runAutoMap"
							/>
							<N8nButton
								v-if="!isReadOnly && (mappings.length > 0 || functions.length > 0)"
								variant="ghost"
								size="small"
								icon="trash-2"
								:label="t('dataMapper.clear')"
								data-test-id="data-mapper-clear"
								@click="clearAll"
							/>
							<N8nIconButton
								variant="ghost"
								size="small"
								:icon="expanded ? 'minimize-2' : 'maximize-2'"
								:title="expanded ? t('dataMapper.collapse') : t('dataMapper.expand')"
								data-test-id="data-mapper-expand"
								@click="expanded = !expanded"
							/>
						</div>
					</div>

					<N8nNotice v-if="loadError" theme="warning" :content="loadError" />
					<N8nNotice v-if="source.error" theme="warning" :content="source.error" />
					<N8nNotice v-if="target.error" theme="warning" :content="target.error" />
					<N8nNotice v-if="notice" theme="info" :content="notice" @click="notice = null" />

					<div ref="canvas" :class="$style.canvas">
						<MapperTree
							ref="sourceTree"
							v-model:filter="sourceFilter"
							side="source"
							:title="source.fromInput ? t('dataMapper.sourceFromInput') : t('dataMapper.source')"
							:rows="source.tree"
							:visible="sourceVisible"
							:collapsed="sourceCollapsed"
							:mapped-paths="mappedSources"
							:selected-paths="selectedSources"
							:read-only="isReadOnly"
							:empty-text="t('dataMapper.sourceEmpty')"
							@toggle="(key) => toggle(sourceCollapsed, key)"
							@select="(path) => selectField('source', path)"
							@scroll="scheduleMeasure"
						/>

						<section :class="$style.functions" data-test-id="data-mapper-functions">
							<header :class="$style.functionsHeader">
								<N8nText size="small" bold>{{ t('dataMapper.functions') }}</N8nText>
								<FunctionMenu :disabled="isReadOnly" @add="addFunction" />
							</header>
							<div
								ref="functionsBody"
								:class="$style.functionsBody"
								@scroll.passive="scheduleMeasure"
							>
								<N8nText
									v-if="functions.length === 0"
									size="xsmall"
									color="text-light"
									:class="$style.functionsEmpty"
								>
									{{ t('dataMapper.functionsEmpty') }}
								</N8nText>
								<FunctionBox
									v-for="fn in functions"
									:key="fn.key"
									:fn="fn"
									:selected="selection?.kind === 'function' && selection.key === fn.key"
									:read-only="isReadOnly"
									:connected="connectedPorts"
									:highlighted="highlightedPorts"
									@select="selection = { kind: 'function', key: fn.key }"
									@connect-input="(portKey, path) => connectFunctionInput(fn.key, portKey, path)"
									@chain-rejected="showChainNotice"
								/>
							</div>
						</section>

						<MapperTree
							ref="targetTree"
							v-model:filter="targetFilter"
							side="target"
							:title="t('dataMapper.target')"
							:rows="target.tree"
							:visible="targetVisible"
							:collapsed="targetCollapsed"
							:mapped-paths="mappedTargets"
							:selected-paths="selectedTargets"
							:fixed-values="fixedValues"
							:read-only="isReadOnly"
							:empty-text="t('dataMapper.targetEmpty')"
							@toggle="(key) => toggle(targetCollapsed, key)"
							@select="(path) => selectField('target', path)"
							@connect="connect"
							@connect-function="connectFunctionOutput"
							@add-value="addFixedValue"
							@scroll="scheduleMeasure"
						/>

						<svg :class="$style.lines" aria-hidden="true">
							<g
								v-for="line in lines"
								:key="line.id"
								:class="{
									[$style.line]: true,
									[$style.lineSelected]: highlightedIds.has(line.id),
									[$style.lineFaded]: highlightedIds.size > 0 && !highlightedIds.has(line.id),
									[$style.lineDimmed]: line.dimmed,
								}"
								data-test-id="data-mapper-line"
								@click="selection = { kind: 'mapping', id: line.id }"
							>
								<path :d="line.d" :class="$style.hit" />
								<path :d="line.d" :class="$style.stroke" />
							</g>
						</svg>
					</div>

					<FunctionEditor
						v-if="selectedFunction"
						:key="selectedFunction.key"
						:fn="selectedFunction"
						:read-only="isReadOnly"
						@update="updateFunction"
						@delete="deleteFunction(selectedFunction.key)"
						@close="selection = null"
					/>
					<MappingEditor
						v-else-if="selectedMapping"
						:mapping="selectedMapping"
						:functions="functions"
						:read-only="isReadOnly"
						@update="updateMapping"
						@delete="deleteMapping(selectedMapping.id)"
						@close="selection = null"
					/>
					<N8nText v-else-if="!isReadOnly" size="xsmall" color="text-light">
						{{ t('dataMapper.hint') }}
					</N8nText>
				</div>
			</div>
		</Teleport>
	</div>
</template>

<style lang="scss" module>
.wrapper {
	margin: var(--spacing--xs) 0;
}

.label {
	margin-bottom: var(--spacing--4xs);
}

.json textarea {
	font-family: var(--font-family--monospace);
	font-size: var(--font-size--2xs);
}

.mapper {
	/* Color of the selected mapping: its fields, ports and lines. */
	--data-mapper--highlight: var(--color--secondary);
	--data-mapper--highlight-background: color-mix(in srgb, var(--color--secondary) 22%, transparent);

	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
}

.backdrop {
	position: fixed;
	inset: 0;
	z-index: 1990;
	display: flex;
	padding: var(--spacing--lg);
	background: rgba(0, 0, 0, 0.4);
}

.expanded {
	flex: 1;
	min-width: 0;
	padding: var(--spacing--sm);
	border-radius: var(--radius--lg);
	background: var(--color--background--light-2);
	overflow-y: auto;

	.canvas {
		flex: 1;
		min-height: 420px;
		height: auto;
		grid-template-columns: minmax(0, 340px) minmax(220px, 1fr) minmax(0, 340px);
	}
}

.toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--2xs);
}

.actions {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
}

.canvas {
	position: relative;
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(150px, 1fr) minmax(0, 1fr);
	height: 420px;
	min-height: 0;
}

.functions {
	position: relative;
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
}

.functionsHeader {
	/* Above the line layer, so the Add function menu takes the clicks. */
	position: relative;
	z-index: 4;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: var(--spacing--3xs) var(--spacing--2xs) 0;
	border-bottom: var(--border-width) dashed var(--color--foreground);
}

.functionsBody {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	flex: 1;
	min-height: 0;
	padding: var(--spacing--xs) 0;
	overflow-x: hidden;
	overflow-y: auto;
}

.functionsEmpty {
	padding: 0 var(--spacing--sm);
	text-align: center;
}

.lines {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: visible;
	pointer-events: none;
	z-index: 1;
}

.line {
	pointer-events: auto;
	cursor: pointer;
}

.hit {
	fill: none;
	stroke: transparent;
	stroke-width: 10;
	pointer-events: stroke;
}

.stroke {
	fill: none;
	stroke: var(--color--text--tint-1);
	stroke-width: 1.5;
	pointer-events: none;
}

.line:hover .stroke {
	stroke: var(--color--primary);
}

.lineSelected .stroke {
	stroke: var(--data-mapper--highlight);
	stroke-width: 2.5;
}

.lineFaded .stroke {
	opacity: 0.3;
}

.lineDimmed .stroke {
	stroke-dasharray: 4 3;
	opacity: 0.6;
}
</style>
