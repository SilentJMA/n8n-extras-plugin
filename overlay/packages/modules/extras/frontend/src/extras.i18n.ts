/**
 * English strings of the plugin. The shell does not read module `locales` yet, so the module
 * keeps its own small table instead of editing the shared locale file.
 */
const messages = {
	'tab.published': 'Published',
	'pause.pause': 'Pause',
	'pause.resume': 'Resume',
	'pause.paused': 'Paused',
	'pause.pauseTooltip': 'Pause: stop triggers and webhooks, stays published',
	'pause.resumeTooltip': 'Resume: start triggers and webhooks again',
	'pause.pausedToast': 'Workflow paused',
	'pause.resumedToast': 'Workflow resumed',
	'pause.pauseError': 'Could not pause workflow',
	'pause.resumeError': 'Could not resume workflow',
	'execute.menu': 'Execute',
	'execute.toast': 'Execution started',
	'execute.toastMessage': '{name} is running. See it on the Executions page.',
	'execute.error': 'Could not execute workflow',
	'folder.expand': 'Show workflows in folder',
	'folder.collapse': 'Hide workflows in folder',
	'folder.loading': 'Loading',
	'folder.empty': 'No workflows directly in this folder',
	'folder.error': 'Could not load workflows',
	'folder.published': 'Published',
	'executions.runType': 'Run type',
	'executions.runType.all': 'All',
	'executions.runType.manual': 'Manual',
	'executions.runType.automatic': 'Automatic',
	'executions.runBy': 'Run by',
	'executions.runBy.all': 'Anyone',
	'executions.manualBy': 'Manual execution by {user}',
	'settings.title': 'Plugins',
	'settings.subtitle': 'Optional extras for workflows and executions. Switch features on or off.',
	'settings.saved': 'Plugin settings saved',
	'settings.error': 'Could not save plugin settings',
	'settings.adminOnly': 'Only instance admins can change plugin settings.',
	'feature.publishedTab': 'Published tab',
	'feature.publishedTab.description': 'A tab that lists only published workflows.',
	'feature.folderExpand': 'Expandable folders',
	'feature.folderExpand.description': 'Show the workflows inside a folder without opening it.',
	'feature.executeFromList': 'Execute from the list',
	'feature.executeFromList.description':
		'Run a published workflow from its "..." menu, as a manual execution.',
	'feature.pauseResume': 'Pause and resume',
	'feature.pauseResume.description':
		'Stop a published workflow without unpublishing it, and start it again.',
	'feature.executionTracking': 'Execution tracking',
	'feature.executionTracking.description':
		'Record who started a manual execution, and filter executions by run type and user.',
} as const;

export type ExtrasMessageKey = keyof typeof messages;

export function t(key: ExtrasMessageKey, interpolate: Record<string, string> = {}): string {
	return Object.entries(interpolate).reduce(
		(text, [name, value]) => text.replaceAll(`{${name}}`, value),
		messages[key] as string,
	);
}
