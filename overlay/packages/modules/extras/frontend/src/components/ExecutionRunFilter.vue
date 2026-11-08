<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { N8nOption, N8nSelect } from '@n8n/design-system';
import { useUsersStore } from '@n8n/stores/users.store';

import { t } from '../extras.i18n';
import { useExtrasStore } from '../extras.store';

/**
 * Filter fields for the executions list: run type (manual / automatic) and who ran it.
 * The shell passes the `ext` filter object as `modelValue` and sends it to the backend as is.
 */
const props = defineProps<{ modelValue: Record<string, unknown> }>();
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>] }>();

const store = useExtrasStore();
const usersStore = useUsersStore();

onMounted(() => {
	void store.ensureLoaded().catch(() => {});
});

const visible = computed(() => store.features.executionTracking);

const runType = computed({
	get: () =>
		typeof props.modelValue.manualExecution === 'boolean'
			? props.modelValue.manualExecution
				? 'manual'
				: 'automatic'
			: 'all',
	set: (value: string) => {
		const { manualExecution: _removed, ...rest } = props.modelValue;
		emit(
			'update:modelValue',
			value === 'all' ? rest : { ...rest, manualExecution: value === 'manual' },
		);
	},
});

const runBy = computed({
	get: () =>
		typeof props.modelValue.executedByUserId === 'string'
			? props.modelValue.executedByUserId
			: 'all',
	set: (value: string) => {
		const { executedByUserId: _removed, ...rest } = props.modelValue;
		emit('update:modelValue', value === 'all' ? rest : { ...rest, executedByUserId: value });
	},
});

const runTypeOptions = computed(() => [
	{ id: 'all', name: t('executions.runType.all') },
	{ id: 'manual', name: t('executions.runType.manual') },
	{ id: 'automatic', name: t('executions.runType.automatic') },
]);

const runByOptions = computed(() => [
	{ id: 'all', name: t('executions.runBy.all') },
	...usersStore.allUsers.map((user) => ({
		id: user.id,
		name: user.fullName ?? user.email ?? user.id,
	})),
]);
</script>

<template>
	<div v-if="visible" :class="$style.fields" data-test-id="extras-execution-filter">
		<div :class="$style.field">
			<label for="extras-filter-run-type">{{ t('executions.runType') }}</label>
			<N8nSelect
				id="extras-filter-run-type"
				v-model="runType"
				data-test-id="extras-filter-run-type"
			>
				<N8nOption
					v-for="item in runTypeOptions"
					:key="item.id"
					:label="item.name"
					:value="item.id"
				/>
			</N8nSelect>
		</div>
		<div :class="$style.field">
			<label for="extras-filter-run-by">{{ t('executions.runBy') }}</label>
			<N8nSelect
				id="extras-filter-run-by"
				v-model="runBy"
				filterable
				data-test-id="extras-filter-run-by"
			>
				<N8nOption
					v-for="item in runByOptions"
					:key="item.id"
					:label="item.name"
					:value="item.id"
				/>
			</N8nSelect>
		</div>
	</div>
</template>

<style lang="scss" module>
.fields {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

.field {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
}
</style>
