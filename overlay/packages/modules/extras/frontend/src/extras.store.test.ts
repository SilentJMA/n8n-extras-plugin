import { createPinia, setActivePinia } from 'pinia';

import * as api from './extras.api';
import { useExtrasStore } from './extras.store';

vi.mock('./extras.api', async (importOriginal) => ({
	...(await importOriginal<typeof import('./extras.api')>()),
	fetchState: vi.fn(),
	pauseWorkflow: vi.fn(),
	resumeWorkflow: vi.fn(),
	saveFeatures: vi.fn(),
	executeWorkflow: vi.fn(),
}));
vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({ restApiContext: { baseUrl: '/rest' } }),
}));

describe('useExtrasStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('starts with every feature on and nothing paused', () => {
		const store = useExtrasStore();

		expect(store.features).toEqual(api.DEFAULT_FEATURES);
		expect(store.isPaused('wf-1')).toBe(false);
		expect(store.isLoaded).toBe(false);
	});

	it('loads the state once, however many components ask', async () => {
		vi.mocked(api.fetchState).mockResolvedValue({
			features: { ...api.DEFAULT_FEATURES, folderExpand: false },
			pausedWorkflowIds: ['wf-1'],
		});
		const store = useExtrasStore();

		await Promise.all([store.ensureLoaded(), store.ensureLoaded()]);
		await store.ensureLoaded();

		expect(api.fetchState).toHaveBeenCalledTimes(1);
		expect(store.features.folderExpand).toBe(false);
		expect(store.isPaused('wf-1')).toBe(true);
	});

	it('tracks pause and resume locally after the server confirms', async () => {
		vi.mocked(api.pauseWorkflow).mockResolvedValue({ id: 'wf-2', paused: true });
		vi.mocked(api.resumeWorkflow).mockResolvedValue({ id: 'wf-2', paused: false });
		const store = useExtrasStore();

		await store.pause('wf-2');
		expect(store.isPaused('wf-2')).toBe(true);

		await store.resume('wf-2');
		expect(store.isPaused('wf-2')).toBe(false);
	});

	it('does not mark a workflow paused when the request fails', async () => {
		vi.mocked(api.pauseWorkflow).mockRejectedValue(new Error('nope'));
		const store = useExtrasStore();

		await expect(store.pause('wf-3')).rejects.toThrow('nope');
		expect(store.isPaused('wf-3')).toBe(false);
	});

	it('stores the features the server returns after an update', async () => {
		vi.mocked(api.saveFeatures).mockResolvedValue({
			features: { ...api.DEFAULT_FEATURES, pauseResume: false },
		});
		const store = useExtrasStore();

		await store.updateFeatures({ pauseResume: false });

		expect(api.saveFeatures).toHaveBeenCalledWith({ baseUrl: '/rest' }, { pauseResume: false });
		expect(store.features.pauseResume).toBe(false);
	});
});
