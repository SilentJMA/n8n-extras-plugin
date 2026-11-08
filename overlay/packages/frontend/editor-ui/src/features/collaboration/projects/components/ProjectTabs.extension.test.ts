import { createComponentRenderer } from '@/__tests__/render';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';

import ProjectTabs from './ProjectTabs.vue';

const route = reactive<{ name: string; params: object; query: Record<string, string> }>({
	name: 'WorkflowsView',
	params: {},
	query: {},
});

vi.mock('vue-router', async () => ({
	...(await vi.importActual('vue-router')),
	useRoute: () => route,
}));

const renderComponent = createComponentRenderer(ProjectTabs, {
	props: {
		pageType: 'overview',
		additionalTabs: [
			{
				label: 'Published',
				value: 'published',
				insertAfter: 'WorkflowsView',
				dynamicRoute: { name: 'WorkflowsView', query: { status: 'true' } },
				isActive: (current: { name?: unknown; query: Record<string, unknown> }) =>
					current.name === 'WorkflowsView' && current.query.status === 'true',
			},
		],
	},
	global: { stubs: { RouterLink: { template: '<div><slot /></div>' } } },
});

// The selected tab gets the `activeTab` CSS-module class on its link.
const isSelected = (tab: HTMLElement) => tab.querySelector('[class*="activeTab"]') !== null;

describe('ProjectTabs module tabs that share a route', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		route.name = 'WorkflowsView';
		route.query = {};
	});

	it('selects Workflows, not the module tab, on the plain list', () => {
		const { getByTestId } = renderComponent();

		expect(isSelected(getByTestId('tab-WorkflowsView'))).toBe(true);
		expect(isSelected(getByTestId('tab-published'))).toBe(false);
	});

	it('selects the module tab when its isActive matches the route query', () => {
		route.query = { status: 'true' };

		const { getByTestId } = renderComponent();

		expect(isSelected(getByTestId('tab-published'))).toBe(true);
		expect(isSelected(getByTestId('tab-WorkflowsView'))).toBe(false);
	});
});
