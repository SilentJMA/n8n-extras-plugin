import { useRootStore } from '@n8n/stores/useRootStore';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import {
	DEFAULT_FEATURES,
	executeWorkflow,
	fetchState,
	pauseWorkflow,
	resumeWorkflow,
	saveFeatures,
	type ExtrasFeatures,
} from './extras.api';

/**
 * Pinia stores self-register on the first `use…Store()` call, so there is
 * nothing to declare in the descriptor.
 */
export const useExtrasStore = defineStore('extras', () => {
	const rootStore = useRootStore();

	const features = ref<ExtrasFeatures>({ ...DEFAULT_FEATURES });
	const pausedWorkflowIds = ref<Set<string>>(new Set());
	const isLoaded = ref(false);
	let loading: Promise<void> | undefined;

	const isPaused = computed(() => (workflowId: string) => pausedWorkflowIds.value.has(workflowId));

	/** Loads the plugin state once. Safe to call from every component that needs it. */
	async function ensureLoaded() {
		if (isLoaded.value) return;
		loading ??= (async () => {
			try {
				const state = await fetchState(rootStore.restApiContext);
				features.value = state.features;
				pausedWorkflowIds.value = new Set(state.pausedWorkflowIds);
				isLoaded.value = true;
			} finally {
				loading = undefined;
			}
		})();
		await loading;
	}

	async function pause(workflowId: string) {
		const result = await pauseWorkflow(rootStore.restApiContext, workflowId);
		pausedWorkflowIds.value = new Set(pausedWorkflowIds.value).add(workflowId);
		return result;
	}

	async function resume(workflowId: string) {
		const result = await resumeWorkflow(rootStore.restApiContext, workflowId);
		const next = new Set(pausedWorkflowIds.value);
		next.delete(workflowId);
		pausedWorkflowIds.value = next;
		return result;
	}

	async function execute(workflowId: string) {
		return await executeWorkflow(rootStore.restApiContext, workflowId);
	}

	async function updateFeatures(update: Partial<ExtrasFeatures>) {
		const result = await saveFeatures(rootStore.restApiContext, update);
		features.value = result.features;
	}

	return {
		features,
		pausedWorkflowIds,
		isLoaded,
		isPaused,
		ensureLoaded,
		pause,
		resume,
		execute,
		updateFeatures,
	};
});
