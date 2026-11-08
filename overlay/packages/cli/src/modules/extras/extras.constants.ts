/** Features the plugin adds. Each one can be switched off in Settings > Integrations > Plugins. */
export const EXTRAS_FEATURES = [
	'publishedTab',
	'folderExpand',
	'executeFromList',
	'pauseResume',
	'executionTracking',
	'visualDataMapper',
] as const;

export type ExtrasFeature = (typeof EXTRAS_FEATURES)[number];
export type ExtrasFeatures = Record<ExtrasFeature, boolean>;

export const DEFAULT_EXTRAS_FEATURES: ExtrasFeatures = {
	publishedTab: true,
	folderExpand: true,
	executeFromList: true,
	pauseResume: true,
	executionTracking: true,
	visualDataMapper: true,
};
