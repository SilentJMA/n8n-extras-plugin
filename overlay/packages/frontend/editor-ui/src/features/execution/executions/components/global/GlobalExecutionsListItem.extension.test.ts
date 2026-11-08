import { createComponentRenderer } from '@/__tests__/render';
import { uiExtensionRegistry } from '@n8n/frontend-module-sdk';
import type { ExecutionSummary } from 'n8n-workflow';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, h } from 'vue';

import GlobalExecutionsListItem from './GlobalExecutionsListItem.vue';

vi.mock('vue-router', async () => ({
	...(await vi.importActual('vue-router')),
	useRouter: vi.fn(() => ({ resolve: vi.fn(() => ({ href: 'mockedRoute' })) })),
}));

const Cell = defineComponent({
	props: { execution: { type: Object, required: true } },
	render() {
		return h(
			'span',
			{ 'data-test-id': 'ext-cell' },
			String((this.execution as ExecutionSummary).ext?.executedByUserId),
		);
	},
});

const renderComponent = createComponentRenderer(GlobalExecutionsListItem, {
	global: { stubs: { N8nButton: true, I18nT: true } },
});

describe('GlobalExecutionsListItem module extensions', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		uiExtensionRegistry.clear();
	});
	afterEach(() => uiExtensionRegistry.clear());

	it('renders a contributed cell with the execution', () => {
		uiExtensionRegistry.registerAll({ executionRowCells: [Cell] });

		const { getByTestId } = renderComponent({
			props: {
				execution: {
					id: '1',
					status: 'success',
					mode: 'manual',
					workflowName: 'WF',
					ext: { executedByUserId: 'user-1' },
				} as unknown as ExecutionSummary,
			},
		});

		expect(getByTestId('ext-cell')).toHaveTextContent('user-1');
	});

	it('renders no extra cell when no module contributes', () => {
		const { queryByTestId } = renderComponent({
			props: {
				execution: {
					id: '1',
					status: 'success',
					mode: 'manual',
					workflowName: 'WF',
				} as unknown as ExecutionSummary,
			},
		});

		expect(queryByTestId('ext-cell')).toBeNull();
	});
});
