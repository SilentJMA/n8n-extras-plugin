<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { N8nHeading, N8nSwitch2, N8nText } from '@n8n/design-system';
import { useToast } from '@n8n/composables/useToast';
import { useUsersStore } from '@n8n/stores/users.store';

import type { ExtrasFeatures } from '../extras.api';
import { t, type ExtrasMessageKey } from '../extras.i18n';
import { useExtrasStore } from '../extras.store';

const store = useExtrasStore();
const usersStore = useUsersStore();
const toast = useToast();

const saving = ref<keyof ExtrasFeatures | null>(null);

// Switching features is limited to users who may install packages (instance admins).
const canManage = computed(
	() => usersStore.currentUser?.globalScopes?.includes('communityPackage:install') ?? false,
);

const FEATURES: Array<keyof ExtrasFeatures> = [
	'publishedTab',
	'folderExpand',
	'executeFromList',
	'pauseResume',
	'executionTracking',
];

onMounted(() => {
	void store.ensureLoaded().catch(() => {});
});

async function onToggle(feature: keyof ExtrasFeatures, value: boolean) {
	saving.value = feature;
	try {
		await store.updateFeatures({ [feature]: value });
		toast.showMessage({ title: t('settings.saved'), type: 'success' });
	} catch (error) {
		toast.showError(error, t('settings.error'));
	} finally {
		saving.value = null;
	}
}
</script>

<template>
	<div :class="$style.container" data-test-id="extras-plugins-settings">
		<N8nHeading tag="h1" size="2xlarge">{{ t('settings.title') }}</N8nHeading>
		<N8nText color="text-light">{{ t('settings.subtitle') }}</N8nText>
		<N8nText v-if="!canManage" color="text-light" size="small">
			{{ t('settings.adminOnly') }}
		</N8nText>

		<ul :class="$style.list">
			<li v-for="feature in FEATURES" :key="feature" :class="$style.row">
				<div :class="$style.text">
					<N8nText bold>{{ t(`feature.${feature}` as ExtrasMessageKey) }}</N8nText>
					<N8nText size="small" color="text-light">
						{{ t(`feature.${feature}.description` as ExtrasMessageKey) }}
					</N8nText>
				</div>
				<N8nSwitch2
					:model-value="store.features[feature]"
					:disabled="!canManage || saving === feature"
					:aria-label="t(`feature.${feature}` as ExtrasMessageKey)"
					:data-test-id="`extras-feature-${feature}`"
					@update:model-value="(value) => onToggle(feature, Boolean(value))"
				/>
			</li>
		</ul>
	</div>
</template>

<style lang="scss" module>
.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding-bottom: var(--spacing--2xl);
}

.list {
	list-style: none;
	margin: var(--spacing--sm) 0 0;
	padding: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--lg);
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius);
}

.text {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--5xs);
}
</style>
