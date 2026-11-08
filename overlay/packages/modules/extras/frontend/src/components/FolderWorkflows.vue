<script setup lang="ts">
import { ref, watch } from 'vue';
import { N8nBadge, N8nText } from '@n8n/design-system';
import { useRootStore } from '@n8n/stores/useRootStore';
import type { ExtensionFolder } from '@n8n/frontend-module-sdk';

import { fetchFolderWorkflows, type FolderWorkflow } from '../extras.api';
import { t } from '../extras.i18n';

// The shell's route name for an existing workflow (`VIEWS.WORKFLOW`).
const WORKFLOW_ROUTE = 'NodeViewExisting';

// `RouterLink` is not imported on purpose: the app registers it globally, and the copy of
// `vue-router` inside this package is not connected to the app's router (it renders nothing).
const props = defineProps<{ folder: ExtensionFolder; publishedOnly?: boolean }>();

const rootStore = useRootStore();
const loading = ref(true);
const failed = ref(false);
const workflows = ref<FolderWorkflow[]>([]);

async function load() {
	loading.value = true;
	failed.value = false;
	try {
		workflows.value = await fetchFolderWorkflows(rootStore.restApiContext, {
			folderId: props.folder.id,
			projectId: props.folder.projectId,
			publishedOnly: Boolean(props.publishedOnly),
		});
	} catch {
		failed.value = true;
		workflows.value = [];
	} finally {
		loading.value = false;
	}
}

watch(() => [props.folder.id, props.folder.projectId, props.publishedOnly], load, {
	immediate: true,
});
</script>

<template>
	<div :class="$style.container" data-test-id="extras-folder-workflows">
		<N8nText v-if="loading" size="small" color="text-light">{{ t('folder.loading') }}</N8nText>
		<N8nText v-else-if="failed" size="small" color="danger">{{ t('folder.error') }}</N8nText>
		<N8nText v-else-if="!workflows.length" size="small" color="text-light">
			{{ t('folder.empty') }}
		</N8nText>
		<ul v-else :class="$style.list">
			<li v-for="workflow in workflows" :key="workflow.id" :class="$style.item">
				<RouterLink
					:to="{ name: WORKFLOW_ROUTE, params: { workflowId: workflow.id } }"
					:class="$style.link"
					data-test-id="extras-folder-workflow"
				>
					<N8nText size="small" bold>{{ workflow.name }}</N8nText>
				</RouterLink>
				<N8nBadge v-if="workflow.activeVersionId" variant="outline" theme="success" class="ml-3xs">
					{{ t('folder.published') }}
				</N8nBadge>
			</li>
		</ul>
	</div>
</template>

<style lang="scss" module>
.container {
	margin: var(--spacing--3xs) 0 var(--spacing--2xs) var(--spacing--xl);
	padding: var(--spacing--2xs) var(--spacing--sm);
	border-left: var(--border);
}

.list {
	list-style: none;
	margin: 0;
	padding: 0;
}

.item {
	display: flex;
	align-items: center;
	padding: var(--spacing--4xs) 0;
}

.link {
	color: var(--color--text--shade-1);

	&:hover {
		color: var(--color--primary);
	}
}
</style>
