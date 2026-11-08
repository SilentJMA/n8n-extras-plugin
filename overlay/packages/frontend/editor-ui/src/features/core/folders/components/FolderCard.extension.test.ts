import { createComponentRenderer } from '@/__tests__/render';
import { uiExtensionRegistry } from '@n8n/frontend-module-sdk';
import userEvent from '@testing-library/user-event';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';

import type { FolderResource } from '@/Interface';
import FolderCard from './FolderCard.vue';

vi.mock('vue-router', () => ({
	useRouter: vi
		.fn()
		.mockReturnValue({ push: vi.fn(), resolve: vi.fn().mockReturnValue({ href: '/' }) }),
	useRoute: vi.fn().mockReturnValue({ params: { projectId: 'p1' }, query: { status: 'true' } }),
	RouterLink: vi.fn(),
}));

const Toggle = defineComponent({
	props: { folder: { type: Object, required: true }, expanded: Boolean },
	emits: ['toggle'],
	render() {
		return h(
			'button',
			{ 'data-test-id': 'ext-toggle', onClick: () => this.$emit('toggle') },
			this.expanded ? 'open' : 'closed',
		);
	},
});

const Content = defineComponent({
	props: { folder: { type: Object, required: true }, publishedOnly: Boolean },
	render() {
		return h(
			'div',
			{ 'data-test-id': 'ext-content' },
			`${(this.folder as { id: string }).id}:${String(this.publishedOnly)}`,
		);
	},
});

const folder = {
	id: 'f1',
	name: 'Folder',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
	resourceType: 'folder',
	workflowCount: 2,
	subFolderCount: 0,
	homeProject: { id: 'p1', name: 'P', type: 'personal' },
} as unknown as FolderResource;

const renderComponent = createComponentRenderer(FolderCard, {
	props: { data: folder },
	global: { stubs: { RouterLink: { template: '<div><slot /></div>' } } },
});

describe('FolderCard module extensions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		uiExtensionRegistry.clear();
	});
	afterEach(() => uiExtensionRegistry.clear());

	it('renders nothing extra when no module contributes', () => {
		const { queryByTestId } = renderComponent();

		expect(queryByTestId('ext-toggle')).toBeNull();
		expect(queryByTestId('ext-content')).toBeNull();
	});

	it('shows a module toggle, and the module content only while expanded', async () => {
		uiExtensionRegistry.registerAll({ folderCardToggle: Toggle, folderCardContent: Content });
		const { getByTestId, queryByTestId } = renderComponent();

		expect(getByTestId('ext-toggle')).toHaveTextContent('closed');
		expect(queryByTestId('ext-content')).toBeNull();

		await userEvent.click(getByTestId('ext-toggle'));

		expect(getByTestId('ext-toggle')).toHaveTextContent('open');
		expect(getByTestId('ext-content')).toHaveTextContent('f1:true');

		await userEvent.click(getByTestId('ext-toggle'));
		expect(queryByTestId('ext-content')).toBeNull();
	});

	it('does not open the folder when the module toggle is clicked', async () => {
		uiExtensionRegistry.registerAll({ folderCardToggle: Toggle, folderCardContent: Content });
		const { getByTestId, emitted } = renderComponent();

		await userEvent.click(getByTestId('ext-toggle'));

		expect(emitted().folderOpened).toBeUndefined();
	});
});
