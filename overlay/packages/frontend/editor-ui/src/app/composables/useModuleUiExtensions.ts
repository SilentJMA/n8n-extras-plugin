import { computed } from 'vue';
import { uiExtensionRegistry } from '@n8n/frontend-module-sdk';

/**
 * What active modules add to existing pages (workflow cards, folder cards, the executions
 * list and its filter). Filled at startup by `registerModuleUiExtensions`; empty when no
 * module contributes.
 */
export function useModuleUiExtensions() {
	return {
		workflowCardActions: computed(() => uiExtensionRegistry.get('workflowCardActions')),
		workflowCardMenu: computed(() => uiExtensionRegistry.get('workflowCardMenu')),
		folderCardToggle: computed(() => uiExtensionRegistry.get('folderCardToggle')),
		folderCardContent: computed(() => uiExtensionRegistry.get('folderCardContent')),
		executionFilterFields: computed(() => uiExtensionRegistry.get('executionFilterFields')),
		executionRowCells: computed(() => uiExtensionRegistry.get('executionRowCells')),
	};
}
