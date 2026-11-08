<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { N8nIconButton } from '@n8n/design-system';
import type { ExtensionFolder } from '@n8n/frontend-module-sdk';

import { t } from '../extras.i18n';
import { useExtrasStore } from '../extras.store';

const props = defineProps<{ folder: ExtensionFolder; expanded: boolean }>();
const emit = defineEmits<{ toggle: [] }>();

const store = useExtrasStore();

onMounted(() => {
	void store.ensureLoaded().catch(() => {});
});

const visible = computed(() => store.features.folderExpand && props.folder.workflowCount > 0);
</script>

<template>
	<N8nIconButton
		v-if="visible"
		variant="ghost"
		size="small"
		:icon="expanded ? 'chevron-down' : 'chevron-right'"
		:aria-expanded="expanded"
		:aria-label="expanded ? t('folder.collapse') : t('folder.expand')"
		data-test-id="extras-folder-expand-toggle"
		@click="emit('toggle')"
	/>
</template>
