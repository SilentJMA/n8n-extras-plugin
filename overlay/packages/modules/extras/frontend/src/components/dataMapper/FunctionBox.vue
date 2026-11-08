<script setup lang="ts">
import { tKey } from '../../extras.i18n';
import { ref } from 'vue';
import { functionLabel } from './engine';
import type { FunctionPort, MapFunction } from './engine';
import { DRAG_FIELD, DRAG_FUNCTION_OUTPUT, portId } from './dataMapper.utils';

const props = defineProps<{
	fn: MapFunction;
	selected: boolean;
	readOnly: boolean;
	/** Port ids (see `portId`) that a mapping uses. */
	connected: Set<string>;
	/** Port ids of the selected mappings. */
	highlighted: Set<string>;
}>();

const emit = defineEmits<{
	select: [];
	connectInput: [portKey: number, sourcePath: string];
	chainRejected: [];
}>();

const dropPort = ref<number | null>(null);

const title = () =>
	props.fn.name || tKey(`dataMapper.function.${props.fn.type}.label`) || functionLabel(props.fn);

function onDragOver(event: DragEvent, port: FunctionPort) {
	if (props.readOnly) return;
	const types = event.dataTransfer?.types ?? [];
	if (types.includes(DRAG_FIELD) || types.includes(DRAG_FUNCTION_OUTPUT)) {
		event.preventDefault();
		dropPort.value = port.key;
	}
}

function onDrop(event: DragEvent, port: FunctionPort) {
	dropPort.value = null;
	event.preventDefault();
	if (event.dataTransfer?.types.includes(DRAG_FUNCTION_OUTPUT)) {
		// A function never feeds another function directly: use a User-Defined function for chains.
		emit('chainRejected');
		return;
	}
	const source = event.dataTransfer?.getData(DRAG_FIELD);
	if (source) emit('connectInput', port.key, source);
}

function onOutputDragStart(event: DragEvent, port: FunctionPort) {
	if (!event.dataTransfer || props.readOnly) return;
	event.dataTransfer.setData(DRAG_FUNCTION_OUTPUT, `${props.fn.key}:${port.key}`);
	event.dataTransfer.effectAllowed = 'link';
}
</script>

<template>
	<div
		:class="{ [$style.box]: true, [$style.selected]: selected }"
		:data-function-key="fn.key"
		data-test-id="data-mapper-function-box"
		@click="emit('select')"
	>
		<div :class="$style.title" :title="tKey(`dataMapper.function.${fn.type}.description`)">
			{{ title() }}
		</div>
		<div :class="$style.ports">
			<div :class="$style.inputs">
				<div
					v-for="port in fn.inputs"
					:key="port.key"
					:class="{
						[$style.port]: true,
						[$style.drop]: dropPort === port.key,
						[$style.portHighlighted]: highlighted.has(portId(fn.key, 'in', port.key)),
					}"
					data-test-id="data-mapper-function-input"
					@dragover="onDragOver($event, port)"
					@dragleave="dropPort = dropPort === port.key ? null : dropPort"
					@drop="onDrop($event, port)"
				>
					<span
						:class="{
							[$style.dot]: true,
							[$style.dotIn]: true,
							[$style.dotOn]: connected.has(portId(fn.key, 'in', port.key)),
						}"
						:data-port="portId(fn.key, 'in', port.key)"
					/>
					<span :class="$style.portName">{{ port.name }}</span>
					<span v-if="port.default" :class="$style.default">={{ port.default }}</span>
				</div>
			</div>
			<div :class="$style.outputs">
				<div
					v-for="port in fn.outputs"
					:key="port.key"
					:class="{
						[$style.port]: true,
						[$style.outPort]: true,
						[$style.portHighlighted]: highlighted.has(portId(fn.key, 'out', port.key)),
					}"
					:draggable="!readOnly"
					data-test-id="data-mapper-function-output"
					@dragstart="onOutputDragStart($event, port)"
				>
					<span :class="$style.portName">{{ port.name }}</span>
					<span
						:class="{
							[$style.dot]: true,
							[$style.dotOut]: true,
							[$style.dotOn]: connected.has(portId(fn.key, 'out', port.key)),
						}"
						:data-port="portId(fn.key, 'out', port.key)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.box {
	/* Above the line layer: lines end at the port dots on the box edges. */
	position: relative;
	z-index: 2;
	flex-shrink: 0;
	width: min(220px, calc(100% - 2 * var(--spacing--xl)));
	margin: 0 auto;
	border: var(--border-width) solid var(--color--foreground--shade-1);
	border-radius: var(--radius);
	background: var(--color--background--light-3);
	font-size: var(--font-size--3xs);
	cursor: pointer;
}

.selected {
	border-color: var(--data-mapper--highlight);
	box-shadow: 0 0 0 1px var(--data-mapper--highlight);
}

.title {
	padding: var(--spacing--4xs) var(--spacing--2xs);
	border-bottom: var(--border-width) solid var(--color--foreground);
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
	color: var(--color--text--shade-1);
	text-align: center;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.ports {
	display: flex;
	justify-content: space-between;
	gap: var(--spacing--2xs);
	padding: var(--spacing--4xs) 0;
}

.inputs,
.outputs {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

.outputs {
	align-items: flex-end;
}

.port {
	position: relative;
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);
	height: 18px;
	padding: 0 var(--spacing--3xs);
	color: var(--color--text);
	white-space: nowrap;
	min-width: 0;
}

.outPort {
	cursor: grab;
}

.drop {
	background: var(--color--primary--tint-2);
	outline: 1px dashed var(--color--primary);
}

.portName {
	overflow: hidden;
	text-overflow: ellipsis;
}

.default {
	overflow: hidden;
	max-width: 60px;
	color: var(--color--text--tint-1);
	font-family: var(--font-family--monospace);
	text-overflow: ellipsis;
}

.dot {
	flex-shrink: 0;
	width: 8px;
	height: 8px;
	border: var(--border-width) solid var(--color--text--tint-1);
	border-radius: 50%;
	background: var(--color--background--light-3);
}

.dotIn {
	margin-left: -8px;
}

.dotOut {
	margin-right: -8px;
}

.dotOn {
	border-color: var(--color--primary);
	background: var(--color--primary);
}

.portHighlighted {
	background: var(--data-mapper--highlight-background);
	color: var(--color--text--shade-1);
	font-weight: var(--font-weight--bold);

	.dot {
		border-color: var(--data-mapper--highlight);
		background: var(--data-mapper--highlight);
	}
}
</style>
