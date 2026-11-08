import { defineAsyncComponent } from 'vue';
import {
	defineFrontendModule,
	type DynamicTabOptions,
	type ExtensionWorkflow,
	type WorkflowCardMenuContribution,
} from '@n8n/frontend-module-sdk';
import { useSettingsStore } from '@n8n/stores/settings.store';

import { t } from './extras.i18n';

/**
 * Keep this file import-light: types and the SDK only. Views and components load lazily,
 * and stores are referenced inside handlers, never at module scope — a top-level store
 * import pulls the whole module in even when it is disabled.
 */

const MODULE_ID = 'extras';
const PUBLISHED_TAB = 'extras-published';
const PLUGINS_SETTINGS_VIEW = 'ExtrasPluginsSettings';

// Route names of the pages that list workflows (see the shell's `VIEWS`).
const WORKFLOW_LIST_ROUTES = [
	'WorkflowsView',
	'SharedWorkflows',
	'ProjectsWorkflows',
	'ProjectsFolders',
	'Folders',
];

const isPublishedList = (route: { name?: unknown; query: Record<string, unknown> }) =>
	typeof route.name === 'string' &&
	WORKFLOW_LIST_ROUTES.includes(route.name) &&
	route.query.status === 'true';

const isTabAvailable = () => useSettingsStore().isModuleActive(MODULE_ID);

const publishedTab = (
	insertAfter: string,
	route: NonNullable<DynamicTabOptions['dynamicRoute']>,
): DynamicTabOptions => ({
	label: t('tab.published'),
	value: PUBLISHED_TAB,
	insertAfter,
	dynamicRoute: { ...route, query: { status: 'true' } },
	isActive: isPublishedList,
	available: isTabAvailable,
});

const executeMenu: WorkflowCardMenuContribution = {
	items: (workflow: ExtensionWorkflow) => {
		const canExecute =
			workflow.activeVersionId !== null &&
			!workflow.isArchived &&
			!workflow.readOnly &&
			(workflow.scopes?.includes('workflow:execute') ?? false);
		return canExecute ? [{ label: t('execute.menu'), value: 'extras:execute' }] : [];
	},
	onSelect: async (value, workflow) => {
		if (value !== 'extras:execute') return false;

		const [{ useExtrasStore }, { useToast }] = await Promise.all([
			import('./extras.store'),
			import('@n8n/composables/useToast'),
		]);
		const toast = useToast();
		try {
			await useExtrasStore().execute(workflow.id);
			toast.showMessage({
				title: t('execute.toast'),
				message: t('execute.toastMessage', { name: workflow.name }),
				type: 'success',
			});
		} catch (error) {
			toast.showError(error, t('execute.error'));
		}
		return true;
	},
};

export const ExtrasModule = defineFrontendModule({
	// Must match the backend module id: both gate off `/rest/module-settings`.
	id: MODULE_ID,
	name: 'Extras',
	description: 'Published tab, expandable folders, pause and resume, and run tracking',
	icon: 'puzzle',

	routes: [
		{
			path: 'plugins',
			name: PLUGINS_SETTINGS_VIEW,
			component: async () => await import('./views/PluginsSettingsView.vue'),
			meta: {
				layout: 'settings',
				middleware: ['authenticated'],
				telemetry: { pageCategory: 'settings' },
			},
		},
	],

	settingsPages: [
		{
			id: 'settings-plugins',
			// Between the shell's own Integrations links (they use 10, 20, 30, ...).
			order: 90,
			section: 'integrations',
			icon: 'puzzle',
			label: t('settings.title'),
			position: 'top',
			route: { to: { name: PLUGINS_SETTINGS_VIEW } },
		},
	],

	projectTabs: {
		overview: [publishedTab('WorkflowsView', { name: 'WorkflowsView' })],
		project: [
			publishedTab('ProjectsWorkflows', { name: 'ProjectsWorkflows', includeProjectId: true }),
		],
		shared: [publishedTab('SharedWorkflows', { name: 'SharedWorkflows' })],
	},

	uiExtensions: {
		workflowCardActions: [
			defineAsyncComponent(async () => await import('./components/WorkflowPauseButton.vue')),
		],
		workflowCardMenu: [executeMenu],
		folderCardToggle: defineAsyncComponent(
			async () => await import('./components/FolderExpandToggle.vue'),
		),
		folderCardContent: defineAsyncComponent(
			async () => await import('./components/FolderWorkflows.vue'),
		),
		executionFilterFields: [
			defineAsyncComponent(async () => await import('./components/ExecutionRunFilter.vue')),
		],
		executionRowCells: [
			defineAsyncComponent(async () => await import('./components/ExecutionRunBy.vue')),
		],
	},
});
