import { createComponentRenderer } from '@n8n/frontend-test-utils';
import { waitFor } from '@testing-library/vue';
import { createPinia, setActivePinia } from 'pinia';

import * as api from '../extras.api';
import FolderWorkflows from './FolderWorkflows.vue';

vi.mock('../extras.api', async (importOriginal) => ({
	...(await importOriginal<typeof import('../extras.api')>()),
	fetchFolderWorkflows: vi.fn(),
}));
vi.mock('@n8n/stores/useRootStore', () => ({
	useRootStore: () => ({ restApiContext: { baseUrl: '/rest' } }),
}));

// The app registers RouterLink globally; stand in for it the same way.
const renderComponent = createComponentRenderer(FolderWorkflows, {
	global: {
		stubs: {
			RouterLink: {
				props: ['to'],
				template: '<a data-test-id="link" :data-to="JSON.stringify(to)"><slot /></a>',
			},
		},
	},
});

const folder = { id: 'f1', name: 'Folder', workflowCount: 2, projectId: 'p1' };

describe('FolderWorkflows', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		vi.clearAllMocks();
	});

	it('lists the workflow names, with a badge only on published ones', async () => {
		vi.mocked(api.fetchFolderWorkflows).mockResolvedValue([
			{ id: 'w1', name: 'Published workflow A', activeVersionId: 'v1' },
			{ id: 'w2', name: 'Draft workflow', activeVersionId: null },
		]);

		const { getAllByTestId, getByText, queryAllByText } = renderComponent({ props: { folder } });

		await waitFor(() => expect(getAllByTestId('extras-folder-workflow')).toHaveLength(2));
		expect(getByText('Published workflow A')).toBeVisible();
		expect(getByText('Draft workflow')).toBeVisible();
		expect(queryAllByText('Published')).toHaveLength(1);
	});

	it("links each workflow to the shell's existing-workflow route", async () => {
		vi.mocked(api.fetchFolderWorkflows).mockResolvedValue([
			{ id: 'w1', name: 'Published workflow A', activeVersionId: 'v1' },
		]);

		const { findByTestId } = renderComponent({ props: { folder } });

		expect(
			JSON.parse((await findByTestId('extras-folder-workflow')).getAttribute('data-to') ?? ''),
		).toEqual({
			name: 'NodeViewExisting',
			params: { workflowId: 'w1' },
		});
	});

	it('asks only for published workflows when told to', async () => {
		vi.mocked(api.fetchFolderWorkflows).mockResolvedValue([]);

		renderComponent({ props: { folder, publishedOnly: true } });

		await waitFor(() =>
			expect(api.fetchFolderWorkflows).toHaveBeenCalledWith(
				{ baseUrl: '/rest' },
				{ folderId: 'f1', projectId: 'p1', publishedOnly: true },
			),
		);
	});

	it('says so when the folder has no workflows', async () => {
		vi.mocked(api.fetchFolderWorkflows).mockResolvedValue([]);

		const { findByText } = renderComponent({ props: { folder } });

		expect(await findByText('No workflows directly in this folder')).toBeVisible();
	});

	it('reports a failed load', async () => {
		vi.mocked(api.fetchFolderWorkflows).mockRejectedValue(new Error('nope'));

		const { findByText } = renderComponent({ props: { folder } });

		expect(await findByText('Could not load workflows')).toBeVisible();
	});
});
