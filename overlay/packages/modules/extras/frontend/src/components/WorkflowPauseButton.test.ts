import { createComponentRenderer } from '@n8n/frontend-test-utils';
import userEvent from '@testing-library/user-event';
import { waitFor } from '@testing-library/vue';
import { createPinia, setActivePinia } from 'pinia';

import { useExtrasStore } from '../extras.store';
import WorkflowPauseButton from './WorkflowPauseButton.vue';

const { showMessage, showError } = vi.hoisted(() => ({ showMessage: vi.fn(), showError: vi.fn() }));
vi.mock('@n8n/composables/useToast', () => ({ useToast: () => ({ showMessage, showError }) }));
vi.mock('../extras.api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../extras.api')>()),
	fetchState: vi.fn().mockResolvedValue({
		features: {
			publishedTab: true,
			folderExpand: true,
			executeFromList: true,
			pauseResume: true,
			executionTracking: true,
			visualDataMapper: true,
		},
		pausedWorkflowIds: [],
	}),
}));
vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({ restApiContext: { baseUrl: '/rest' } }),
}));

const workflow = {
	id: 'wf-1',
	name: 'My workflow',
	activeVersionId: 'v1',
	isArchived: false,
	readOnly: false,
	scopes: ['workflow:publish', 'workflow:unpublish'],
};

const renderComponent = createComponentRenderer(WorkflowPauseButton);

describe('WorkflowPauseButton', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('shows a pause button on a published workflow', () => {
		const { getByTestId, queryByTestId } = renderComponent({ props: { workflow } });

		expect(getByTestId('extras-pause-toggle')).toBeVisible();
		expect(queryByTestId('extras-paused-badge')).toBeNull();
	});

	it.each([
		['not published', { activeVersionId: null }],
		['archived', { isArchived: true }],
		['read-only', { readOnly: true }],
		['missing the unpublish scope', { scopes: ['workflow:publish'] }],
	])('shows no button when the workflow is %s', (_label, overrides) => {
		const { queryByTestId } = renderComponent({
			props: { workflow: { ...workflow, ...overrides } },
		});

		expect(queryByTestId('extras-pause-toggle')).toBeNull();
	});

	it('shows no button when the feature is switched off', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useExtrasStore().features.pauseResume = false;

		const { queryByTestId } = renderComponent({ pinia, props: { workflow } });

		expect(queryByTestId('extras-pause-toggle')).toBeNull();
	});

	it('shows the Paused badge and a resume button for a paused workflow', () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		useExtrasStore().pausedWorkflowIds = new Set(['wf-1']);

		const { getByTestId } = renderComponent({ pinia, props: { workflow } });

		expect(getByTestId('extras-paused-badge')).toBeVisible();
		expect(getByTestId('extras-pause-toggle')).toHaveAttribute('aria-label', 'Resume');
	});

	it('pauses on click and confirms with a toast', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const store = useExtrasStore();
		store.pause = vi.fn().mockImplementation(async () => {
			store.pausedWorkflowIds = new Set(['wf-1']);
			return { id: 'wf-1', paused: true };
		});

		const { getByTestId } = renderComponent({ pinia, props: { workflow } });
		await userEvent.click(getByTestId('extras-pause-toggle'));

		await waitFor(() => expect(store.pause).toHaveBeenCalledWith('wf-1'));
		expect(showMessage).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Workflow paused', message: 'My workflow' }),
		);
	});

	it('reports a failure instead of changing state', async () => {
		const pinia = createPinia();
		setActivePinia(pinia);
		const store = useExtrasStore();
		store.pause = vi.fn().mockRejectedValue(new Error('boom'));

		const { getByTestId } = renderComponent({ pinia, props: { workflow } });
		await userEvent.click(getByTestId('extras-pause-toggle'));

		await waitFor(() => expect(showError).toHaveBeenCalled());
		expect(store.isPaused('wf-1')).toBe(false);
	});
});
