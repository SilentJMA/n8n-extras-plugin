<script setup lang="ts">
import { t } from '../../extras.i18n';
import { computed, ref } from 'vue';
import type { FieldType, TreeNode } from './engine';
import { N8nIcon, N8nInput, N8nText } from '@n8n/design-system';
import type { IconName } from '@n8n/design-system';
import { DRAG_FIELD, DRAG_FUNCTION_OUTPUT } from './dataMapper.utils';

const props = defineProps<{
	side: 'source' | 'target';
	title: string;
	rows: TreeNode[];
	visible: Set<string>;
	collapsed: Set<string>;
	mappedPaths: Set<string>;
	selectedPaths: Set<string>;
	/** Fixed values written to target fields, shown next to the field. */
	fixedValues?: Map<string, string>;
	readOnly: boolean;
	emptyText: string;
}>();

const filter = defineModel<string>('filter', { default: '' });

const emit = defineEmits<{
	toggle: [key: string];
	select: [path: string];
	connect: [sourcePath: string, targetPath: string];
	connectFunction: [functionKey: number, portKey: number, targetPath: string];
	addValue: [targetPath: string];
	scroll: [];
}>();

const dropKey = ref<string | null>(null);
const scrollEl = ref<HTMLElement | null>(null);

const shownRows = computed(() => props.rows.filter((row) => props.visible.has(row.key)));

const TYPE_ICONS = new Map<FieldType, IconName>([
	['string', 'type'],
	['number', 'hash'],
	['boolean', 'square-check'],
	['datetime', 'calendar'],
]);

function rowIcon(row: TreeNode): IconName {
	if (!row.field) return row.repeating ? 'list' : 'box';
	if (row.attribute) return 'at-sign';
	return TYPE_ICONS.get(row.field.type) ?? 'type';
}

function onDragStart(event: DragEvent, row: TreeNode) {
	if (!row.field || !event.dataTransfer) return;
	event.dataTransfer.setData(DRAG_FIELD, row.field.path);
	event.dataTransfer.setData('text/plain', row.field.path);
	event.dataTransfer.effectAllowed = 'link';
}

function onDragOver(event: DragEvent, row: TreeNode) {
	if (props.side !== 'target' || props.readOnly || !row.field) return;
	const types = event.dataTransfer?.types ?? [];
	if (!types.includes(DRAG_FIELD) && !types.includes(DRAG_FUNCTION_OUTPUT)) return;
	event.preventDefault();
	if (event.dataTransfer) event.dataTransfer.dropEffect = 'link';
	dropKey.value = row.key;
}

function onDrop(event: DragEvent, row: TreeNode) {
	dropKey.value = null;
	if (!row.field) return;
	const source = event.dataTransfer?.getData(DRAG_FIELD);
	const output = event.dataTransfer?.getData(DRAG_FUNCTION_OUTPUT);
	if (source) {
		event.preventDefault();
		emit('connect', source, row.field.path);
	} else if (output) {
		event.preventDefault();
		const [fnKey, portKey] = output.split(':').map(Number);
		emit('connectFunction', fnKey, portKey, row.field.path);
	}
}

defineExpose({ scrollEl });
</script>

<template>
	<section :class="[$style.tree, $style[side]]" :data-test-id="`data-mapper-${side}-tree`">
		<header :class="$style.header">
			<N8nText size="small" bold>{{ title }}</N8nText>
		</header>
		<N8nInput
			v-model="filter"
			size="small"
			:class="$style.filter"
			:placeholder="t('dataMapper.searchField')"
			clearable
			:data-test-id="`data-mapper-${side}-filter`"
		>
			<template #prefix><N8nIcon icon="search" size="small" /></template>
		</N8nInput>
		<div ref="scrollEl" :class="$style.rows" @scroll.passive="emit('scroll')">
			<N8nText v-if="rows.length === 0" size="small" color="text-light" :class="$style.empty">
				{{ emptyText }}
			</N8nText>
			<div
				v-for="row in shownRows"
				:key="row.key"
				:data-row-key="row.key"
				:class="{
					[$style.row]: true,
					[$style.group]: !row.field,
					[$style.mapped]: row.field && mappedPaths.has(row.field.path),
					[$style.selected]: row.field && selectedPaths.has(row.field.path),
					[$style.dropTarget]: dropKey === row.key,
				}"
				:style="{ [side === 'source' ? 'paddingLeft' : 'paddingRight']: `${row.depth * 14 + 6}px` }"
				:draggable="side === 'source' && !!row.field && !readOnly"
				:title="row.field?.path"
				:data-test-id="`data-mapper-${side}-row`"
				@dragstart="onDragStart($event, row)"
				@dragover="onDragOver($event, row)"
				@dragleave="dropKey = dropKey === row.key ? null : dropKey"
				@drop="onDrop($event, row)"
				@click="row.field ? emit('select', row.field.path) : emit('toggle', row.key)"
			>
				<N8nIcon
					v-if="!row.field"
					:icon="collapsed.has(row.key) ? 'chevron-right' : 'chevron-down'"
					size="xsmall"
					:class="$style.chevron"
				/>
				<N8nIcon :icon="rowIcon(row)" size="xsmall" :class="$style.typeIcon" />
				<span :class="$style.label">{{ row.label }}</span>
				<span v-if="row.repeating" :class="$style.badge">[*]</span>
				<span v-if="row.field?.required" :class="$style.required">*</span>
				<span
					v-if="row.field && fixedValues?.has(row.field.path)"
					:class="$style.fixed"
					data-test-id="data-mapper-fixed-value"
				>
					= "{{ fixedValues.get(row.field.path) }}"
				</span>
				<button
					v-if="side === 'target' && row.field && !readOnly && !mappedPaths.has(row.field.path)"
					type="button"
					:class="$style.addValue"
					:title="t('dataMapper.addFixedValue')"
					data-test-id="data-mapper-add-value"
					@click.stop="emit('addValue', row.field.path)"
				>
					<N8nIcon icon="pencil" size="xsmall" />
				</button>
			</div>
		</div>
	</section>
</template>

<style lang="scss" module>
.tree {
	display: flex;
	flex-direction: column;
	min-width: 0;
	min-height: 0;
	border: var(--border-width) solid var(--color--foreground);
	border-radius: var(--radius);
	background: var(--color--background--light-3);
}

.header {
	padding: var(--spacing--3xs) var(--spacing--2xs);
	border-bottom: var(--border-width) solid var(--color--foreground);
}

.target .header {
	text-align: right;
}

.filter {
	padding: var(--spacing--3xs);
}

.rows {
	flex: 1;
	overflow-y: auto;
	padding-bottom: var(--spacing--2xs);
}

.empty {
	display: block;
	padding: var(--spacing--xs);
}

.row {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	height: 24px;
	padding-right: var(--spacing--3xs);
	font-size: var(--font-size--2xs);
	color: var(--color--text);
	cursor: pointer;
	white-space: nowrap;
	user-select: none;

	&:hover {
		background: var(--color--background--light-1);
	}

	&:hover .addValue {
		visibility: visible;
	}
}

.target .row {
	flex-direction: row-reverse;
	padding-left: var(--spacing--3xs);
}

.source .row[draggable='true'] {
	cursor: grab;
}

.group {
	color: var(--color--text--shade-1);
	font-weight: var(--font-weight--bold);
}

.mapped .label {
	color: var(--color--primary);
	font-weight: var(--font-weight--bold);
}

.selected {
	background: var(--data-mapper--highlight-background);
	box-shadow: inset 3px 0 0 var(--data-mapper--highlight);

	.label {
		color: var(--color--text--shade-1);
		font-weight: var(--font-weight--bold);
	}
}

.target .selected {
	box-shadow: inset -3px 0 0 var(--data-mapper--highlight);
}

.dropTarget {
	background: var(--color--primary--tint-2);
	outline: 1px dashed var(--color--primary);
}

.chevron,
.typeIcon {
	flex-shrink: 0;
	color: var(--color--text--tint-1);
}

.label {
	overflow: hidden;
	text-overflow: ellipsis;
}

.badge {
	font-family: var(--font-family--monospace);
	color: var(--color--text--tint-1);
}

.required {
	color: var(--color--danger);
}

.fixed {
	overflow: hidden;
	max-width: 50%;
	padding: 0 var(--spacing--4xs);
	border: var(--border-width) solid var(--color--success);
	border-radius: var(--radius--sm);
	font-family: var(--font-family--monospace);
	color: var(--color--text--shade-1);
	text-overflow: ellipsis;
}

.addValue {
	visibility: hidden;
	margin-right: auto;
	padding: 0 var(--spacing--4xs);
	border: none;
	background: none;
	color: var(--color--text--tint-1);
	cursor: pointer;

	&:hover {
		color: var(--color--primary);
	}
}
</style>
