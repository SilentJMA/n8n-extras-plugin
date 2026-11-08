<script setup lang="ts">
import { t, tKey } from '../../extras.i18n';
import { computed, ref } from 'vue';
import { FUNCTION_CATEGORIES, FUNCTION_SPECS } from './engine';
import type { FunctionType } from './engine';
import { N8nButton, N8nInput } from '@n8n/design-system';

defineProps<{ disabled: boolean }>();

const emit = defineEmits<{ add: [type: FunctionType] }>();

const open = ref(false);
const query = ref('');

const groups = computed(() => {
	const q = query.value.trim().toLowerCase();
	return FUNCTION_CATEGORIES.map((category) => ({
		label: tKey(`dataMapper.category.${category.value}`),
		items: FUNCTION_SPECS.filter((spec) => spec.category === category.value)
			.map((spec) => ({
				type: spec.type,
				label: tKey(`dataMapper.function.${spec.type}.label`),
				description: tKey(`dataMapper.function.${spec.type}.description`),
			}))
			.filter((item) => !q || `${item.label} ${item.description}`.toLowerCase().includes(q)),
	})).filter((group) => group.items.length > 0);
});

function pick(type: FunctionType) {
	open.value = false;
	query.value = '';
	emit('add', type);
}
</script>

<template>
	<div :class="$style.menu">
		<N8nButton
			variant="ghost"
			size="small"
			icon="plus"
			:label="t('dataMapper.addFunction')"
			:disabled="disabled"
			data-test-id="data-mapper-add-function"
			@click="open = !open"
		/>
		<div v-if="open" :class="$style.panel" data-test-id="data-mapper-function-menu">
			<N8nInput
				v-model="query"
				size="small"
				:placeholder="t('dataMapper.searchFunction')"
				clearable
				autofocus
			/>
			<div :class="$style.list">
				<template v-for="group in groups" :key="group.label">
					<div :class="$style.category">{{ group.label }}</div>
					<button
						v-for="item in group.items"
						:key="item.type"
						type="button"
						:class="$style.item"
						:title="item.description"
						:data-test-id="`data-mapper-function-option-${item.type}`"
						@click="pick(item.type)"
					>
						{{ item.label }}
					</button>
				</template>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
.menu {
	position: relative;
	display: flex;
	justify-content: center;
}

.panel {
	position: absolute;
	top: 100%;
	left: 50%;
	z-index: 10;
	width: 260px;
	transform: translateX(-50%);
	padding: var(--spacing--3xs);
	border: var(--border-width) solid var(--color--foreground--shade-1);
	border-radius: var(--radius);
	background: var(--color--background--light-3);
	box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}

.list {
	max-height: 320px;
	margin-top: var(--spacing--3xs);
	overflow-y: auto;
}

.category {
	padding: var(--spacing--3xs) var(--spacing--2xs) var(--spacing--4xs);
	font-size: var(--font-size--3xs);
	font-weight: var(--font-weight--bold);
	color: var(--color--text--tint-1);
	text-transform: uppercase;
}

.item {
	display: block;
	width: 100%;
	padding: var(--spacing--4xs) var(--spacing--xs);
	border: none;
	border-radius: var(--radius--sm);
	background: none;
	color: var(--color--text);
	font-size: var(--font-size--2xs);
	text-align: left;
	cursor: pointer;

	&:hover {
		background: var(--color--background--light-1);
	}
}
</style>
