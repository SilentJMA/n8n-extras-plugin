<script setup lang="ts">
import { tKey } from '../../extras.i18n';
import { computed, ref, watch } from 'vue';
import { functionSpec } from './engine';
import type { CacheOption, FunctionPort, MapFunction, PortDataType } from './engine';
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
	fn: MapFunction;
	readOnly: boolean;
}>();

const emit = defineEmits<{
	update: [fn: MapFunction];
	delete: [];
	close: [];
}>();

const spec = computed(() => functionSpec(props.fn.type));
const config = computed(() => props.fn.config ?? {});
const typed = computed(() => props.fn.type === 'script' || props.fn.type === 'sqlLookup');
const DATA_TYPES: PortDataType[] = ['character', 'integer', 'float', 'datetime'];
const CACHE: CacheOption[] = ['none', 'document', 'map'];

const t = (key: string) => tKey(`dataMapper.functionEditor.${key}`);

function patch(changes: Partial<MapFunction>) {
	emit('update', { ...props.fn, ...changes });
}

function setConfig(key: string, value: unknown) {
	patch({ config: { ...config.value, [key]: value } });
}

function setColumn(map: 'inputColumns' | 'outputColumns', portKey: number, column: string) {
	const current = (config.value[map] ?? {}) as Record<string, string>;
	setConfig(map, { ...current, [portKey]: column });
}

function updatePort(side: 'inputs' | 'outputs', key: number, changes: Partial<FunctionPort>) {
	patch({ [side]: props.fn[side].map((p) => (p.key === key ? { ...p, ...changes } : p)) });
}

function nextKey() {
	return (
		Math.max(0, ...props.fn.inputs.map((p) => p.key), ...props.fn.outputs.map((p) => p.key)) + 1
	);
}

function addPort(side: 'inputs' | 'outputs') {
	const key = nextKey();
	const prefix = side === 'inputs' ? 'input' : 'output';
	const port: FunctionPort = { key, name: `${prefix}${key}` };
	if (typed.value) port.dataType = 'character';
	if (props.fn.type === 'stringConcat') port.default = '';
	patch({ [side]: [...props.fn[side], port] });
}

function removePort(side: 'inputs' | 'outputs', key: number) {
	patch({ [side]: props.fn[side].filter((p) => p.key !== key) });
}

// ---- Simple Lookup table ----
type LookupRow = { key: string; value: string };
const lookupRows = computed<LookupRow[]>(() =>
	Array.isArray(config.value.rows) ? (config.value.rows as LookupRow[]) : [],
);
function setLookupRow(index: number, changes: Partial<LookupRow>) {
	setConfig(
		'rows',
		lookupRows.value.map((row, i) => (i === index ? { ...row, ...changes } : row)),
	);
}

// ---- User-Defined steps, edited as JSON for now ----
const udfText = ref('');
const udfError = ref<string | null>(null);
watch(
	() => props.fn,
	(fn) => {
		if (fn.type !== 'userDefined') return;
		udfText.value = JSON.stringify(
			{ steps: fn.config?.steps ?? [], links: fn.config?.links ?? [] },
			null,
			2,
		);
		udfError.value = null;
	},
	{ immediate: true },
);
function applyUdf() {
	try {
		const parsed = JSON.parse(udfText.value) as { steps?: unknown; links?: unknown };
		if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.links)) {
			throw new Error(t('udfShape'));
		}
		udfError.value = null;
		patch({ config: { ...config.value, steps: parsed.steps, links: parsed.links } });
	} catch (error) {
		udfError.value = error instanceof Error ? error.message : String(error);
	}
}
</script>

<template>
	<div :class="$style.editor" data-test-id="data-mapper-function-editor">
		<header :class="$style.header">
			<N8nText size="small" bold>
				{{ tKey(`dataMapper.function.${fn.type}.label`) }}
			</N8nText>
			<N8nIconButton
				variant="ghost"
				size="small"
				icon="x"
				:title="tKey('dataMapper.editor.close')"
				@click="emit('close')"
			/>
		</header>
		<N8nText size="xsmall" color="text-light">
			{{ tKey(`dataMapper.function.${fn.type}.description`) }}
		</N8nText>

		<div :class="$style.grid">
			<N8nInputLabel :label="t('name')" size="small">
				<N8nInput
					:model-value="fn.name ?? ''"
					size="small"
					:disabled="readOnly"
					:placeholder="tKey(`dataMapper.function.${fn.type}.label`)"
					@update:model-value="(name: string) => patch({ name: name || undefined })"
				/>
			</N8nInputLabel>
			<N8nInputLabel v-if="spec?.cacheable" :label="t('cache')" size="small">
				<N8nSelect
					:model-value="fn.cache ?? 'none'"
					size="small"
					teleported
					:disabled="readOnly"
					@update:model-value="(cache: CacheOption) => patch({ cache })"
				>
					<N8nOption v-for="c in CACHE" :key="c" :value="c" :label="t(`cache.${c}`)" />
				</N8nSelect>
			</N8nInputLabel>
		</div>

		<!-- Ports -->
		<div v-for="side in ['inputs', 'outputs'] as const" :key="side" :class="$style.ports">
			<N8nText size="small" bold>{{ t(side) }}</N8nText>
			<div v-for="port in fn[side]" :key="port.key" :class="$style.portRow">
				<N8nInput
					:model-value="port.name"
					size="small"
					:disabled="
						readOnly || !(side === 'inputs' ? spec?.variableInputs : spec?.variableOutputs)
					"
					:class="$style.portName"
					@update:model-value="(name: string) => updatePort(side, port.key, { name })"
				/>
				<N8nInput
					v-if="side === 'inputs' && fn.type !== 'script' && fn.type !== 'sqlLookup'"
					:model-value="port.default ?? ''"
					size="small"
					:disabled="readOnly"
					:placeholder="t('default')"
					@update:model-value="(value: string) => updatePort(side, port.key, { default: value })"
				/>
				<N8nSelect
					v-if="typed && (side === 'inputs' || fn.type === 'sqlLookup')"
					:model-value="port.dataType ?? 'character'"
					size="small"
					teleported
					:disabled="readOnly"
					@update:model-value="(dataType: PortDataType) => updatePort(side, port.key, { dataType })"
				>
					<N8nOption v-for="d in DATA_TYPES" :key="d" :value="d" :label="t(`dataType.${d}`)" />
				</N8nSelect>
				<N8nInput
					v-if="fn.type === 'dataTableLookup'"
					:model-value="
						(
							(config[side === 'inputs' ? 'inputColumns' : 'outputColumns'] ?? {}) as Record<
								string,
								string
							>
						)[port.key] ?? ''
					"
					size="small"
					:disabled="readOnly"
					:placeholder="t('column')"
					@update:model-value="
						(column: string) =>
							setColumn(side === 'inputs' ? 'inputColumns' : 'outputColumns', port.key, column)
					"
				/>
				<N8nIconButton
					v-if="!readOnly && (side === 'inputs' ? spec?.variableInputs : spec?.variableOutputs)"
					variant="ghost"
					size="small"
					icon="trash-2"
					:title="t('removePort')"
					@click="removePort(side, port.key)"
				/>
			</div>
			<N8nButton
				v-if="!readOnly && (side === 'inputs' ? spec?.variableInputs : spec?.variableOutputs)"
				variant="ghost"
				size="small"
				icon="plus"
				:label="side === 'inputs' ? t('addInput') : t('addOutput')"
				@click="addPort(side)"
			/>
		</div>

		<!-- Configuration by type -->
		<template v-if="fn.type === 'script'">
			<N8nInputLabel :label="t('language')" size="small">
				<N8nSelect
					:model-value="String(config.language ?? 'javascript')"
					size="small"
					teleported
					:disabled="readOnly"
					@update:model-value="(language: string) => setConfig('language', language)"
				>
					<N8nOption value="javascript" label="JavaScript" />
					<N8nOption value="python" label="Python" />
				</N8nSelect>
			</N8nInputLabel>
			<N8nInputLabel :label="t('code')" :tooltip-text="t('codeHint')" size="small">
				<N8nInput
					:model-value="String(config.code ?? '')"
					type="textarea"
					:rows="6"
					:class="$style.code"
					:disabled="readOnly"
					data-test-id="data-mapper-script-code"
					@update:model-value="(code: string) => setConfig('code', code)"
				/>
			</N8nInputLabel>
		</template>

		<template v-if="fn.type === 'sqlLookup'">
			<N8nInputLabel :label="t('sql')" :tooltip-text="t('sqlHint')" size="small">
				<N8nInput
					:model-value="String(config.sql ?? '')"
					type="textarea"
					:rows="3"
					:class="$style.code"
					:disabled="readOnly"
					@update:model-value="(sql: string) => setConfig('sql', sql)"
				/>
			</N8nInputLabel>
		</template>

		<N8nInputLabel v-if="fn.type === 'dataTableLookup'" :label="t('dataTable')" size="small">
			<N8nInput
				:model-value="String(config.dataTable ?? '')"
				size="small"
				:disabled="readOnly"
				:placeholder="t('dataTablePlaceholder')"
				@update:model-value="(value: string) => setConfig('dataTable', value)"
			/>
		</N8nInputLabel>

		<div v-if="fn.type === 'simpleLookup'" :class="$style.ports">
			<N8nText size="small" bold>{{ t('table') }}</N8nText>
			<div v-for="(row, index) in lookupRows" :key="index" :class="$style.portRow">
				<N8nInput
					:model-value="row.key"
					size="small"
					:disabled="readOnly"
					:placeholder="t('key')"
					@update:model-value="(key: string) => setLookupRow(index, { key })"
				/>
				<N8nInput
					:model-value="row.value"
					size="small"
					:disabled="readOnly"
					:placeholder="t('value')"
					@update:model-value="(value: string) => setLookupRow(index, { value })"
				/>
				<N8nIconButton
					v-if="!readOnly"
					variant="ghost"
					size="small"
					icon="trash-2"
					:title="t('removeRow')"
					@click="
						setConfig(
							'rows',
							lookupRows.filter((_, i) => i !== index),
						)
					"
				/>
			</div>
			<N8nButton
				v-if="!readOnly"
				variant="ghost"
				size="small"
				icon="plus"
				:label="t('addRow')"
				@click="setConfig('rows', [...lookupRows, { key: '', value: '' }])"
			/>
		</div>

		<div v-if="fn.type === 'japaneseConvert'" :class="$style.grid">
			<N8nInputLabel v-for="field in ['from', 'to']" :key="field" :label="t(field)" size="small">
				<N8nSelect
					:model-value="String(config[field] ?? '')"
					size="small"
					teleported
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig(field, value)"
				>
					<N8nOption
						v-for="script in ['hiragana', 'katakanaFull', 'katakanaHalf']"
						:key="script"
						:value="script"
						:label="t(`script.${script}`)"
					/>
				</N8nSelect>
			</N8nInputLabel>
		</div>

		<div v-if="fn.type === 'sequentialValue'" :class="$style.grid">
			<N8nInputLabel :label="t('keyName')" size="small">
				<N8nInput
					:model-value="String(config.keyName ?? '')"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('keyName', value)"
				/>
			</N8nInputLabel>
			<N8nInputLabel :label="t('fixedLength')" size="small">
				<N8nInput
					:model-value="String(config.fixedLength ?? '')"
					type="number"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('fixedLength', Number(value))"
				/>
			</N8nInputLabel>
			<N8nInputLabel :label="t('batchSize')" size="small">
				<N8nInput
					:model-value="String(config.batchSize ?? 1)"
					type="number"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('batchSize', Number(value))"
				/>
			</N8nInputLabel>
		</div>

		<div v-if="fn.type === 'stringConcat'" :class="$style.grid">
			<N8nInputLabel :label="t('delimiter')" size="small">
				<N8nInput
					:model-value="String(config.delimiter ?? '')"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('delimiter', value)"
				/>
			</N8nInputLabel>
			<N8nInputLabel :label="t('fixedLength')" size="small">
				<N8nInput
					:model-value="String(config.fixedLength ?? '')"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('fixedLength', value)"
				/>
			</N8nInputLabel>
		</div>

		<div v-if="fn.type === 'stringSplit'" :class="$style.grid">
			<N8nInputLabel :label="t('splitMode')" size="small">
				<N8nSelect
					:model-value="String(config.mode ?? 'delimiter')"
					size="small"
					teleported
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('mode', value)"
				>
					<N8nOption value="delimiter" :label="t('delimiter')" />
					<N8nOption value="length" :label="t('splitLength')" />
				</N8nSelect>
			</N8nInputLabel>
			<N8nInputLabel v-if="config.mode !== 'length'" :label="t('delimiter')" size="small">
				<N8nInput
					:model-value="String(config.delimiter ?? ',')"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('delimiter', value)"
				/>
			</N8nInputLabel>
			<N8nInputLabel v-else :label="t('splitLength')" size="small">
				<N8nInput
					:model-value="String(config.splitLength ?? 3)"
					type="number"
					size="small"
					:disabled="readOnly"
					@update:model-value="(value: string) => setConfig('splitLength', Number(value))"
				/>
			</N8nInputLabel>
		</div>

		<template v-if="fn.type === 'userDefined'">
			<N8nInputLabel :label="t('steps')" :tooltip-text="t('stepsHint')" size="small">
				<N8nInput
					v-model="udfText"
					type="textarea"
					:rows="8"
					:class="$style.code"
					:disabled="readOnly"
				/>
			</N8nInputLabel>
			<N8nText v-if="udfError" size="xsmall" color="danger">{{ udfError }}</N8nText>
			<div>
				<N8nButton
					v-if="!readOnly"
					variant="ghost"
					size="small"
					:label="t('applySteps')"
					@click="applyUdf"
				/>
			</div>
		</template>

		<footer v-if="!readOnly" :class="$style.footer">
			<N8nButton
				variant="ghost"
				size="small"
				icon="trash-2"
				:label="t('delete')"
				data-test-id="data-mapper-delete-function"
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
}

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
	gap: var(--spacing--2xs);
}

.ports {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}

.portRow {
	display: flex;
	align-items: center;
	gap: var(--spacing--4xs);

	> * {
		flex: 1;
		min-width: 0;
	}

	> button {
		flex: 0 0 auto;
	}
}

.portName {
	flex: 1.2;
}

.code textarea {
	font-family: var(--font-family--monospace);
	font-size: var(--font-size--2xs);
}

.footer {
	display: flex;
	justify-content: flex-end;
}
</style>
