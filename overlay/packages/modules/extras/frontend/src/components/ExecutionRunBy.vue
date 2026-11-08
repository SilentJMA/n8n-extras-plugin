<script setup lang="ts">
import { computed } from 'vue';
import { N8nTooltip } from '@n8n/design-system';
import { useUsersStore } from '@n8n/stores/users.store';
import type { ExtensionExecution } from '@n8n/frontend-module-sdk';

import { t } from '../extras.i18n';
import { useExtrasStore } from '../extras.store';

const props = defineProps<{ execution: ExtensionExecution }>();

const store = useExtrasStore();
const usersStore = useUsersStore();

const userName = computed(() => {
	if (props.execution.mode !== 'manual' || !store.features.executionTracking) return undefined;
	const userId = props.execution.ext?.executedByUserId;
	if (typeof userId !== 'string') return undefined;
	const user = usersStore.usersById[userId];
	return user ? (user.fullName ?? user.email ?? userId) : undefined;
});
</script>

<template>
	<N8nTooltip
		v-if="userName"
		:content="t('executions.manualBy', { user: userName })"
		placement="top"
	>
		<span :class="$style.name" data-test-id="extras-execution-run-by">{{ userName }}</span>
	</N8nTooltip>
</template>

<style lang="scss" module>
.name {
	margin-left: var(--spacing--3xs);
	font-size: var(--font-size--2xs);
	color: var(--color--text);
	white-space: nowrap;
}
</style>
