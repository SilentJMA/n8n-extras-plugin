<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { N8nBadge, N8nIconButton, N8nTooltip } from '@n8n/design-system';
import { useToast } from '@n8n/composables/useToast';
import type { ExtensionWorkflow } from '@n8n/frontend-module-sdk';

import { t } from '../extras.i18n';
import { useExtrasStore } from '../extras.store';

const props = defineProps<{ workflow: ExtensionWorkflow }>();

const store = useExtrasStore();
const toast = useToast();
const busy = ref(false);

onMounted(() => {
	void store.ensureLoaded().catch(() => {});
});

const isPublished = computed(() => props.workflow.activeVersionId !== null);
const isPaused = computed(() => store.isPaused(props.workflow.id));

const canToggle = computed(() => {
	if (!store.features.pauseResume) return false;
	if (!isPublished.value || props.workflow.isArchived || props.workflow.readOnly) return false;
	const scope = isPaused.value ? 'workflow:publish' : 'workflow:unpublish';
	return props.workflow.scopes?.includes(scope) ?? false;
});

const showPausedBadge = computed(
	() =>
		store.features.pauseResume && isPublished.value && isPaused.value && !props.workflow.isArchived,
);

async function toggle() {
	if (busy.value) return;
	busy.value = true;
	const pausing = !isPaused.value;
	try {
		await (pausing ? store.pause(props.workflow.id) : store.resume(props.workflow.id));
		toast.showMessage({
			title: t(pausing ? 'pause.pausedToast' : 'pause.resumedToast'),
			message: props.workflow.name,
			type: 'success',
		});
	} catch (error) {
		toast.showError(error, t(pausing ? 'pause.pauseError' : 'pause.resumeError'));
	} finally {
		busy.value = false;
	}
}
</script>

<template>
	<span :class="$style.root">
		<N8nBadge
			v-if="showPausedBadge"
			variant="outline"
			theme="warning"
			data-test-id="extras-paused-badge"
		>
			{{ t('pause.paused') }}
		</N8nBadge>
		<N8nTooltip
			v-if="canToggle"
			:content="isPaused ? t('pause.resumeTooltip') : t('pause.pauseTooltip')"
			placement="top"
		>
			<N8nIconButton
				variant="ghost"
				size="small"
				:icon="isPaused ? 'play' : 'pause'"
				:loading="busy"
				:aria-label="isPaused ? t('pause.resume') : t('pause.pause')"
				data-test-id="extras-pause-toggle"
				@click.stop="toggle"
			/>
		</N8nTooltip>
	</span>
</template>

<style lang="scss" module>
.root {
	display: contents;
}
</style>
