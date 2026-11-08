<script setup lang="ts">
import { t, tKey } from '../../extras.i18n';
import { computed } from 'vue';
import { functionLabel, TRANSFORMS } from './engine';
import type { IfMissing, LookupFallback, MapFunction, Transform, VisualMapping } from './engine';
import {
	N8nButton,
	N8nIconButton,
	N8nInput,
	N8nInputLabel,
	N8nOption,
	N8nSelect,
	N8nText,
} from '@n8n/design-system';

const props = defineProps<{
	mapping: VisualMapping;
	readOnly: boolean;
	functions: MapFunction[];
}>();

function portLabel(
	fnKey: number | undefined,
	portKey: number | undefined,
	side: 'inputs' | 'outputs',
) {
	const fn = props.functions.find((f) => f.key === fnKey);
	const port = fn?.[side].find((p) => p.key === portKey);
	return {
		function: fn ? functionLabel(fn) : String(fnKey),
		port: port?.name ?? String(portKey),
	};
}

const emit = defineEmits<{
	update: [mapping: VisualMapping];
	delete: [];
	close: [];
}>();

const fromFunction = computed(() => props.mapping.fromFunction !== undefined);
const toFunction = computed(() => props.mapping.toFunction !== undefined);
const isFixed = computed(() => props.mapping.source === undefined && !fromFunction.value);
const fromText = computed(() =>
	fromFunction.value
		? t(
				'dataMapper.editor.functionOutput',
				portLabel(props.mapping.fromFunction, props.mapping.fromKey, 'outputs'),
			)
		: (props.mapping.source ?? ''),
);
const toText = computed(() =>
	toFunction.value
		? t(
				'dataMapper.editor.functionInput',
				portLabel(props.mapping.toFunction, props.mapping.toKey, 'inputs'),
			)
		: props.mapping.target,
);
/** Older maps set a transform on the line itself. New maps use function boxes instead. */
const showTransform = computed(() => props.mapping.transform !== 'none');

const transformOptions = computed(() =>
	TRANSFORMS.map((t) => ({
		value: t.value,
		label: tKey(`dataMapper.transform.${t.value}`),
	})),
);

const IF_MISSING: IfMissing[] = ['skip', 'null', 'default', 'error'];
const LOOKUP_FALLBACK: LookupFallback[] = ['keep', 'default', 'null', 'error'];

function patch(changes: Partial<VisualMapping>) {
	emit('update', { ...props.mapping, ...changes });
}

function setTransform(transform: Transform) {
	patch({ transform });
}
</script>

<template>
	<div :class="$style.editor" data-test-id="data-mapper-mapping-editor">
		<header :class="$style.header">
			<N8nText size="small" bold :class="$style.title">
				<template v-if="isFixed">{{ t('dataMapper.editor.fixedValueFor') }}</template>
				<template v-else>
					<code>{{ fromText }}</code>
					→
				</template>
				<code>{{ toText }}</code>
			</N8nText>
			<N8nIconButton
				variant="ghost"
				size="small"
				icon="x"
				:title="t('dataMapper.editor.close')"
				@click="emit('close')"
			/>
		</header>

		<div :class="$style.grid">
			<N8nInputLabel v-if="isFixed" :label="t('dataMapper.editor.value')" size="small">
				<N8nInput
					:model-value="mapping.value ?? ''"
					size="small"
					:disabled="readOnly"
					:placeholder="t('dataMapper.editor.valuePlaceholder')"
					data-test-id="data-mapper-value-input"
					@update:model-value="(value: string) => patch({ value })"
				/>
			</N8nInputLabel>

			<N8nInputLabel v-if="showTransform" :label="t('dataMapper.editor.function')" size="small">
				<N8nSelect
					:model-value="mapping.transform"
					size="small"
					teleported
					:disabled="readOnly"
					data-test-id="data-mapper-transform-select"
					@update:model-value="setTransform"
				>
					<N8nOption
						v-for="option in transformOptions"
						:key="option.value"
						:value="option.value"
						:label="option.label"
					/>
				</N8nSelect>
			</N8nInputLabel>

			<N8nInputLabel
				v-if="mapping.transform === 'split' || mapping.transform === 'join'"
				:label="t('dataMapper.editor.separator')"
				size="small"
			>
				<N8nInput
					:model-value="mapping.separator ?? ','"
					size="small"
					:disabled="readOnly"
					@update:model-value="(separator: string) => patch({ separator })"
				/>
			</N8nInputLabel>

			<N8nInputLabel
				v-if="mapping.transform === 'round'"
				:label="t('dataMapper.editor.decimals')"
				size="small"
			>
				<N8nInput
					:model-value="String(mapping.decimals ?? 2)"
					type="number"
					size="small"
					:disabled="readOnly"
					@update:model-value="(decimals: string) => patch({ decimals: Number(decimals) })"
				/>
			</N8nInputLabel>

			<N8nInputLabel
				v-if="mapping.transform === 'concat'"
				:label="t('dataMapper.editor.template')"
				:tooltip-text="t('dataMapper.editor.templateHint')"
				size="small"
			>
				<N8nInput
					:model-value="mapping.template ?? '{value}'"
					size="small"
					:disabled="readOnly"
					@update:model-value="(template: string) => patch({ template })"
				/>
			</N8nInputLabel>

			<template v-if="mapping.transform === 'date'">
				<N8nInputLabel :label="t('dataMapper.editor.dateInputFormat')" size="small">
					<N8nInput
						:model-value="mapping.dateInputFormat ?? ''"
						size="small"
						placeholder="dd.MM.yyyy"
						:disabled="readOnly"
						@update:model-value="(dateInputFormat: string) => patch({ dateInputFormat })"
					/>
				</N8nInputLabel>
				<N8nInputLabel :label="t('dataMapper.editor.dateOutputFormat')" size="small">
					<N8nInput
						:model-value="mapping.dateOutputFormat ?? ''"
						size="small"
						placeholder="yyyy-MM-dd"
						:disabled="readOnly"
						@update:model-value="(dateOutputFormat: string) => patch({ dateOutputFormat })"
					/>
				</N8nInputLabel>
			</template>

			<template v-if="mapping.transform === 'lookup'">
				<N8nInputLabel :label="t('dataMapper.editor.lookup')" size="small">
					<N8nInput
						:model-value="mapping.lookup ?? ''"
						type="textarea"
						:rows="3"
						size="small"
						placeholder="DE=Germany&#10;FR=France"
						:disabled="readOnly"
						@update:model-value="(lookup: string) => patch({ lookup })"
					/>
				</N8nInputLabel>
				<N8nInputLabel :label="t('dataMapper.editor.lookupFallback')" size="small">
					<N8nSelect
						:model-value="mapping.lookupFallback ?? 'keep'"
						size="small"
						teleported
						:disabled="readOnly"
						@update:model-value="(lookupFallback: LookupFallback) => patch({ lookupFallback })"
					>
						<N8nOption
							v-for="option in LOOKUP_FALLBACK"
							:key="option"
							:value="option"
							:label="tKey(`dataMapper.lookupFallback.${option}`)"
						/>
					</N8nSelect>
				</N8nInputLabel>
				<N8nInputLabel
					v-if="mapping.lookupFallback === 'default'"
					:label="t('dataMapper.editor.default')"
					size="small"
				>
					<N8nInput
						:model-value="mapping.lookupDefault ?? ''"
						size="small"
						:disabled="readOnly"
						@update:model-value="(lookupDefault: string) => patch({ lookupDefault })"
					/>
				</N8nInputLabel>
			</template>

			<template v-if="!isFixed && !fromFunction && !toFunction">
				<N8nInputLabel :label="t('dataMapper.editor.ifMissing')" size="small">
					<N8nSelect
						:model-value="mapping.ifMissing"
						size="small"
						teleported
						:disabled="readOnly"
						@update:model-value="(ifMissing: IfMissing) => patch({ ifMissing })"
					>
						<N8nOption
							v-for="option in IF_MISSING"
							:key="option"
							:value="option"
							:label="tKey(`dataMapper.ifMissing.${option}`)"
						/>
					</N8nSelect>
				</N8nInputLabel>
				<N8nInputLabel
					v-if="mapping.ifMissing === 'default'"
					:label="t('dataMapper.editor.default')"
					size="small"
				>
					<N8nInput
						:model-value="mapping.default ?? ''"
						size="small"
						:disabled="readOnly"
						@update:model-value="(value: string) => patch({ default: value })"
					/>
				</N8nInputLabel>
			</template>
		</div>

		<footer v-if="!readOnly" :class="$style.footer">
			<N8nButton
				variant="ghost"
				size="small"
				icon="trash-2"
				:label="t('dataMapper.editor.delete')"
				data-test-id="data-mapper-delete-mapping"
				@click="emit('delete')"
			/>
		</footer>
	</div>
</template>

<style lang="scss" module>
.editor {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	padding: var(--spacing--xs);
	border: var(--border-width) solid var(--color--primary--tint-1);
	border-radius: var(--radius);
	background: var(--color--background--light-3);
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--2xs);
}

.title code {
	font-family: var(--font-family--monospace);
	font-size: var(--font-size--2xs);
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
	gap: var(--spacing--2xs);
}

.footer {
	display: flex;
	justify-content: flex-end;
}
</style>
